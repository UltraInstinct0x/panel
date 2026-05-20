// sign() must be byte-identical to node createHmac('sha256').digest('hex').
// the panel ingest route verifies with exactly that primitive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sign } from '../src/sign.js';

test('sign matches node createHmac for ascii body', async () => {
  const secret = 'test-secret-123';
  const body = JSON.stringify([{ type: 'media_origin', media_url: 'https://x/y.png', media_type: 'image' }]);
  const got = await sign(secret, body);
  const want = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(got, want);
});

test('sign matches node createHmac for unicode body', async () => {
  const secret = 's3cret';
  const body = JSON.stringify({ msg: 'héllo 世界 🦊' });
  const got = await sign(secret, body);
  const want = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(got, want);
});

test('sign produces lowercase hex of length 64', async () => {
  const got = await sign('k', 'b');
  assert.match(got, /^[0-9a-f]{64}$/);
});

test('fixed reference vector', async () => {
  // hand-computed: hmac-sha256('secret', 'hello') = 88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b
  const got = await sign('secret', 'hello');
  assert.equal(got, '88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b');
});
