#!/usr/bin/env node
// captures a real hermes session into the splitter ingest endpoint.
// usage: node scripts/ingest-real-trace.js <session.jsonl>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const Database = require('better-sqlite3');

const SESSION = process.argv[2] || path.join(process.env.HOME, '.hermes', 'sessions', '20260520_092238_f134bd.jsonl');
const PANEL = process.env.PANEL_URL || 'http://127.0.0.1:3015';
const SCRUBBER_SECRET = process.env.SCRUBBER_JWT_SECRET;
const SITE_KEY = 'pk_test_thirdparty';
const SITE_SECRET = process.env.PANEL_INGEST_SECRET_PK_TEST_THIRDPARTY;
const DB_PATH = process.env.PANEL_DB_PATH || path.join(process.env.HOME, 'panel', 'data', 'panel.db');

if (!SCRUBBER_SECRET || !SITE_SECRET) { console.error('need SCRUBBER_JWT_SECRET + PANEL_INGEST_SECRET_PK_TEST_THIRDPARTY'); process.exit(2); }

// register test site key (scrubber_required=1)
{
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS site_keys (site_key TEXT PRIMARY KEY, scrubber_required INTEGER NOT NULL DEFAULT 1, label TEXT, created_at INTEGER NOT NULL);`);
  db.prepare(`INSERT INTO site_keys (site_key, scrubber_required, label, created_at) VALUES (?,1,'splitter test',?) ON CONFLICT(site_key) DO UPDATE SET scrubber_required=1`).run(SITE_KEY, Date.now());
  db.close();
}

// parse session into messages
const lines = fs.readFileSync(SESSION, 'utf8').split('\n').filter(l => l.trim());
const messages = lines.map(l => JSON.parse(l)).slice(0, 25); // cap to keep blob<100KB

const body = JSON.stringify({
  trace_id: 'tr_real_' + path.basename(SESSION).slice(0, 16),
  source_agent: 'hermes',
  blob: { messages },
});

function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function jwt(secret, payload) {
  const h = { alg: 'HS256', typ: 'JWT' };
  const si = `${b64u(JSON.stringify(h))}.${b64u(JSON.stringify(payload))}`;
  return `${si}.${b64u(crypto.createHmac('sha256', secret).update(si).digest())}`;
}

const now = Math.floor(Date.now() / 1000);
const token = jwt(SCRUBBER_SECRET, { jti: crypto.randomBytes(16).toString('hex'), iat: now, exp: now + 300, input_hash: 'x', output_hash: sha256(body), mode: 'text', engine_version: '0.2.0' });
const sig = crypto.createHmac('sha256', SITE_SECRET).update(body).digest('hex');

const u = new URL(PANEL + '/api/v1/traces');
const req = http.request({ method: 'POST', host: u.hostname, port: u.port, path: u.pathname,
  headers: {
    'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
    'x-panel-site-key': SITE_KEY, 'x-panel-ingest-sig': sig, 'x-scrubber-attestation': token,
  } }, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => { console.log('status', res.statusCode); console.log(Buffer.concat(chunks).toString('utf8')); });
});
req.on('error', e => { console.error(e); process.exit(1); });
req.write(body); req.end();
