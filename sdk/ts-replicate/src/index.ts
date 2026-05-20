// panel-replicate-adapter: reference adapter showing how to wrap replicate
// predictions and emit produced media to panel via panel-sdk.
//
// this is intentionally thin (~150 lines incl types). copy/modify rather
// than treat as a deep first-party integration. tokens stay server-side.

import { createHash } from 'node:crypto';
import type { PanelClient, MediaKind, GroundTruth, EmitResult } from 'panel-sdk';

export interface ReplicateAdapterOptions {
  /** replicate api token. server-side only. never ship to browsers. */
  replicateToken: string;
  /** panel client (from createClient in panel-sdk). */
  panelClient: PanelClient;
  /** override fetch for tests/edge. defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** override base url. defaults to https://api.replicate.com. */
  base?: string;
  /** poll interval ms. defaults to 1500. */
  pollIntervalMs?: number;
  /** total poll timeout ms. defaults to 5min. */
  pollTimeoutMs?: number;
  /** override sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface RunInput {
  /** replicate model slug (e.g. "stability-ai/sdxl") or version id. */
  model: string;
  /** model input object — passed through to replicate as `input`. */
  input: Record<string, unknown>;
  /** prompt context to attach to the emitted unit (optional). */
  prompt?: string;
  /** if known, label produced media as 'ai' or 'real'. */
  groundTruth?: GroundTruth;
  /** opaque extra metadata merged into unit.meta. */
  extra?: Record<string, unknown>;
  /** caller-supplied external ref for idempotency. */
  externalRef?: string;
}

export interface RunResult {
  /** the underlying replicate prediction object, post-completion. */
  prediction: ReplicatePrediction;
  /** one entry per output url emitted (in order). */
  emits: Array<{ url: string; sha256: string; mediaType: string; result: EmitResult }>;
}

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null;
  error?: unknown;
  urls?: { get?: string; cancel?: string };
  [k: string]: unknown;
}

export interface ReplicateAdapter {
  runImage(input: RunInput): Promise<RunResult>;
  runVideo(input: RunInput): Promise<RunResult>;
}

const DEFAULT_BASE = 'https://api.replicate.com';

export function createReplicateAdapter(opts: ReplicateAdapterOptions): ReplicateAdapter {
  if (!opts?.replicateToken) throw new Error('panel-replicate-adapter: replicateToken required');
  if (!opts?.panelClient) throw new Error('panel-replicate-adapter: panelClient required');
  const fetchImpl = opts.fetch ?? (globalThis as any).fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('panel-replicate-adapter: no fetch available; pass opts.fetch on older runtimes');
  }
  const base = (opts.base ?? DEFAULT_BASE).replace(/\/$/, '');
  const pollIntervalMs = opts.pollIntervalMs ?? 1500;
  const pollTimeoutMs = opts.pollTimeoutMs ?? 5 * 60 * 1000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  async function createPrediction(model: string, input: Record<string, unknown>): Promise<ReplicatePrediction> {
    // replicate accepts either a "model" slug (owner/name) or a "version" id.
    // we normalize: if it looks like a 64-char hex, send as version; else as model.
    const body: Record<string, unknown> = { input };
    if (/^[0-9a-f]{40,}$/i.test(model)) body.version = model;
    else body.model = model;

    const res = await fetchImpl(`${base}/v1/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${opts.replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`panel-replicate-adapter: replicate api ${res.status}: ${text}`);
    }
    return JSON.parse(text) as ReplicatePrediction;
  }

  async function pollUntilDone(p: ReplicatePrediction): Promise<ReplicatePrediction> {
    const started = Date.now();
    let cur = p;
    while (cur.status === 'starting' || cur.status === 'processing') {
      if (Date.now() - started > pollTimeoutMs) {
        throw new Error(`panel-replicate-adapter: prediction ${cur.id} polling timeout after ${pollTimeoutMs}ms`);
      }
      await sleep(pollIntervalMs);
      const url = cur.urls?.get ?? `${base}/v1/predictions/${cur.id}`;
      const res = await fetchImpl(url, {
        headers: { 'Authorization': `Token ${opts.replicateToken}` },
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`panel-replicate-adapter: poll ${res.status}: ${text}`);
      }
      cur = JSON.parse(text) as ReplicatePrediction;
    }
    if (cur.status !== 'succeeded') {
      throw new Error(`panel-replicate-adapter: prediction ${cur.status}: ${JSON.stringify(cur.error ?? null)}`);
    }
    return cur;
  }

  async function fetchAndHash(url: string): Promise<{ sha256: string; mediaType: string }> {
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`panel-replicate-adapter: download ${res.status} for ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const ct = (res.headers.get?.('content-type') || '').split(';')[0].trim();
    const mediaType = ct || mimeFromUrl(url);
    return { sha256, mediaType };
  }

  function normalizeOutput(output: ReplicatePrediction['output']): string[] {
    if (!output) return [];
    if (typeof output === 'string') return [output];
    if (Array.isArray(output)) return output.filter((u): u is string => typeof u === 'string');
    return [];
  }

  async function run(kind: MediaKind, input: RunInput): Promise<RunResult> {
    if (!input?.model) throw new Error('panel-replicate-adapter: model required');
    const created = await createPrediction(input.model, input.input || {});
    const final = await pollUntilDone(created);
    const urls = normalizeOutput(final.output);
    const emits: RunResult['emits'] = [];
    for (const url of urls) {
      const { sha256, mediaType } = await fetchAndHash(url);
      const result = await opts.panelClient.emitMedia({
        url,
        type: kind,
        mediaType,
        prompt: input.prompt,
        groundTruth: input.groundTruth,
        externalRef: input.externalRef ? `${input.externalRef}:${urls.indexOf(url)}` : `replicate:${final.id}:${urls.indexOf(url)}`,
        extra: {
          provider: 'replicate',
          replicate_prediction_id: final.id,
          replicate_model: input.model,
          sha256,
          ...(input.extra || {}),
        },
      });
      emits.push({ url, sha256, mediaType, result });
    }
    return { prediction: final, emits };
  }

  return {
    runImage: (i) => run('image', i),
    runVideo: (i) => run('video', i),
  };
}

// best-effort mime guess from a url's path extension.
export function mimeFromUrl(url: string): string {
  const m = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  if (!m) return 'application/octet-stream';
  const ext = m[1];
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  };
  return map[ext] ?? 'application/octet-stream';
}
