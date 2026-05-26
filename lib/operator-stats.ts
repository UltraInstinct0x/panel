// WS-Q: per-operator (site_key) stats queries.
// all queries are bounded by site_key + a time window (default 7d).
// no cross-operator data is ever returned from this module.
import { db } from './db';

let _ensured = false;
function ensure(): void {
  if (_ensured) return;
  // challenge_events: one row per /api/challenge/init issuance.
  // additive table — created here so we don't touch lib/db.ts schema bootstrap.
  db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_events (
      jti TEXT PRIMARY KEY,
      site_key TEXT NOT NULL,
      tier TEXT NOT NULL,
      pool TEXT,
      trust REAL,
      risk REAL,
      verdict TEXT,
      confidence REAL,
      trust_tier TEXT,
      reason_codes_json TEXT,
      edge_runtime TEXT,
      edge_model_version TEXT,
      edge_feature_version TEXT,
      edge_fallback INTEGER,
      edge_model_error INTEGER,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      resolution TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chev_key_ts ON challenge_events(site_key, created_at DESC);
  `);
  ensureChallengeEventColumns();
  _ensured = true;
}

function ensureChallengeEventColumns(): void {
  const addCol = (sql: string) => { try { db.exec(sql); } catch {} };
  addCol('ALTER TABLE challenge_events ADD COLUMN verdict TEXT');
  addCol('ALTER TABLE challenge_events ADD COLUMN confidence REAL');
  addCol('ALTER TABLE challenge_events ADD COLUMN trust_tier TEXT');
  addCol('ALTER TABLE challenge_events ADD COLUMN reason_codes_json TEXT');
  addCol('ALTER TABLE challenge_events ADD COLUMN edge_runtime TEXT');
  addCol('ALTER TABLE challenge_events ADD COLUMN edge_model_version TEXT');
  addCol('ALTER TABLE challenge_events ADD COLUMN edge_feature_version TEXT');
  addCol('ALTER TABLE challenge_events ADD COLUMN edge_fallback INTEGER');
  addCol('ALTER TABLE challenge_events ADD COLUMN edge_model_error INTEGER');
}

export function recordChallengeIssued(args: {
  jti: string; site_key: string; tier: string; pool?: string | null; trust?: number; risk?: number;
}): void {
  ensure();
  db.prepare(
    `INSERT OR IGNORE INTO challenge_events (jti, site_key, tier, pool, trust, risk, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(args.jti, args.site_key, args.tier, args.pool ?? null, args.trust ?? null, args.risk ?? null, Date.now());
}

export function recordChallengeResolved(jti: string, resolution: 'pass' | 'retry' | 'hard_fail', meta?: {
  verdict?: string;
  confidence?: number;
  trust_tier?: string;
  reason_codes?: string[];
  edge_runtime?: string;
  edge_model_version?: string;
  edge_feature_version?: string;
  edge_fallback?: boolean;
  edge_model_error?: boolean;
}): void {
  ensure();
  db.prepare(
    `UPDATE challenge_events
      SET resolved_at = ?,
          resolution = ?,
          verdict = ?,
          confidence = ?,
          trust_tier = ?,
          reason_codes_json = ?,
          edge_runtime = ?,
          edge_model_version = ?,
          edge_feature_version = ?,
          edge_fallback = ?,
          edge_model_error = ?
      WHERE jti = ? AND resolved_at IS NULL`,
  ).run(
    Date.now(),
    resolution,
    meta?.verdict ?? null,
    meta?.confidence ?? null,
    meta?.trust_tier ?? null,
    meta?.reason_codes ? JSON.stringify(meta.reason_codes) : null,
    meta?.edge_runtime ?? null,
    meta?.edge_model_version ?? null,
    meta?.edge_feature_version ?? null,
    meta?.edge_fallback ? 1 : 0,
    meta?.edge_model_error ? 1 : 0,
    jti,
  );
}

const DAY = 24 * 60 * 60 * 1000;

export function ingestCount(siteKey: string, days = 7): number {
  try {
    const since = Date.now() - days * DAY;
    const r = db.prepare(
      'SELECT COUNT(*) AS n FROM ingested_unit_links WHERE site_key = ? AND created_at >= ?',
    ).get(siteKey, since) as { n: number } | undefined;
    return r?.n ?? 0;
  } catch {
    return 0;
  }
}

export function unitsEmittedCount(siteKey: string, days = 7): number {
  try {
    const since = Date.now() - days * DAY;
    const r = db.prepare(
      `SELECT COUNT(DISTINCT iul.unit_id) AS n
         FROM ingested_unit_links iul
         JOIN units u ON u.id = iul.unit_id
        WHERE iul.site_key = ? AND iul.created_at >= ?`,
    ).get(siteKey, since) as { n: number } | undefined;
    return r?.n ?? 0;
  } catch {
    return 0;
  }
}

export function challengeCount(siteKey: string, days = 7): number {
  ensure();
  const since = Date.now() - days * DAY;
  const r = db.prepare(
    'SELECT COUNT(*) AS n FROM challenge_events WHERE site_key = ? AND created_at >= ?',
  ).get(siteKey, since) as { n: number } | undefined;
  return r?.n ?? 0;
}

export function tierDistribution(siteKey: string, days = 7): Record<string, number> {
  ensure();
  const since = Date.now() - days * DAY;
  const rows = db.prepare(
    `SELECT tier, COUNT(*) AS n FROM challenge_events WHERE site_key = ? AND created_at >= ? GROUP BY tier`,
  ).all(siteKey, since) as { tier: string; n: number }[];
  const out: Record<string, number> = { C0: 0, C1: 0, C2: 0, C3: 0 };
  for (const r of rows) out[r.tier] = r.n;
  return out;
}

export function passRate(siteKey: string, days = 7): { pass: number; total: number; rate: number } {
  ensure();
  const since = Date.now() - days * DAY;
  const rows = db.prepare(
    `SELECT resolution, COUNT(*) AS n FROM challenge_events
       WHERE site_key = ? AND created_at >= ? AND resolution IS NOT NULL
       GROUP BY resolution`,
  ).all(siteKey, since) as { resolution: string; n: number }[];
  let pass = 0, total = 0;
  for (const r of rows) { total += r.n; if (r.resolution === 'pass') pass += r.n; }
  return { pass, total, rate: total > 0 ? pass / total : 0 };
}

export function judgmentLatencyPercentiles(siteKey: string, days = 7): { p50: number; p99: number; n: number } {
  const since = Date.now() - days * DAY;
  let rows: { latency_ms: number }[] = [];
  try {
    rows = db.prepare(
      'SELECT latency_ms FROM judgments WHERE site_key = ? AND created_at >= ? ORDER BY latency_ms ASC',
    ).all(siteKey, since) as { latency_ms: number }[];
  } catch {
    return { p50: 0, p99: 0, n: 0 };
  }
  const n = rows.length;
  if (n === 0) return { p50: 0, p99: 0, n: 0 };
  const at = (p: number) => rows[Math.min(n - 1, Math.floor(p * n))].latency_ms;
  return { p50: at(0.5), p99: at(0.99), n };
}

export function dailySeries(
  siteKey: string,
  days = 7,
): { day: string; ingests: number; challenges: number; judgments: number }[] {
  ensure();
  const since = Date.now() - days * DAY;
  const buckets = new Map<string, { day: string; ingests: number; challenges: number; judgments: number }>();
  // pre-fill days
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    buckets.set(d, { day: d, ingests: 0, challenges: 0, judgments: 0 });
  }
  const fold = (rows: { ts: number; n: number }[], key: 'ingests' | 'challenges' | 'judgments') => {
    for (const r of rows) {
      const d = new Date(r.ts).toISOString().slice(0, 10);
      const b = buckets.get(d);
      if (b) b[key] += r.n;
    }
  };
  try {
    fold(
      db.prepare(
        'SELECT created_at AS ts, 1 AS n FROM ingested_unit_links WHERE site_key = ? AND created_at >= ?',
      ).all(siteKey, since) as any,
      'ingests',
    );
  } catch {}
  fold(
    db.prepare(
      'SELECT created_at AS ts, 1 AS n FROM challenge_events WHERE site_key = ? AND created_at >= ?',
    ).all(siteKey, since) as any,
    'challenges',
  );
  try {
    fold(
      db.prepare(
        'SELECT created_at AS ts, 1 AS n FROM judgments WHERE site_key = ? AND created_at >= ?',
      ).all(siteKey, since) as any,
      'judgments',
    );
  } catch {}
  return Array.from(buckets.values());
}

export function listAllSiteKeys(): { site_key: string; label: string | null; scrubber_required: number; created_at: number; tier_policy: string | null }[] {
  return db.prepare(
    'SELECT site_key, label, scrubber_required, created_at, tier_policy FROM site_keys ORDER BY created_at DESC',
  ).all() as any;
}

// ── WS-Q: adapter functions for stats page ─────────────────────────
export function ingestStats7d(siteKey: string): { ingests: number; units_emitted: number } {
  return { ingests: ingestCount(siteKey, 7), units_emitted: unitsEmittedCount(siteKey, 7) };
}

export function challengeStats7d(siteKey: string): { issued: number; resolved: number; passed: number; edge_fallbacks: number; edge_model_errors: number } {
  ensure();
  const since = Date.now() - 7 * DAY;
  const r = db.prepare(
    `SELECT
       COUNT(*) AS issued,
       SUM(CASE WHEN resolution IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
       SUM(CASE WHEN resolution = 'pass' THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN edge_fallback = 1 THEN 1 ELSE 0 END) AS edge_fallbacks,
       SUM(CASE WHEN edge_model_error = 1 THEN 1 ELSE 0 END) AS edge_model_errors
     FROM challenge_events WHERE site_key = ? AND created_at >= ?`,
  ).get(siteKey, since) as {
    issued: number;
    resolved: number | null;
    passed: number | null;
    edge_fallbacks: number | null;
    edge_model_errors: number | null;
  } | undefined;
  return {
    issued: r?.issued ?? 0,
    resolved: r?.resolved ?? 0,
    passed: r?.passed ?? 0,
    edge_fallbacks: r?.edge_fallbacks ?? 0,
    edge_model_errors: r?.edge_model_errors ?? 0,
  };
}

export function tierDistribution7d(siteKey: string): { tier: string; n: number }[] {
  const dist = tierDistribution(siteKey, 7);
  return Object.entries(dist)
    .filter(([, n]) => n > 0)
    .map(([tier, n]) => ({ tier, n }));
}

export function latencyStats7d(siteKey: string): { p50_ms: number | null; p99_ms: number | null; n: number } {
  const r = judgmentLatencyPercentiles(siteKey, 7);
  return { p50_ms: r.n > 0 ? r.p50 : null, p99_ms: r.n > 0 ? r.p99 : null, n: r.n };
}

export function perDayBuckets7d(siteKey: string): { day: string; ingests: number; units_emitted: number; challenges: number; passes: number }[] {
  ensure();
  const since = Date.now() - 7 * DAY;
  const base = dailySeries(siteKey, 7); // {day,ingests,challenges,judgments}
  // overlay units_emitted + passes
  const out = base.map(b => ({ day: b.day, ingests: b.ingests, units_emitted: 0, challenges: b.challenges, passes: 0 }));
  const idx = new Map(out.map((b, i) => [b.day, i]));
  // units_emitted per day
  try {
    const rows = db.prepare(
      `SELECT iul.created_at AS ts
         FROM ingested_unit_links iul
         JOIN units u ON u.id = iul.unit_id
        WHERE iul.site_key = ? AND iul.created_at >= ?`,
    ).all(siteKey, since) as { ts: number }[];
    for (const r of rows) {
      const d = new Date(r.ts).toISOString().slice(0, 10);
      const i = idx.get(d); if (i !== undefined) out[i].units_emitted++;
    }
  } catch {}
  // passes per day
  const passRows = db.prepare(
    `SELECT resolved_at AS ts FROM challenge_events
      WHERE site_key = ? AND resolution = 'pass' AND resolved_at IS NOT NULL AND resolved_at >= ?`,
  ).all(siteKey, since) as { ts: number }[];
  for (const r of passRows) {
    const d = new Date(r.ts).toISOString().slice(0, 10);
    const i = idx.get(d); if (i !== undefined) out[i].passes++;
  }
  return out;
}
