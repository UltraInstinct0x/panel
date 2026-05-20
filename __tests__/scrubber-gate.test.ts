// WS-M scrubber gate — integration tests.
// runs against live panel @ http://127.0.0.1:3015 and scrubber-proxy @ http://127.0.0.1:3017.
// usage:
//   1) panel must be running with SCRUBBER_JWT_SECRET set (same as scrubber)
//   2) test site_keys must be registered (see ws-m-test-setup.js)
//   3) PANEL_INGEST_SECRET_PK_TEST_THIRDPARTY env present on panel
//   4) node panel/__tests__/scrubber-gate.test.ts  (via tsx, or compile-free pure JS-compatible TS)
'use strict';

const crypto = require('crypto');
const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');

const PANEL = process.env.PANEL_URL || 'http://127.0.0.1:3015';
const SCRUBBER = process.env.SCRUBBER_URL || 'http://127.0.0.1:3017';
const DB_PATH = process.env.PANEL_DB_PATH || path.join(process.env.HOME, 'panel', 'data', 'panel.db');

const THIRDPARTY_KEY = 'pk_test_thirdparty';
const THIRDPARTY_SECRET = process.env.PANEL_INGEST_SECRET_PK_TEST_THIRDPARTY || 'test_thirdparty_secret_do_not_ship';
const FIRSTPARTY_KEY = 'pk_img_3e9b8c028d0e';
const FIRSTPARTY_SECRET = process.env.PANEL_INGEST_SECRET_PK_IMG_3E9B8C028D0E || '';

