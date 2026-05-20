// minimal in-memory mock websocket server for tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createComfyAdapter, loadWorkflow } from '../src/index.js';

class MockWS extends EventEmitter {
  closed = false;
  url: string;
  static script: ((ws: MockWS) => void) | null = null;
  constructor(url: string) {
    super();
    this.url = url;
    setImmediate(() => MockWS.script?.(this));
  }
  close() { this.closed = true; this.emit('close'); }
  on(ev: string, fn: (...a: any[]) => void): this { return super.on(ev, fn); }
}

function mockClient() {
  const calls: any[] = [];
  let nextId = 1;
  const client: any = {
    emitMedia: async (input: any) => {
      calls.push({ kind: 'emitMedia', input });
      return { ok: true, id: `u_${nextId++}`, status: 200, ids: [`u_${nextId-1}`] };
    },
    emitProcessOutput: async () => ({ ok: true, status: 200, id: 'x' }),
    emitSkillDiff: async () => ({ ok: true, status: 200, id: 'x' }),
    emitRaw: async () => ({ ok: true, status: 200 }),
    _calls: calls,
  };
  return client;
}

function fakeFetch(routes: Record<string, (req: any) => any>) {
  return async (url: string, init?: any) => {
    const u = new URL(url);
    const key = `${init?.method ?? 'GET'} ${u.pathname}`;
    const handler = routes[key] ?? routes[u.pathname];
    if (!handler) throw new Error(`unmocked: ${key}`);
    return handler({ url, init, query: u.searchParams });
  };
}

test('submit happy path: 2 outputs emitted with sha256', async () => {
  const png1 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const png2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]);
  const fetchImpl: any = fakeFetch({
    'POST /prompt': () => new Response(JSON.stringify({ prompt_id: 'p1', number: 1, node_errors: {} }), { status: 200 }),
    '/view': ({ query }) => {
      const fn = query.get('filename');
      const buf = fn === 'a.png' ? png1 : png2;
      return new Response(buf, { status: 200, headers: { 'Content-Type': 'image/png' } });
    },
  });
  MockWS.script = (ws) => {
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'executed', data: { prompt_id: 'p1', output: { images: [
      { filename: 'a.png', subfolder: '', type: 'output' },
      { filename: 'b.png', subfolder: '', type: 'output' },
    ] } } })));
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'execution_success', data: { prompt_id: 'p1' } })));
  };
  const client = mockClient();
  const adapter = createComfyAdapter({
    comfyUrl: 'http://127.0.0.1:8188',
    panelClient: client,
    defaultWorkflow: { '1': { inputs: {}, class_type: 'KSampler' } },
    fetch: fetchImpl,
    WebSocketImpl: MockWS as any,
  });
  const r = await adapter.submit({ prompt: 'a pirate ship' });
  assert.equal(r.promptId, 'p1');
  assert.equal(r.units.length, 2);
  assert.match(r.units[0].sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(r.units[0].sha256, r.units[1].sha256);
  assert.equal(client._calls.length, 2);
  assert.equal(client._calls[0].input.type, 'image');
  assert.equal(client._calls[0].input.mediaType, 'image/png');
  assert.equal(client._calls[0].input.groundTruth, 'ai');
});

test('comfy /prompt 4xx throws', async () => {
  const fetchImpl: any = fakeFetch({
    'POST /prompt': () => new Response('bad workflow', { status: 400 }),
  });
  const adapter = createComfyAdapter({
    comfyUrl: 'http://127.0.0.1:8188',
    panelClient: mockClient(),
    defaultWorkflow: {},
    fetch: fetchImpl,
    WebSocketImpl: MockWS as any,
  });
  await assert.rejects(() => adapter.submit(), /comfy \/prompt 400/);
});

test('ws timeout rejects', async () => {
  const fetchImpl: any = fakeFetch({
    'POST /prompt': () => new Response(JSON.stringify({ prompt_id: 'pX' }), { status: 200 }),
  });
  MockWS.script = () => { /* never emits */ };
  const adapter = createComfyAdapter({
    comfyUrl: 'http://127.0.0.1:8188',
    panelClient: mockClient(),
    defaultWorkflow: {},
    fetch: fetchImpl,
    WebSocketImpl: MockWS as any,
    timeoutMs: 50,
  });
  await assert.rejects(() => adapter.submit(), /comfy ws timeout/);
});

test('panel emit failure propagates', async () => {
  const fetchImpl: any = fakeFetch({
    'POST /prompt': () => new Response(JSON.stringify({ prompt_id: 'p2' }), { status: 200 }),
    '/view': () => new Response(Buffer.from([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } }),
  });
  MockWS.script = (ws) => {
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'executed', data: { prompt_id: 'p2', output: { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] } } })));
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'execution_success', data: { prompt_id: 'p2' } })));
  };
  const badClient: any = {
    emitMedia: async () => ({ ok: false, status: 401, error: 'bad_signature' }),
  };
  const adapter = createComfyAdapter({
    comfyUrl: 'http://127.0.0.1:8188',
    panelClient: badClient,
    defaultWorkflow: {},
    fetch: fetchImpl,
    WebSocketImpl: MockWS as any,
  });
  await assert.rejects(() => adapter.submit(), /panel emit failed/);
});

test('public url without auth throws on construction', () => {
  assert.throws(() => createComfyAdapter({
    comfyUrl: 'https://comfy.example.com',
    panelClient: mockClient(),
    fetch: globalThis.fetch,
    WebSocketImpl: MockWS as any,
  }), /appears public/);
});

test('public url WITH auth is allowed', () => {
  assert.doesNotThrow(() => createComfyAdapter({
    comfyUrl: 'https://comfy.example.com',
    panelClient: mockClient(),
    auth: { header: 'Authorization', value: 'Bearer x' },
    fetch: globalThis.fetch,
    WebSocketImpl: MockWS as any,
  }));
});

test('private + tailscale + localhost hosts are allowed', () => {
  for (const h of ['http://127.0.0.1:8188', 'http://localhost:8188', 'http://10.0.0.5:8188', 'http://192.168.1.10:8188', 'http://100.64.0.5:8188', 'http://my-host.ts.net:8188']) {
    assert.doesNotThrow(() => createComfyAdapter({
      comfyUrl: h,
      panelClient: mockClient(),
      fetch: globalThis.fetch,
      WebSocketImpl: MockWS as any,
    }), `expected allowed: ${h}`);
  }
});

test('loadWorkflow: object passes through', async () => {
  const wf = { '1': {} };
  assert.equal(await loadWorkflow(wf), wf);
});

test('loadWorkflow: inline json string', async () => {
  const r = await loadWorkflow('{"a":1}');
  assert.deepEqual(r, { a: 1 });
});

test('loadWorkflow: invalid inline json throws', async () => {
  await assert.rejects(() => loadWorkflow('{not json'), /invalid inline json/);
});

test('loadWorkflow: local file path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-'));
  const p = join(dir, 'wf.json');
  writeFileSync(p, '{"hello":"world"}');
  const r = await loadWorkflow(p);
  assert.deepEqual(r, { hello: 'world' });
});
