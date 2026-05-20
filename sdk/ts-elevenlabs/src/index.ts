// panel-elevenlabs-adapter: reference adapter showing how to wrap elevenlabs
// text-to-speech and emit produced audio to panel via panel-sdk.
//
// thin (~100 lines incl types). copy/modify rather than treat as a deep
// first-party integration. api keys stay server-side.
//
// audio caveat: panel-sdk's MediaKind already includes 'audio', but the
// server `/api/units/ingest` route currently accepts only image|video for
// media_origin/media_quality units. audio_quality + audio_origin unit types
// are deferred (see panel TODO). this adapter still emits with type:'audio'
// — when the server flips, no client change is required. until then, expect
// a 4xx from the ingest endpoint and treat this adapter as a forward-compat
// shim. operators can also wrap a hosted-url upload step before emitMedia.

import { createHash } from 'node:crypto';
import type { PanelClient, GroundTruth, EmitResult } from 'panel-sdk';

export interface ElevenLabsAdapterOptions {
  /** elevenlabs api key. server-side only. never ship to browsers. */
  apiKey: string;
  /** panel client (from createClient in panel-sdk). */
  panelClient: PanelClient;
  /** override fetch for tests/edge. defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** override base url. defaults to https://api.elevenlabs.io. */
  base?: string;
  /** default modelId if synthesize() omits it. defaults to eleven_multilingual_v2. */
  defaultModelId?: string;
  /**
   * how to surface the audio bytes as a url to panel. tts returns binary,
   * but panel.emitMedia wants a url. by default we encode bytes as a
   * `data:audio/mpeg;base64,...` url so the unit is self-contained. operators
   * who upload to s3/gcs first can pass `uploader` to override.
   */
  uploader?: (bytes: Buffer, mediaType: string) => Promise<string>;
}

export interface SynthesizeInput {
  /** text to synthesize. */
  text: string;
  /** elevenlabs voice id. used in the request path. */
  voiceId: string;
  /** elevenlabs model id. defaults to eleven_multilingual_v2. */
  modelId?: string;
  /** prompt context to attach to the emitted unit (optional). */
  prompt?: string;
  /** if known, label as 'ai' (almost always for tts) or 'real'. */
  groundTruth?: GroundTruth;
  /** opaque extra metadata merged into unit.meta. */
  extra?: Record<string, unknown>;
  /** caller-supplied external ref for idempotency. */
  externalRef?: string;
}

export interface SynthesizeResult {
  /** sha256 of the audio bytes. */
  sha256: string;
  /** mime type (always audio/mpeg from this endpoint). */
  mediaType: string;
  /** url that was emitted (hosted url if uploader set, else data: url). */
  url: string;
  /** byte length of the audio. */
  bytes: number;
  /** panel emit result. */
  result: EmitResult;
}

export interface ElevenLabsAdapter {
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}

const DEFAULT_BASE = 'https://api.elevenlabs.io';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

export function createElevenLabsAdapter(opts: ElevenLabsAdapterOptions): ElevenLabsAdapter {
  if (!opts?.apiKey) throw new Error('panel-elevenlabs-adapter: apiKey required');
  if (!opts?.panelClient) throw new Error('panel-elevenlabs-adapter: panelClient required');
  const fetchImpl = opts.fetch ?? (globalThis as any).fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('panel-elevenlabs-adapter: no fetch available; pass opts.fetch on older runtimes');
  }
  const base = (opts.base ?? DEFAULT_BASE).replace(/\/$/, '');
  const defaultModel = opts.defaultModelId ?? DEFAULT_MODEL;

  return {
    async synthesize(input) {
      if (!input?.text) throw new Error('panel-elevenlabs-adapter: text required');
      if (!input?.voiceId) throw new Error('panel-elevenlabs-adapter: voiceId required');
      const modelId = input.modelId ?? defaultModel;
      const path = `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`;

      const res = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: {
          'xi-api-key': opts.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({ text: input.text, model_id: modelId }),
      });
      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(`panel-elevenlabs-adapter: elevenlabs api ${res.status}: ${text}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const sha256 = createHash('sha256').update(buf).digest('hex');
      const mediaType = (res.headers.get?.('content-type') || 'audio/mpeg').split(';')[0].trim();

      const url = opts.uploader
        ? await opts.uploader(buf, mediaType)
        : `data:${mediaType};base64,${buf.toString('base64')}`;

      const result = await opts.panelClient.emitMedia({
        url,
        type: 'audio',
        mediaType,
        prompt: input.prompt,
        groundTruth: input.groundTruth,
        externalRef: input.externalRef,
        extra: {
          provider: 'elevenlabs',
          elevenlabs_voice_id: input.voiceId,
          elevenlabs_model_id: modelId,
          sha256,
          bytes: buf.length,
          ...(input.extra || {}),
        },
      });

      return { sha256, mediaType, url, bytes: buf.length, result };
    },
  };
}

async function safeText(res: any): Promise<string> {
  try { return await res.text(); } catch { return '<unreadable>'; }
}
