// emit*() must produce headers + body shape the ingest route expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '../src/index.js';

interface Captured {
  url: string;
  init: RequestInit;
}

function mockFetch(status = 200, body: any = { ok: true, ids: ['u_ing_abc'] }) {
  const calls: Captured[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test('emitMedia posts to /api/units/ingest with signed body', async () => {
  const { fn, calls } = mockFetch();
  const c = createClient({ siteKey: 'k1', secret: 's1', base: 'http://localhost:3015', fetch: fn });
  const r = await c.emitMedia({ url: 'https://ex/cat.png', type: 'image', mediaType: 'image/png', groundTruth: 'real', prompt: 'a cat' });

  assert.equal(r.ok, true);
  assert.equal(r.id, 'u_ing_abc');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:3015/api/units/ingest');
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h['X-Panel-Site-Key'], 'k1');
  assert.equal(h['Content-Type'], 'application/json');
  const body = calls[0].init.body as string;
  const expectSig = createHmac('sha256', 's1').update(body).digest('hex');
  assert.equal(h['X-Panel-Ingest-Sig'], expectSig);

  const arr = JSON.parse(body);
  assert.equal(Array.isArray(arr), true);
  assert.equal(arr[0].type, 'media_origin');
  assert.equal(arr[0].media_url, 'https://ex/cat.png');
  assert.equal(arr[0].media_type, 'image');
  assert.equal(arr[0].ground_truth, 'real');
  assert.equal(arr[0].prompt_context, 'a cat');
  assert.equal(arr[0].meta.mime, 'image/png');
});

test('emitMedia without groundTruth becomes media_quality', async () => {
  const { fn, calls } = mockFetch();
  const c = createClient({ siteKey: 'k', secret: 's', fetch: fn });
  await c.emitMedia({ url: 'https://ex/v.mp4', type: 'video', mediaType: 'video/mp4' });
  const arr = JSON.parse(calls[0].init.body as string);
  assert.equal(arr[0].type, 'media_quality');
  assert.ok(!('ground_truth' in arr[0]));
});

test('default base is panel.goku.codes', async () => {
  const { fn, calls } = mockFetch();
  const c = createClient({ siteKey: 'k', secret: 's', fetch: fn });
  await c.emitMedia({ url: 'https://ex/x.png', type: 'image', mediaType: 'image/png' });
  assert.equal(calls[0].url, 'https://panel.goku.codes/api/units/ingest');
});

test('emitProcessOutput maps to process_output_rating', async () => {
  const { fn, calls } = mockFetch();
  const c = createClient({ siteKey: 'k', secret: 's', fetch: fn });
  await c.emitProcessOutput({ kind: 'shell', content: 'ran ls', context: 'task: list files' });
  const arr = JSON.parse(calls[0].init.body as string);
  assert.equal(arr[0].type, 'process_output_rating');
  assert.equal(arr[0].passage, 'ran ls');
  assert.equal(arr[0].prompt_context, 'task: list files');
  assert.equal(arr[0].meta.kind, 'shell');
});

test('emitSkillDiff maps to skill_diff_review with diff blob', async () => {
  const { fn, calls } = mockFetch();
  const c = createClient({ siteKey: 'k', secret: 's', fetch: fn });
  await c.emitSkillDiff({ skill: 'foo', before: 'old text', after: 'new text' });
  const arr = JSON.parse(calls[0].init.body as string);
  assert.equal(arr[0].type, 'skill_diff_review');
  assert.match(arr[0].diff, /old text/);
  assert.match(arr[0].diff, /new text/);
  assert.equal(arr[0].meta.skill, 'foo');
});

test('non-2xx returns ok:false with error code', async () => {
  const { fn } = mockFetch(401, { error: 'bad_signature' });
  const c = createClient({ siteKey: 'k', secret: 's', fetch: fn });
  const r = await c.emitMedia({ url: 'https://ex/x.png', type: 'image', mediaType: 'image/png' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'bad_signature');
  assert.equal(r.status, 401);
});

test('createClient validates required opts', () => {
  assert.throws(() => createClient({ siteKey: '', secret: 's' } as any), /siteKey/);
  assert.throws(() => createClient({ siteKey: 'k', secret: '' } as any), /secret/);
});
