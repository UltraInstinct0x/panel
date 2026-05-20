// panel-comfyui-adapter: drive a comfyui instance, emit outputs to panel.
// comfyui's API is HTTP for queue + websockets for progress, so this needs
// a real adapter (not just sdk userland code).
//
// threat model:
//   comfyui's HTTP API has NO auth by default. require comfyUrl to be a
//   private/tailscale/localhost address, OR pass `auth` for a reverse-proxy
//   bearer header. public hostnames without auth throw on construction.

import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import WebSocket from 'ws';
import type { PanelClient, EmitResult, GroundTruth } from 'panel-sdk';

export interface ComfyAdapterOptions {
  /** base url of the comfyui instance, e.g. http://127.0.0.1:8188 */
  comfyUrl: string;
  /** panel-sdk client. must already be configured with site key + secret. */
  panelClient: PanelClient;
  /** default workflow (object or path/url/json string). overridden per-submit. */
  defaultWorkflow?: WorkflowInput;
  /** default mediaType for outputs (e.g. "image/png"). detected from filename if absent. */
  defaultMediaType?: string;
  /** optional reverse-proxy auth header. required when comfyUrl is public. */
  auth?: { header: string; value: string };
  /** override fetch (tests/edge). defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** override websocket constructor (tests). defaults to ws.WebSocket. */
  WebSocketImpl?: typeof WebSocket;
  /** ms to wait for `executed` event before bailing. default 120000. */
  timeoutMs?: number;
}

export type WorkflowInput = object | string;

export interface ComfyOutput {
  filename: string;
  subfolder: string;
  type: 'output' | 'input' | 'temp' | string;
}

export interface SubmitInput {
  workflow?: WorkflowInput;
  prompt?: string;
  groundTruth?: GroundTruth;
  mediaType?: string;
  extra?: Record<string, unknown>;
  externalRef?: string;
}

export interface SubmittedUnit {
  /** sha256 of the downloaded media bytes. */
  sha256: string;
  /** mime type. */
  mediaType: string;
  /** url panel will fetch (the comfy /view url). */
  url: string;
  /** server-assigned unit id, when ingest succeeded. */
  id?: string;
  /** ingest http status. */
  status: number;
}

export interface SubmitResult {
  promptId: string;
  units: SubmittedUnit[];
  raw: { prompt: unknown; outputs: ComfyOutput[] };
}

export interface ComfyAdapter {
  submit(input?: SubmitInput): Promise<SubmitResult>;
  healthcheck(): Promise<{ ok: boolean; status: number; raw?: unknown }>;
}

const PUBLIC_PATTERNS = [
  /^https?:\/\/[^/]+\.(com|net|org|io|dev|app|codes|ai|sh|xyz)(\/|$)/i,
];

function isPrivateHost(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
    // RFC1918 + tailscale 100.64.0.0/10 + link-local 169.254 + private v6 fc00::/7
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/\.local$/i.test(h)) return true;
    if (/\.ts\.net$/i.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function detectMediaType(filename: string, fallback?: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    default: return fallback ?? 'application/octet-stream';
  }
}

export async function loadWorkflow(input: WorkflowInput): Promise<object> {
  if (typeof input !== 'string') return input as object;
  const s = input.trim();
  if (s.startsWith('{')) {
    try { return JSON.parse(s); } catch (e: any) { throw new Error(`workflow: invalid inline json: ${e.message}`); }
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    const r = await fetch(s);
    if (!r.ok) throw new Error(`workflow: fetch ${s} failed ${r.status}`);
    return await r.json();
  }
  // treat as local path
  const buf = await readFile(s, 'utf8');
  try { return JSON.parse(buf); } catch (e: any) { throw new Error(`workflow: invalid json at ${s}: ${e.message}`); }
}

