#!/usr/bin/env node
// WS-M migration: register pk_img_* site_key with scrubber_required=false (carve-out).
// idempotent. audited. run after deploy.
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.PANEL_DB_PATH || path.join(process.env.HOME, 'panel', 'data', 'panel.db');
const KEY = process.argv[2] || 'pk_img_3e9b8c028d0e';
const REASON = process.argv[3] || 'first-party img.goku.codes operator, modal pipeline pre-sanitizes';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ensure schema exists (no-op if panel already booted)
db.exec(`
  CREATE TABLE IF NOT EXISTS site_keys (
    site_key TEXT PRIMARY KEY,
    scrubber_required INTEGER NOT NULL DEFAULT 1,
    label TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, ts INTEGER NOT NULL, actor_kind TEXT NOT NULL, actor_id TEXT NOT NULL,
    action TEXT NOT NULL, target_table TEXT, target_id TEXT, meta_json TEXT
  );
`);

const existing = db.prepare('SELECT site_key, scrubber_required FROM site_keys WHERE site_key = ?').get(KEY);
const now = Date.now();
db.prepare(
  `INSERT INTO site_keys (site_key, scrubber_required, label, created_at)
   VALUES (?, 0, ?, ?)
   ON CONFLICT(site_key) DO UPDATE SET scrubber_required=0, label=excluded.label`,
).run(KEY, 'img.goku.codes (first-party)', now);

const auditId = `a_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
db.prepare(
  `INSERT INTO audit_log (id, ts, actor_kind, actor_id, action, target_table, target_id, meta_json)
   VALUES (?, ?, 'system', 'ws-m-migration', 'site_keys.scrubber_required.set_false', 'site_keys', ?, ?)`,
).run(auditId, now, KEY, JSON.stringify({ reason: REASON, prior: existing || null }));

console.log(`[ws-m] site_key=${KEY} scrubber_required=false. prior=${JSON.stringify(existing)}`);
db.close();
