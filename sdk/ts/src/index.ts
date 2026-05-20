// panel-sdk: emit media + agent units to panel.goku.codes with hmac signing.
// runtime: node 18+, edge runtimes (vercel/cloudflare). do NOT ship the secret to browsers.

import { sign, assertServerOnly } from './sign.js';

export interface ClientOptions {
  /** ingest site key, per-key issued by panel. sent as X-Panel-Site-Key. */
  siteKey: string;
  /** per-key shared secret. used to hmac-sign the request body. server-side only. */
  secret: string;
  /** panel base url. defaults to https://panel.goku.codes. */
  base?: string;
  /** override fetch impl (for tests/edge). defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** opt-in escape hatch for browser usage. footgun. */
  allowBrowser?: boolean;
}

export type MediaKind = 'image' | 'video' | 'audio';
export type GroundTruth = 'real' | 'ai' | null | undefined;

export interface EmitMediaInput {
  /** http(s) url of the media asset. */
  url: string;
  /** media kind. note: server currently accepts image|video; audio is forwarded but may be rejected server-side. */
  type: MediaKind;
  /** mime type (e.g. image/png). stored in meta. */
  mediaType: string;
  /** prompt or context that produced this media (optional). */
  prompt?: string;
  /** if known, label as real or ai-generated. drives media_origin (truth-bearing) vs media_quality. */
  groundTruth?: GroundTruth;
  /** opaque extra metadata to merge into unit.meta. */
  extra?: Record<string, unknown>;
  /** caller-supplied external ref for idempotency. */
  externalRef?: string;
  /** override source_agent label. defaults to siteKey. */
  sourceAgent?: string;
}

export interface EmitProcessOutputInput {
  /** short label for the output kind (e.g. "shell", "tool_call"). stored as source_agent suffix/meta. */
  kind: string;
  /** the agent output text. becomes the rated passage. */
  content: string;
  /** optional surrounding context (prompt, task description). */
  context?: string;
  externalRef?: string;
}

export interface EmitSkillDiffInput {
  /** skill name/id. */
  skill: string;
  /** previous skill text. */
  before: string;
  /** proposed skill text. */
  after: string;
  externalRef?: string;
}

export interface EmitResult {
  ok: boolean;
  /** first accepted unit id, when ok. */
  id?: string;
  /** all accepted ids. */
  ids?: string[];
  /** error code from server, when !ok. */
  error?: string;
  /** raw server response body (parsed when json). */
  raw?: unknown;
  /** http status. */
  status: number;
}

export interface PanelClient {
  emitMedia(input: EmitMediaInput): Promise<EmitResult>;
  emitProcessOutput(input: EmitProcessOutputInput): Promise<EmitResult>;
  emitSkillDiff(input: EmitSkillDiffInput): Promise<EmitResult>;
  /** low-level: emit one or more raw unit dicts. body is signed and posted as-is. */
  emitRaw(units: unknown | unknown[]): Promise<EmitResult>;
}

const DEFAULT_BASE = 'https://panel.goku.codes';

export function createClient(opts: ClientOptions): PanelClient {
  if (!opts?.siteKey) throw new Error('panel-sdk: siteKey required');
  if (!opts?.secret) throw new Error('panel-sdk: secret required');
  assertServerOnly(opts.allowBrowser);

  const base = (opts.base ?? DEFAULT_BASE).replace(/\/$/, '');
  const fetchImpl = opts.fetch ?? (globalThis as any).fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('panel-sdk: no fetch available; pass opts.fetch on older runtimes');
  }

  async function post(units: unknown | unknown[]): Promise<EmitResult> {
    // server accepts a single unit, an array, or { units: [...] }.
    // we always send the array form for predictability.
    const arr = Array.isArray(units) ? units : [units];
    const body = JSON.stringify(arr);
    const sig = await sign(opts.secret, body);
    const res = await fetchImpl(`${base}/api/units/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Panel-Site-Key': opts.siteKey,
        'X-Panel-Ingest-Sig': sig,
      },
      body,
    });
    const text = await res.text();
    let parsed: any = undefined;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: parsed?.error || `http_${res.status}`,
        raw: parsed ?? text,
      };
    }
    const ids: string[] | undefined = Array.isArray(parsed?.ids) ? parsed.ids : undefined;
    return {
      ok: true,
      status: res.status,
      id: ids?.[0],
      ids,
      raw: parsed ?? text,
    };
  }

  return {
    async emitMedia(input) {
      if (!input?.url) throw new Error('panel-sdk: emitMedia requires url');
      // truth-bearing -> media_origin; otherwise media_quality.
      const hasTruth = input.groundTruth === 'real' || input.groundTruth === 'ai';
      const unitType = hasTruth ? 'media_origin' : 'media_quality';
      const unit: Record<string, unknown> = {
        type: unitType,
        source_agent: input.sourceAgent || opts.siteKey,
        media_url: input.url,
        media_type: input.type,
        prompt_context: input.prompt || '',
        meta: {
          mime: input.mediaType,
          ...(input.extra || {}),
        },
      };
      if (hasTruth) unit.ground_truth = input.groundTruth;
      if (input.externalRef) unit.external_ref = input.externalRef;
      return post(unit);
    },

    async emitProcessOutput(input) {
      if (!input?.content) throw new Error('panel-sdk: emitProcessOutput requires content');
      // mapped to server-side process_output_rating.
      const unit: Record<string, unknown> = {
        type: 'process_output_rating',
        source_agent: opts.siteKey,
        passage: input.content,
        prompt_context: input.context || '',
        meta: { kind: input.kind },
      };
      if (input.externalRef) unit.external_ref = input.externalRef;
      return post(unit);
    },

    async emitSkillDiff(input) {
      if (!input?.skill) throw new Error('panel-sdk: emitSkillDiff requires skill');
      // mapped to server-side skill_diff_review. diff is a unified-style before/after blob.
      const diff =
        `--- ${input.skill} (before)\n+++ ${input.skill} (after)\n` +
        `${input.before}\n---\n${input.after}\n`;
      const unit: Record<string, unknown> = {
        type: 'skill_diff_review',
        source_agent: opts.siteKey,
        diff,
        prompt_context: input.skill,
        meta: { skill: input.skill },
      };
      if (input.externalRef) unit.external_ref = input.externalRef;
      return post(unit);
    },

    emitRaw(units) {
      return post(units);
    },
  };
}

export { sign } from './sign.js';