export function createComfyAdapter(opts: ComfyAdapterOptions): ComfyAdapter {
  if (!opts?.comfyUrl) throw new Error('comfyUrl required');
  if (!opts?.panelClient) throw new Error('panelClient required');
  if (!isPrivateHost(opts.comfyUrl) && !opts.auth) {
    throw new Error(
      `comfyUrl appears public (${opts.comfyUrl}) and no auth provided. ` +
      `comfyui's HTTP API is unauthenticated by default — pass auth: { header, value } ` +
      `(reverse-proxy bearer) or use a private/tailscale/localhost address.`,
    );
  }
  const f = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const WS = opts.WebSocketImpl ?? WebSocket;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const comfyUrl = opts.comfyUrl.replace(/\/$/, '');

  function authHeaders(): Record<string, string> {
    if (!opts.auth) return {};
    return { [opts.auth.header]: opts.auth.value };
  }

  async function healthcheck() {
    const r = await f(`${comfyUrl}/system_stats`, { headers: authHeaders() });
    let raw: unknown;
    try { raw = await r.json(); } catch { /* ignore */ }
    return { ok: r.ok, status: r.status, raw };
  }

  async function submit(input: SubmitInput = {}): Promise<SubmitResult> {
    const wfInput = input.workflow ?? opts.defaultWorkflow;
    if (!wfInput) throw new Error('submit: no workflow (pass `workflow` or set defaultWorkflow)');
    const workflow = await loadWorkflow(wfInput);
    const clientId = randomUUID();

    // POST /prompt
    const promptResp = await f(`${comfyUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    if (!promptResp.ok) {
      const txt = await promptResp.text().catch(() => '');
      throw new Error(`comfy /prompt ${promptResp.status}: ${txt.slice(0, 400)}`);
    }
    const promptJson: any = await promptResp.json();
    const promptId: string = promptJson.prompt_id;
    if (!promptId) throw new Error(`comfy /prompt: missing prompt_id`);

    // open ws and wait for `executed` events for this prompt_id
    const wsUrl = `${comfyUrl.replace(/^http/, 'ws')}/ws?clientId=${encodeURIComponent(clientId)}`;
    const outputs: ComfyOutput[] = await waitForOutputs(WS, wsUrl, promptId, timeoutMs, authHeaders());

    // download + emit each
    const units: SubmittedUnit[] = [];
    for (const o of outputs) {
      const viewUrl = `${comfyUrl}/view?filename=${encodeURIComponent(o.filename)}&subfolder=${encodeURIComponent(o.subfolder ?? '')}&type=${encodeURIComponent(o.type)}`;
      const dl = await f(viewUrl, { headers: authHeaders() });
      if (!dl.ok) throw new Error(`comfy /view ${dl.status} for ${o.filename}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const sha = createHash('sha256').update(buf).digest('hex');
      const mediaType = input.mediaType ?? detectMediaType(o.filename, opts.defaultMediaType);
      const kind = mediaType.startsWith('video/') ? 'video'
        : mediaType.startsWith('audio/') ? 'audio'
        : 'image';

      const result: EmitResult = await opts.panelClient.emitMedia({
        url: viewUrl,
        type: kind,
        mediaType,
        prompt: input.prompt,
        groundTruth: input.groundTruth ?? 'ai',
        externalRef: input.externalRef ? `${input.externalRef}:${o.filename}` : `comfy:${promptId}:${o.filename}`,
        extra: { ...(input.extra ?? {}), comfy_prompt_id: promptId, sha256: sha, bytes: buf.length, comfy_subfolder: o.subfolder, comfy_type: o.type },
      });
      units.push({ sha256: sha, mediaType, url: viewUrl, id: result.id, status: result.status });
      if (!result.ok) throw new Error(`panel emit failed for ${o.filename}: status=${result.status} error=${result.error ?? ''}`);
    }
    return { promptId, units, raw: { prompt: promptJson, outputs } };
  }

  return { submit, healthcheck };
}

function waitForOutputs(
  WS: typeof WebSocket,
  url: string,
  promptId: string,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<ComfyOutput[]> {
  return new Promise((resolve, reject) => {
    const ws = new WS(url, { headers });
    const collected: ComfyOutput[] = [];
    let settled = false;
    const finish = (err: Error | null, out?: ComfyOutput[]) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      clearTimeout(t);
      if (err) reject(err); else resolve(out ?? []);
    };
    const t = setTimeout(() => finish(new Error(`comfy ws timeout after ${timeoutMs}ms (prompt_id=${promptId})`)), timeoutMs);

    ws.on('error', (e: Error) => finish(e));
    ws.on('close', () => {
      if (!settled) finish(null, collected);
    });
    ws.on('message', (data: WebSocket.RawData) => {
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'executed' && msg.data?.prompt_id === promptId) {
        const imgs = msg.data?.output?.images ?? msg.data?.output?.gifs ?? [];
        for (const im of imgs) {
          if (im?.filename) collected.push({ filename: im.filename, subfolder: im.subfolder ?? '', type: im.type ?? 'output' });
        }
      }
      if (msg.type === 'execution_error' && msg.data?.prompt_id === promptId) {
        finish(new Error(`comfy execution_error: ${msg.data?.exception_message ?? 'unknown'}`));
      }
      if (msg.type === 'execution_success' && msg.data?.prompt_id === promptId) {
        finish(null, collected);
      }
    });
  });
}
