// landing smoke tests — verify / and /how-it-works return 200 against a running panel.
// usage: PANEL_URL=http://127.0.0.1:3015 node --test __tests__/landing.test.mjs
// CI can also run: pnpm exec next start &  then this.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.PANEL_URL || 'http://127.0.0.1:3015';

async function fetchOk(path, method = 'GET') {
  const res = await fetch(BASE + path, { method, redirect: 'manual' });
  return { status: res.status, body: method === 'GET' ? await res.text() : '' };
}

test('GET / returns 200 with hero copy', async () => {
  const r = await fetchOk('/');
  assert.equal(r.status, 200);
  assert.match(r.body, /proof-of-humanity that produces signal/i);
  assert.match(r.body, /L1/);
  assert.match(r.body, /L2/);
  assert.match(r.body, /L3/);
});

test('GET /how-it-works returns 200 with loop diagram', async () => {
  const r = await fetchOk('/how-it-works');
  assert.equal(r.status, 200);
  assert.match(r.body, /ladder/i);
  assert.match(r.body, /emitter/i);
  assert.match(r.body, /marketplace loop/i);
});

test('HEAD / returns 200', async () => {
  const r = await fetchOk('/', 'HEAD');
  assert.equal(r.status, 200);
});
