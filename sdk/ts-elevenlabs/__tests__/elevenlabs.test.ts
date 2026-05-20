// tests for panel-elevenlabs-adapter. fetch is fully mocked — no live calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createElevenLabsAdapter } from '../src/index.js';
import type { PanelClient } from 'panel-sdk';

interface Captured { url: string; init?: any }

function mockPanel() {
  const calls: any[] = [];
  const client: PanelClient = {
    async emitMedia(input) { calls.push(input); return { ok: true, status: 200, id: 'u_e', ids: ['u_e'] }; },
    async emitProcessOutput() { return { ok: true, status: 200 }; },
    async emitSkillDiff() { return { ok: true, status: 200 }; },
    async emitRaw() { return { ok: true, status: 200 }; },
  };
  return { client, calls };
}

function audioResp(bytes: Uint8Array, status = 200, contentType = 'audio/mpeg') {
  return new Response(bytes as any, { status, headers: { 'Content-Type': contentType } });
}

function recordingFetch(handler: (url: string, init?: any) => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const fn = (async (url: string, init?: any) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test('synthesize: happy path posts to tts endpoint, hashes bytes, emits via panel-sdk', async () => {
  const audio = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0]); // ID3 header bytes
  const expectSha = createHash('sha256').update(audio).digest('hex');
  const { fn, calls } = recordingFetch(() => audioResp(audio));
  const { client, calls: emits } = mockPanel();
  const adapter = createElevenLabsAdapter({ apiKey: 'xi_test', panelClient: client, fetch: fn });

  const r = await adapter.synthesize({ text: 'hello world', voiceId: 'voice_abc', prompt: 'narration', groundTruth: 'ai' });

  assert.equal(r.sha256, expectSha);
  assert.equal(r.mediaType, 'audio/mpeg');
  assert.equal(r.bytes, audio.length);
  assert.match(r.url, /^data:audio\/mpeg;base64,/);

  // request shape
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/text-to-speech/voice_abc');
  assert.equal(calls[0].init.method, 'POST');
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h['xi-api-key'], 'xi_test');
  assert.equal(h['Content-Type'], 'application/json');
  assert.equal(h['Accept'], 'audio/mpeg');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.text, 'hello world');
  assert.equal(body.model_id, 'eleven_multilingual_v2'); // default fallback

  // emit shape
  assert.equal(emits.length, 1);
  assert.equal(emits[0].type, 'audio');
  assert.equal(emits[0].mediaType, 'audio/mpeg');
  assert.equal(emits[0].prompt, 'narration');
  assert.equal(emits[0].groundTruth, 'ai');
  assert.equal((emits[0].extra as any).provider, 'elevenlabs');
  assert.equal((emits[0].extra as any).elevenlabs_voice_id, 'voice_abc');
  assert.equal((emits[0].extra as any).elevenlabs_model_id, 'eleven_multilingual_v2');
  assert.equal((emits[0].extra as any).sha256, expectSha);
  assert.equal((emits[0].extra as any).bytes, audio.length);
});

test('default modelId is eleven_multilingual_v2', async () => {
  const { fn, calls } = recordingFetch(() => audioResp(new Uint8Array([1, 2])));
  const { client } = mockPanel();
  const adapter = createElevenLabsAdapter({ apiKey: 'k', panelClient: client, fetch: fn });
  await adapter.synthesize({ text: 'hi', voiceId: 'v1' });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model_id, 'eleven_multilingual_v2');
});

test('explicit modelId overrides default', async () => {
  const { fn, calls } = recordingFetch(() => audioResp(new Uint8Array([1])));
  const { client } = mockPanel();
  const adapter = createElevenLabsAdapter({ apiKey: 'k', panelClient: client, fetch: fn });
  await adapter.synthesize({ text: 'hi', voiceId: 'v1', modelId: 'eleven_turbo_v2' });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model_id, 'eleven_turbo_v2');
});

test('voiceId is path-encoded (special chars do not break the url)', async () => {
  const { fn, calls } = recordingFetch(() => audioResp(new Uint8Array([1])));
  const { client } = mockPanel();
  const adapter = createElevenLabsAdapter({ apiKey: 'k', panelClient: client, fetch: fn });
  await adapter.synthesize({ text: 'hi', voiceId: 'voice/with spaces?id' });
  assert.equal(
    calls[0].url,
    'https://api.elevenlabs.io/v1/text-to-speech/voice%2Fwith%20spaces%3Fid'
  );
  assert.equal((calls[0].init.headers as any)['xi-api-key'], 'k');
});

test('api 4xx surfaces as error with status', async () => {
  const { fn } = recordingFetch(() => new Response('bad voice', { status: 422, headers: { 'Content-Type': 'text/plain' } }));
  const { client } = mockPanel();
  const adapter = createElevenLabsAdapter({ apiKey: 'k', panelClient: client, fetch: fn });
  await assert.rejects(
    () => adapter.synthesize({ text: 'hi', voiceId: 'v1' }),
    /elevenlabs api 422/
  );
});

test('byte hashing: sha256 over downloaded audio bytes', async () => {
  const data = new TextEncoder().encode('this is fake audio');
  const expect = createHash('sha256').update(data).digest('hex');
  const { fn } = recordingFetch(() => audioResp(data));
  const { client, calls: emits } = mockPanel();
  const adapter = createElevenLabsAdapter({ apiKey: 'k', panelClient: client, fetch: fn });
  const r = await adapter.synthesize({ text: 'hi', voiceId: 'v1' });
  assert.equal(r.sha256, expect);
  assert.equal((emits[0].extra as any).sha256, expect);
});

test('uploader override: emitted url is the uploaded url, not data:', async () => {
  const { fn } = recordingFetch(() => audioResp(new Uint8Array([1, 2, 3])));
  const { client, calls: emits } = mockPanel();
  const adapter = createElevenLabsAdapter({
    apiKey: 'k',
    panelClient: client,
    fetch: fn,
    uploader: async (bytes, mt) => `https://cdn.example.com/${bytes.length}.${mt.split('/')[1]}`,
  });
  const r = await adapter.synthesize({ text: 'hi', voiceId: 'v1' });
  assert.equal(r.url, 'https://cdn.example.com/3.mpeg');
  assert.equal(emits[0].url, 'https://cdn.example.com/3.mpeg');
});
