// sqlite-backed persistence. synchronous via better-sqlite3.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.PANEL_DB_DIR || path.join(process.cwd(), 'data');
const DB_PATH = process.env.PANEL_DB_PATH || path.join(DB_DIR, 'panel.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __panel_db__: Database.Database | undefined;
}

export const db: Database.Database =
  globalThis.__panel_db__ ?? (globalThis.__panel_db__ = openDb());

function openDb(): Database.Database {
  const d = new Database(DB_PATH);
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  d.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      pool TEXT NOT NULL DEFAULT 'public',
      is_honeypot INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_units_pool ON units(pool);

    CREATE TABLE IF NOT EXISTS raters (
      id TEXT PRIMARY KEY,
      trust REAL NOT NULL DEFAULT 0.5,
      judgments_count INTEGER NOT NULL DEFAULT 0,
      agreed_count INTEGER NOT NULL DEFAULT 0,
      earned_cents INTEGER NOT NULL DEFAULT 0,
      bot_flag INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS judgments (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      rater_id TEXT NOT NULL,
      choice TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      created_at INTEGER NOT NULL,
      agreed_with_gold INTEGER,
      honeypot_failed INTEGER NOT NULL DEFAULT 0,
      pool TEXT,
      site_key TEXT,
      behavioral_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_judg_rater ON judgments(rater_id);
    CREATE INDEX IF NOT EXISTS idx_judg_created ON judgments(created_at DESC);

    -- D-hardening: jti replay-prevention ledger (consumed attestation tokens)
    CREATE TABLE IF NOT EXISTS jti_consumed (
      jti TEXT PRIMARY KEY,
      consumed_at INTEGER NOT NULL,
      exp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jti_exp ON jti_consumed(exp);

    -- D-hardening: persisted token-bucket state (per-IP + per-key) for crash recovery.
    CREATE TABLE IF NOT EXISTS rate_buckets (
      key TEXT PRIMARY KEY,
      tokens REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return d;
}

// ---------- jti replay protection ----------

export function isJtiConsumed(jti: string): boolean {
  const row = db.prepare('SELECT 1 FROM jti_consumed WHERE jti = ?').get(jti);
  return !!row;
}

export function consumeJti(jti: string, exp: number): void {
  db.prepare('INSERT OR IGNORE INTO jti_consumed (jti, consumed_at, exp) VALUES (?, ?, ?)').run(
    jti,
    Date.now(),
    exp,
  );
}

export function gcJti(): number {
  const r = db.prepare('DELETE FROM jti_consumed WHERE exp < ?').run(Date.now() - 60_000);
  return r.changes;
}

// ---------- rate-bucket persistence ----------

export function loadBucket(key: string): { tokens: number; updated_at: number } | undefined {
  return db.prepare('SELECT tokens, updated_at FROM rate_buckets WHERE key = ?').get(key) as any;
}

export function saveBucket(key: string, tokens: number, updated_at: number): void {
  db.prepare(
    'INSERT INTO rate_buckets (key, tokens, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET tokens=excluded.tokens, updated_at=excluded.updated_at',
  ).run(key, tokens, updated_at);
}

// hourly GC of stale buckets (no traffic in >1h)
export function gcBuckets(): number {
  const r = db.prepare('DELETE FROM rate_buckets WHERE updated_at < ?').run(Date.now() - 3600_000);
  return r.changes;
}

// ---------- graceful shutdown ----------

let _shutdownRegistered = false;
export function registerShutdown(): void {
  if (_shutdownRegistered) return;
  _shutdownRegistered = true;
  const close = (sig: string) => {
    try {
      try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
      try { db.close(); } catch {}
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ evt: 'shutdown', sig, db: 'closed', ts: Date.now() }));
    } finally {
      // give in-flight responses a brief grace, then exit clean
      setTimeout(() => process.exit(0), 200).unref();
    }
  };
  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT', () => close('SIGINT'));
}
