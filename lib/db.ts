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
  `);
  return d;
}
