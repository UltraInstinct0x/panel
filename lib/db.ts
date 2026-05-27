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
    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      email TEXT,
      tier TEXT NOT NULL DEFAULT 'selfhost',
      dunning_state TEXT NOT NULL DEFAULT 'ok',
      payment_failures INTEGER NOT NULL DEFAULT 0,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_operators_tier ON operators(tier);

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

    CREATE TABLE IF NOT EXISTS rater_ledger (
      rater_id TEXT PRIMARY KEY,
      judgments_total INTEGER NOT NULL DEFAULT 0,
      converged_judgments_total INTEGER NOT NULL DEFAULT 0,
      converged_agree_total INTEGER NOT NULL DEFAULT 0,
      agreement_rate REAL NOT NULL DEFAULT 0.5,
      calibration_events_total INTEGER NOT NULL DEFAULT 0,
      calibration_brier_sum REAL NOT NULL DEFAULT 0,
      calibration_score REAL NOT NULL DEFAULT 0.5,
      last_seen INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rater_ledger_last_seen ON rater_ledger(last_seen);
    CREATE INDEX IF NOT EXISTS idx_rater_ledger_judgments_total ON rater_ledger(judgments_total);

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

    -- WS-M: registered operator site_keys + scrubber-required flag.
    -- carve-out (scrubber_required=0) is OPT-IN per key, audited at creation.
    CREATE TABLE IF NOT EXISTS site_keys (
      site_key TEXT PRIMARY KEY,
      scrubber_required INTEGER NOT NULL DEFAULT 1,
      label TEXT,
      created_at INTEGER NOT NULL
    );

    -- WS-N: traces table. raw_blob_hash references the SCRUBBED blob hash;
    -- splitter never reads raw input — only the sanitized payload that came
    -- through the scrubber JWT gate.
    CREATE TABLE IF NOT EXISTS traces (
      trace_id TEXT PRIMARY KEY,
      operator_id TEXT,
      source_agent TEXT,
      raw_blob_hash TEXT,
      sanitized_at INTEGER,
      ingested_at INTEGER NOT NULL,
      scrubber_attestation_jti TEXT,
      blob_size INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'done',  -- 'pending' | 'done' | 'error'
      result_json TEXT,
      blob_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_traces_agent ON traces(source_agent);

    CREATE TABLE IF NOT EXISTS stripe_customers (
      operator_id TEXT PRIMARY KEY,
      stripe_customer_id TEXT NOT NULL,
      email TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      stripe_subscription_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      metered_price_id TEXT,
      base_price_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_operator ON subscriptions(operator_id);

    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      flushed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_usage_unflushed ON usage_events(flushed_at, operator_id, event_name);

    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      stripe_event_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_alerts (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      level TEXT NOT NULL,
      event_name TEXT NOT NULL,
      detail_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_billing_alerts_operator ON billing_alerts(operator_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS rater_accounts (
      rater_id TEXT PRIMARY KEY,
      stripe_account_id TEXT NOT NULL,
      country TEXT,
      payouts_enabled INTEGER NOT NULL DEFAULT 0,
      charges_enabled INTEGER NOT NULL DEFAULT 0,
      platform_fee_bps INTEGER NOT NULL DEFAULT 2000,
      design_partner_managed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rater_credits (
      id TEXT PRIMARY KEY,
      rater_id TEXT NOT NULL,
      judgment_id TEXT NOT NULL,
      gross_cents INTEGER NOT NULL,
      platform_fee_bps INTEGER NOT NULL,
      net_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transfer_id TEXT,
      settled_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rater_credits_judgment ON rater_credits(judgment_id);
    CREATE INDEX IF NOT EXISTS idx_rater_credits_status ON rater_credits(status, created_at);

    CREATE TABLE IF NOT EXISTS rater_sessions (
      id TEXT PRIMARY KEY,
      rater_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      source_site_key TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rater_sessions_rater ON rater_sessions(rater_id);
    CREATE INDEX IF NOT EXISTS idx_rater_sessions_exp ON rater_sessions(expires_at);
  `);
  // WS-N: additive column migrations on units.
  try { d.exec(`ALTER TABLE units ADD COLUMN trace_id TEXT`); } catch {}
  try { d.exec(`ALTER TABLE units ADD COLUMN parent_span_path TEXT`); } catch {}
  try { d.exec(`CREATE INDEX IF NOT EXISTS idx_units_trace ON units(trace_id)`); } catch {}
  // WS-P: per-site tier policy (JSON). nullable → falls back to DEFAULT_POLICY.
  try { d.exec(`ALTER TABLE site_keys ADD COLUMN tier_policy TEXT`); } catch {}
  // WS-U: db-stored ingest secret hash (so we can mint keys at runtime
  // without restarting the service to bake them into env). env-vars stay
  // supported as a higher-priority fallback for first-party keys.
  try { d.exec(`ALTER TABLE site_keys ADD COLUMN ingest_secret_hash TEXT`); } catch {}
  try { d.exec(`ALTER TABLE site_keys ADD COLUMN owner_email TEXT`); } catch {}
  try { d.exec(`ALTER TABLE site_keys ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`); } catch {}
  // WS-U: pending operator applications queue.
  d.exec(`
    CREATE TABLE IF NOT EXISTS operator_applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      org TEXT,
      intended_use TEXT NOT NULL,
      requested_tier TEXT NOT NULL DEFAULT 'free',
      scrubber_required INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
      created_at INTEGER NOT NULL,
      decided_at INTEGER,
      decided_by TEXT,
      minted_site_key TEXT,
      rejection_reason TEXT,
      meta_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_op_apps_status ON operator_applications(status, created_at);
  `);
  // contact form submissions (replaces public mailto: addresses).
  d.exec(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL, -- 'general' | 'security' | 'privacy' | 'billing' | 'legal' | 'abuse' | 'paid-train' | 'enterprise' | 'growth'
      name TEXT,
      email TEXT NOT NULL,
      org TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'triaged' | 'resolved' | 'spam'
      created_at INTEGER NOT NULL,
      handled_at INTEGER,
      handled_by TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_contact_topic_status ON contact_submissions(topic, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_submissions(created_at DESC);
  `);
  return d;
}

// ---------- WS-P: site_keys.tier_policy ----------

export function getTierPolicyJson(siteKey: string): string | null {
  const row = db.prepare('SELECT tier_policy FROM site_keys WHERE site_key = ?').get(siteKey) as { tier_policy: string | null } | undefined;
  return row?.tier_policy ?? null;
}

export function setTierPolicyJson(siteKey: string, policyJson: string | null): void {
  db.prepare('UPDATE site_keys SET tier_policy = ? WHERE site_key = ?').run(policyJson, siteKey);
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

// ---------- WS-M: site_keys (scrubber-required flag) ----------

export interface SiteKeyRow {
  site_key: string;
  scrubber_required: number; // 0 | 1
  label: string | null;
  created_at: number;
  tier_policy: string | null;
}

export function getSiteKey(siteKey: string): SiteKeyRow | undefined {
  return db.prepare(
    'SELECT site_key, scrubber_required, label, created_at, tier_policy FROM site_keys WHERE site_key = ?',
  ).get(siteKey) as SiteKeyRow | undefined;
}

export interface ActiveSiteKeyRow {
  site_key: string;
  status: string;
  owner_email: string | null;
  tier_policy: string | null;
}

export function getActiveSiteKey(siteKey: string): ActiveSiteKeyRow | null {
  const row = db.prepare(
    'SELECT site_key, status, owner_email, tier_policy FROM site_keys WHERE site_key = ?',
  ).get(siteKey) as ActiveSiteKeyRow | undefined;
  if (!row) return null;
  if (row.status !== 'active') return null;
  return row;
}

export function upsertSiteKey(siteKey: string, scrubberRequired: boolean, label?: string): void {
  db.prepare(
    `INSERT INTO site_keys (site_key, scrubber_required, label, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(site_key) DO UPDATE SET scrubber_required=excluded.scrubber_required, label=excluded.label`,
  ).run(siteKey, scrubberRequired ? 1 : 0, label ?? null, Date.now());
}

// scrubber_required defaults to true if key is unregistered — fail-closed.
export function scrubberRequiredFor(siteKey: string): boolean {
  const row = getSiteKey(siteKey);
  if (!row) return true;
  return row.scrubber_required === 1;
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

const RATER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RATER_SESSION_HARD_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export function createRaterSession(token: string, raterId: string, sourceSiteKey: string | null): { id: string; expires_at: number } {
  const now = Date.now();
  const expiresAt = now + RATER_SESSION_TTL_MS;
  db.prepare(
    'INSERT INTO rater_sessions (id, rater_id, created_at, last_seen_at, expires_at, source_site_key) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(token, raterId, now, now, expiresAt, sourceSiteKey);
  return { id: token, expires_at: expiresAt };
}

export function resolveRaterSession(token: string): { rater_id: string } | null {
  if (!token) return null;
  const row = db.prepare(
    'SELECT rater_id, created_at, expires_at FROM rater_sessions WHERE id = ?',
  ).get(token) as { rater_id: string; created_at: number; expires_at: number } | undefined;
  if (!row) return null;
  const now = Date.now();
  if (now > row.expires_at) return null;
  if (now > row.created_at + RATER_SESSION_HARD_MAX_MS) return null;
  const slid = Math.min(now + RATER_SESSION_TTL_MS, row.created_at + RATER_SESSION_HARD_MAX_MS);
  db.prepare('UPDATE rater_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(now, slid, token);
  return { rater_id: row.rater_id };
}

export function gcRaterSessions(): number {
  return db.prepare('DELETE FROM rater_sessions WHERE expires_at < ?').run(Date.now()).changes;
}
