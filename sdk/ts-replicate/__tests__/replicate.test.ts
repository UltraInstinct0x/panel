// tests for panel-replicate-adapter. fetch is fully mocked — no live calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReplicateAdapter, mimeFromUrl } from '../src/index.js';
import type { PanelClient } from 'panel-sdk';

interface Captured { url: string; init?: any }

function mockPanel() {
  const calls: any[] = [];
  const client: PanelClient = {
    async emitMedia(input) { calls.push(input); return { ok: true, status: 200, id: 'u_x', ids: ['u_x'] }; },
    async emitProcessOutput() { return { ok: true, status: 200 }; },
    async emitSkillDiff() { return { ok: true, status: 200 }; },
    async emitRaw() { return { ok: true, status: 200 }; },
  };
  return { client, calls };
}

function jsonResp(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function bytesResp(bytes: Uint8Array, contentType: string, status = 200) {
  return new Response(bytes as any, { status, headers: { 'Content-Type': contentType } });
}

function scriptedFetch(handlers: Array<(url: string, init?: any) => Response | Promise<Response>>) {
  const calls: Captured[] = [];
  let i = 0;
  const fn = (async (url: string, init?: any) => {
    calls.push({ url, init });
    const h = handlers[i++];
    if (!h) throw new Error(`unexpected fetch #${i}: ${url}`);
    return h(url, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const noSleep = async () => {};

test('runImage: happy path posts prediction, polls, downloads, hashes, emits', async () => {
  const png = new Uint8Array([1, 2, 3, 4, 5]);
  const expectSha = createHash('sha256').update(png).digest('hex');
  const { fn, calls } = scriptedFetch([
    () => jsonResp(201, { id: 'p1', status: 'starting', output: null, urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }),
    () => jsonResp(200, { id: 'p1', status: 'processing', output: null, urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }),
    () => jsonResp(200, { id: 'p1', status: 'succeeded', output: ['https://cdn.replicate.com/out/cat.png'], urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }),
    () => bytesResp(png, 'image/png'),
  ]);
  const { client, calls: emits } = mockPanel();
  const adapter = createReplicateAdapter({ replicateToken: 'r_tok', panelClient: client, fetch: fn, sleep: noSleep });
  const r = await adapter.runImage({ model: 'stability-ai/sdxl', input: { prompt: 'a cat' }, prompt: 'a cat', groundTruth: 'ai' });

  assert.equal(r.prediction.status, 'succeeded');
  assert.equal(r.emits.length, 1);
  assert.equal(r.emits[0].sha256, expectSha);
  assert.equal(r.emits[0].mediaType, 'image/png');
  // first call: POST predictions
  assert.equal(calls[0].url, 'https://api.replicate.com/v1/predictions');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as any)['Authorization'], 'Token r_tok');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, 'stability-ai/sdxl');
  assert.deepEqual(body.input, { prompt: 'a cat' });
  // emit
  assert.equal(emits.length, 1);
  assert.equal(emits[0].url, 'https://cdn.replicate.com/out/cat.png');
  assert.equal(emits[0].type, 'image');
  assert.equal(emits[0].mediaType, 'image/png');
  assert.equal(emits[0].groundTruth, 'ai');
  assert.equal((emits[0].extra as any).sha256, expectSha);
  assert.equal((emits[0].extra as any).provider, 'replicate');
  assert.equal((emits[0].extra as any).replicate_prediction_id, 'p1');
});

test('runVideo: emits with type=video and detects mediaType from url extension', async () => {
  const mp4 = new Uint8Array([9, 9, 9]);
  const { fn } = scriptedFetch([
    () => jsonResp(201, { id: 'p2', status: 'succeeded', output: 'https://cdn.replicate.com/v.mp4' }),
    // download has no Content-Type — fall back to extension
    () => new Response(mp4, { status: 200 }),
  ]);
  const { client, calls: emits } = mockPanel();
  const adapter = createReplicateAdapter({ replicateToken: 't', panelClient: client, fetch: fn, sleep: noSleep });
  const r = await adapter.runVideo({ model: 'someorg/somevideomodel', input: {} });

  assert.equal(r.emits.length, 1);
  assert.equal(emits[0].type, 'video');
  // no Content-Type header -> falls back to ext map
  assert.equal(emits[0].mediaType, 'video/mp4');
});

test('mediaType detection helper: extension map', () => {
  assert.equal(mimeFromUrl('https://x/y.png'), 'image/png');
  assert.equal(mimeFromUrl('https://x/y.JPG?sig=abc'), 'image/jpeg');
  assert.equal(mimeFromUrl('https://x/y.mp4#frag'), 'video/mp4');
  assert.equal(mimeFromUrl('https://x/y.webm'), 'video/webm');
  assert.equal(mimeFromUrl('https://x/no-ext'), 'application/octet-stream');
});

test('replicate api 4xx surfaces as error', async () => {
  const { fn } = scriptedFetch([
    () => jsonResp(401, { detail: 'unauthorized' }),
  ]);
  const { client } = mockPanel();
  const adapter = createReplicateAdapter({ replicateToken: 'bad', panelClient: client, fetch: fn, sleep: noSleep });
  await assert.rejects(
    () => adapter.runImage({ model: 'foo/bar', input: {} }),
    /replicate api 401/
  );
});

test('polling timeout fires when status never settles', async () => {
  // every poll returns processing.
  const fn = (async () => jsonResp(200, { id: 'p3', status: 'processing', output: null, urls: { get: 'https://api.replicate.com/v1/predictions/p3' } })) as unknown as typeof fetch;
  const { client } = mockPanel();
  const adapter = createReplicateAdapter({
    replicateToken: 't',
    panelClient: client,
    fetch: fn,
    sleep: noSleep,
    pollTimeoutMs: 5, // tiny — ensures Date.now()-started > timeout after first sleep
  });
  await assert.rejects(
    () => adapter.runImage({ model: 'foo/bar', input: {} }),
    /polling timeout/
  );
});

test('hash + emit assertions: sha256 over downloaded bytes', async () => {
  const data = new TextEncoder().encode('hello-bytes-1234');
  const expect = createHash('sha256').update(data).digest('hex');
  const { fn } = scriptedFetch([
    () => jsonResp(201, { id: 'p4', status: 'succeeded', output: ['https://cdn/x.webp'] }),
    () => bytesResp(data, 'image/webp'),
  ]);
  const { client, calls } = mockPanel();
  const adapter = createReplicateAdapter({ replicateToken: 't', panelClient: client, fetch: fn, sleep: noSleep });
  const r = await adapter.runImage({ model: 'foo/bar', input: {} });
  assert.equal(r.emits[0].sha256, expect);
  assert.equal((calls[0].extra as any).sha256, expect);
});

test('64-char hex model is sent as version not model', async () => {
  const ver = 'a'.repeat(64);
  const { fn, calls } = scriptedFetch([
    () => jsonResp(201, { id: 'p5', status: 'succeeded', output: [] }),
  ]);
  const { client } = mockPanel();
  const adapter = createReplicateAdapter({ replicateToken: 't', panelClient: client, fetch: fn, sleep: noSleep });
  await adapter.runImage({ model: ver, input: {} });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.version, ver);
  assert.ok(!('model' in body));
});