function httpReq(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body == null ? null : (typeof body === 'string' ? Buffer.from(body) : Buffer.from(JSON.stringify(body)));
    const r = http.request({
      method, host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: { ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}), ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function hmacHex(secret, body) { return crypto.createHmac('sha256', secret).update(body).digest('hex'); }
function sha256Hex(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function forgeJwt(secret, payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${b64u(sig)}`;
}

// register test site_keys directly in panel db (test setup)
function setupSiteKeys() {
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS site_keys (
    site_key TEXT PRIMARY KEY, scrubber_required INTEGER NOT NULL DEFAULT 1, label TEXT, created_at INTEGER NOT NULL
  );`);
  const now = Date.now();
  db.prepare(`INSERT INTO site_keys (site_key, scrubber_required, label, created_at) VALUES (?, 1, 'test third-party', ?)
              ON CONFLICT(site_key) DO UPDATE SET scrubber_required=1`).run(THIRDPARTY_KEY, now);
  db.prepare(`INSERT INTO site_keys (site_key, scrubber_required, label, created_at) VALUES (?, 0, 'first-party img', ?)
              ON CONFLICT(site_key) DO UPDATE SET scrubber_required=0`).run(FIRSTPARTY_KEY, now);
  db.close();
}

function countAudit(action, since) {
  const db = new Database(DB_PATH, { readonly: true });
  const row = db.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE action = ? AND ts >= ?').get(action, since);
  db.close();
  return row.n;
}

let failed = 0;
function assert(cond, msg) { if (!cond) { console.error('FAIL', msg); failed++; } else { console.log('ok  ', msg); } }

async function makePayload() {
  return JSON.stringify({
    units: [{ type: 'ai_output_rating', external_ref: `t_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, image_url: 'https://example.com/x.png', source_agent: 'test', question: 'rate' }],
  });
}

(async () => {
  setupSiteKeys();
  const SECRET = process.env.SCRUBBER_JWT_SECRET;
  if (!SECRET) { console.error('SCRUBBER_JWT_SECRET required in test env'); process.exit(2); }

  // case 1: third-party key + no JWT → 422 scrubber_attestation_required
  {
    const raw = await makePayload();
    const res = await httpReq('POST', `${PANEL}/api/units/ingest`, {
      'x-panel-site-key': THIRDPARTY_KEY,
      'x-panel-ingest-sig': hmacHex(THIRDPARTY_SECRET, raw),
    }, raw);
    assert(res.status === 422 && res.body?.error === 'scrubber_attestation_required', 'case 1: missing JWT → 422 required');
  }

  // case 2: third-party key + stale JWT (iat=now-400) → 422 stale
  {
    const raw = await makePayload();
    const now = Math.floor(Date.now() / 1000);
    const jwt = forgeJwt(SECRET, { jti: crypto.randomBytes(16).toString('hex'), iat: now - 400, exp: now - 100, input_hash: 'x', output_hash: sha256Hex(raw), mode: 'text', engine_version: '0.2.0' });
    const res = await httpReq('POST', `${PANEL}/api/units/ingest`, {
      'x-panel-site-key': THIRDPARTY_KEY,
      'x-panel-ingest-sig': hmacHex(THIRDPARTY_SECRET, raw),
      'x-scrubber-attestation': jwt,
    }, raw);
    assert(res.status === 422 && res.body?.error === 'scrubber_attestation_stale', 'case 2: stale JWT → 422 stale');
  }

  // case 3: third-party key + wrong output_hash → 422 hash_mismatch
  {
    const raw = await makePayload();
    const now = Math.floor(Date.now() / 1000);
    const jwt = forgeJwt(SECRET, { jti: crypto.randomBytes(16).toString('hex'), iat: now, exp: now + 300, input_hash: 'x', output_hash: sha256Hex('not the body'), mode: 'text', engine_version: '0.2.0' });
    const res = await httpReq('POST', `${PANEL}/api/units/ingest`, {
      'x-panel-site-key': THIRDPARTY_KEY,
      'x-panel-ingest-sig': hmacHex(THIRDPARTY_SECRET, raw),
      'x-scrubber-attestation': jwt,
    }, raw);
    assert(res.status === 422 && res.body?.error === 'scrubber_attestation_hash_mismatch', 'case 3: wrong output_hash → 422 hash_mismatch');
  }

  // case 4: third-party key + valid fresh JWT → 200
  {
    const raw = await makePayload();
    const now = Math.floor(Date.now() / 1000);
    const jwt = forgeJwt(SECRET, { jti: crypto.randomBytes(16).toString('hex'), iat: now, exp: now + 300, input_hash: 'x', output_hash: sha256Hex(raw), mode: 'text', engine_version: '0.2.0' });
    const res = await httpReq('POST', `${PANEL}/api/units/ingest`, {
      'x-panel-site-key': THIRDPARTY_KEY,
      'x-panel-ingest-sig': hmacHex(THIRDPARTY_SECRET, raw),
      'x-scrubber-attestation': jwt,
    }, raw);
    assert(res.status === 200 && res.body?.ok === true, `case 4: valid fresh JWT → 200 (got ${res.status} ${JSON.stringify(res.body).slice(0,200)})`);
  }

  // case 5: first-party carve-out + no JWT → 200 + audit log entry
  if (FIRSTPARTY_SECRET && FIRSTPARTY_SECRET !== 'ing_e1...4c69') {
    const before = countAudit('ingest.scrubber_bypassed', 0);
    const raw = await makePayload();
    const res = await httpReq('POST', `${PANEL}/api/units/ingest`, {
      'x-panel-site-key': FIRSTPARTY_KEY,
      'x-panel-ingest-sig': hmacHex(FIRSTPARTY_SECRET, raw),
    }, raw);
    assert(res.status === 200, `case 5: carve-out key, no JWT → 200 (got ${res.status} ${JSON.stringify(res.body).slice(0,200)})`);
    const after = countAudit('ingest.scrubber_bypassed', 0);
    assert(after > before, `case 5: audit log entry added (before=${before} after=${after})`);
  } else {
    console.log('skip case 5: real PANEL_INGEST_SECRET_PK_IMG_3E9B8C028D0E not in test env (set it to run)');
  }

  if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1); }
  console.log('\nall green');
})().catch((e) => { console.error(e); process.exit(1); });
