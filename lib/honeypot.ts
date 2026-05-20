// WS-O: honeypot system. adversarial units substituted into the rater stream.
// pass = no-op; fail = trust × 0.85 compounding + behavioral floor 0.3 / 24h;
// 3-consecutive fails → trust floored 0.1 + flag.
import { db } from './db';
import type { Unit, UnitType } from './store';

export type HoneypotResult = 'passed' | 'failed' | 'na';

export interface Honeypot {
  honeypot_id: string;
  unit_type: UnitType;
  payload: string;          // JSON-serialized Unit-shaped payload (question, choices, etc.)
  decoy_answer: string;     // the "obvious LLM guess" — wrong by design
  true_answer: string;
  expert_notes: string;
  retired_at: number | null;
  created_at: number;
  rotation_batch: string;
  served_count: number;
}

// ---------- schema migration (idempotent) ----------

export function ensureHoneypotSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS honeypots (
      honeypot_id    TEXT PRIMARY KEY,
      unit_type      TEXT NOT NULL,
      payload        TEXT NOT NULL,
      decoy_answer   TEXT NOT NULL,
      true_answer    TEXT NOT NULL,
      expert_notes   TEXT NOT NULL,
      retired_at     INTEGER,
      created_at     INTEGER NOT NULL,
      rotation_batch TEXT NOT NULL,
      served_count   INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_honeypots_type  ON honeypots(unit_type);
    CREATE INDEX IF NOT EXISTS idx_honeypots_alive ON honeypots(retired_at);

    CREATE TABLE IF NOT EXISTS honeypot_serves (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      honeypot_id     TEXT NOT NULL,
      rater_id_hashed TEXT NOT NULL,
      served_at       INTEGER NOT NULL,
      UNIQUE(honeypot_id, rater_id_hashed)
    );
    CREATE INDEX IF NOT EXISTS idx_hps_rater ON honeypot_serves(rater_id_hashed);

    CREATE TABLE IF NOT EXISTS rater_meta (
      rater_id              TEXT PRIMARY KEY,
      consecutive_hp_fails  INTEGER NOT NULL DEFAULT 0,
      behavioral_floor_until INTEGER NOT NULL DEFAULT 0,
      admin_flagged         INTEGER NOT NULL DEFAULT 0,
      updated_at            INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_keys (
      key       TEXT PRIMARY KEY,
      label     TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  // judgments table additive columns (nullable honeypot_id + result enum)
  // sqlite has no IF NOT EXISTS for ADD COLUMN; introspect first.
  const cols = (db.prepare(`PRAGMA table_info(judgments)`).all() as Array<{ name: string }>).map(r => r.name);
  if (!cols.includes('honeypot_id'))    db.exec(`ALTER TABLE judgments ADD COLUMN honeypot_id    TEXT`);
  if (!cols.includes('honeypot_result')) db.exec(`ALTER TABLE judgments ADD COLUMN honeypot_result TEXT NOT NULL DEFAULT 'na'`);
}
ensureHoneypotSchema();

// ---------- tier ----------

export type Tier = 'T0' | 'T1' | 'T2' | 'T3';

export function tierForRater(raterId: string): Tier {
  if (raterId.startsWith('t3_')) return 'T3';
  if (raterId.startsWith('t2_')) return 'T2';
  if (raterId.startsWith('t1_')) return 'T1';
  return 'T0';
}

export const HONEYPOT_RATE: Record<Tier, number> = {
  T0: 0.05,
  T1: 0.08,
  T2: 0.15,
  T3: 0.25,
};

// ---------- rater id hashing (privacy) ----------

import { createHash } from 'crypto';
export function hashRater(id: string): string {
  return createHash('sha256').update('hp:' + id).digest('hex').slice(0, 24);
}

// ---------- substitution ----------

export function maybeSubstituteHoneypot(realUnit: Unit, raterId: string, rng: () => number = Math.random): Unit {
  const tier = tierForRater(raterId);
  if (rng() >= HONEYPOT_RATE[tier]) return realUnit;
  const hp = pickHoneypotFor(realUnit.type, raterId, rng);
  if (!hp) return realUnit;
  recordServe(hp.honeypot_id, raterId);
  return materialize(hp, realUnit);
}

function pickHoneypotFor(type: UnitType, raterId: string, rng: () => number): Honeypot | null {
  const rh = hashRater(raterId);
  const rows = db.prepare(`
    SELECT h.* FROM honeypots h
    LEFT JOIN honeypot_serves s
      ON s.honeypot_id = h.honeypot_id AND s.rater_id_hashed = ?
    WHERE h.unit_type = ? AND h.retired_at IS NULL AND s.id IS NULL
  `).all(rh, type) as Honeypot[];
  if (!rows.length) return null;
  return rows[Math.floor(rng() * rows.length)];
}

function recordServe(honeypot_id: string, raterId: string): void {
  const rh = hashRater(raterId);
  db.prepare(`INSERT OR IGNORE INTO honeypot_serves (honeypot_id, rater_id_hashed, served_at) VALUES (?, ?, ?)`)
    .run(honeypot_id, rh, Date.now());
  db.prepare(`UPDATE honeypots SET served_count = served_count + 1 WHERE honeypot_id = ?`).run(honeypot_id);
}

// turn a stored honeypot into a Unit shape the rater UI can serve identically.
// the payload is the question/choices/etc.; the unit's id is the honeypot_id (prefixed).
function materialize(hp: Honeypot, template: Unit): Unit {
  const payload = JSON.parse(hp.payload);
  const u: Unit = {
    ...template,
    ...payload,
    id: `hp_${hp.honeypot_id}`,
    type: hp.unit_type,
    pool: template.pool,
    is_honeypot: true,
    obvious_wrong_answer: hp.decoy_answer,
    gold: hp.true_answer,
    est_seconds: payload.est_seconds ?? template.est_seconds ?? 20,
  };
  return u;
}

// ---------- scoring ----------

export interface HoneypotScoringOutcome {
  honeypot_id: string | null;
  honeypot_result: HoneypotResult;
  trust_multiplier: number;
  behavioral_floor_set: boolean;
  consecutive_fails: number;
  admin_flagged: boolean;
}

const NA: HoneypotScoringOutcome = {
  honeypot_id: null, honeypot_result: 'na', trust_multiplier: 1,
  behavioral_floor_set: false, consecutive_fails: 0, admin_flagged: false,
};

// call with the served unit + the rater's choice. handles the trust-multiplier
// computation; caller multiplies the rater's trust by `trust_multiplier` and
// applies the optional floor (0.1) if `admin_flagged` is true.
export function evaluateHoneypot(unit: Unit, choice: string, raterId: string): HoneypotScoringOutcome {
  if (!unit.is_honeypot) return NA;
  const honeypot_id = unit.id.startsWith('hp_') ? unit.id.slice(3) : null;
  const passed = unit.gold ? choice === unit.gold : false;
  ensureRaterMeta(raterId);
  if (passed) {
    // pass = no-op on trust; reset streak
    db.prepare(`UPDATE rater_meta SET consecutive_hp_fails = 0, updated_at = ? WHERE rater_id = ?`)
      .run(Date.now(), raterId);
    return { honeypot_id, honeypot_result: 'passed', trust_multiplier: 1, behavioral_floor_set: false, consecutive_fails: 0, admin_flagged: false };
  }
  // fail
  const floorUntil = Date.now() + 24 * 3600_000;
  const row = db.prepare(`SELECT consecutive_hp_fails FROM rater_meta WHERE rater_id = ?`).get(raterId) as { consecutive_hp_fails: number } | undefined;
  const streak = (row?.consecutive_hp_fails ?? 0) + 1;
  const flag = streak >= 3;
  db.prepare(`
    UPDATE rater_meta SET
      consecutive_hp_fails = ?,
      behavioral_floor_until = ?,
      admin_flagged = MAX(admin_flagged, ?),
      updated_at = ?
    WHERE rater_id = ?
  `).run(streak, floorUntil, flag ? 1 : 0, Date.now(), raterId);
  return {
    honeypot_id,
    honeypot_result: 'failed',
    trust_multiplier: 0.85,
    behavioral_floor_set: true,
    consecutive_fails: streak,
    admin_flagged: flag,
  };
}

function ensureRaterMeta(raterId: string): void {
  db.prepare(`INSERT OR IGNORE INTO rater_meta (rater_id, updated_at) VALUES (?, ?)`).run(raterId, Date.now());
}

// caller (recordJudgment) uses this when computing behavioral_score post-fail
export function behavioralFloorActive(raterId: string, now = Date.now()): boolean {
  const r = db.prepare(`SELECT behavioral_floor_until FROM rater_meta WHERE rater_id = ?`).get(raterId) as { behavioral_floor_until: number } | undefined;
  return !!r && r.behavioral_floor_until > now;
}

export function applyBehavioralFloor(score: number, raterId: string): number {
  return behavioralFloorActive(raterId) ? Math.max(0.3, score) : score;
}

// ---------- admin / list ops ----------

export function listHoneypots(filter?: { type?: UnitType; status?: 'active' | 'retired' | 'all' }): Honeypot[] {
  const status = filter?.status ?? 'all';
  const where: string[] = [];
  const args: any[] = [];
  if (filter?.type) { where.push('unit_type = ?'); args.push(filter.type); }
  if (status === 'active')  where.push('retired_at IS NULL');
  if (status === 'retired') where.push('retired_at IS NOT NULL');
  const sql = `SELECT * FROM honeypots ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...args) as Honeypot[];
}

export function getHoneypotStats(honeypot_id: string): { served: number; failed: number; passed: number; last_served_at: number | null } {
  const served = (db.prepare(`SELECT COUNT(*) AS n FROM judgments WHERE honeypot_id = ?`).get(honeypot_id) as any).n;
  const failed = (db.prepare(`SELECT COUNT(*) AS n FROM judgments WHERE honeypot_id = ? AND honeypot_result = 'failed'`).get(honeypot_id) as any).n;
  const passed = (db.prepare(`SELECT COUNT(*) AS n FROM judgments WHERE honeypot_id = ? AND honeypot_result = 'passed'`).get(honeypot_id) as any).n;
  const last = db.prepare(`SELECT MAX(created_at) AS t FROM judgments WHERE honeypot_id = ?`).get(honeypot_id) as { t: number | null };
  return { served, failed, passed, last_served_at: last.t };
}

export function insertHoneypot(h: Omit<Honeypot, 'honeypot_id' | 'created_at' | 'retired_at' | 'served_count' | 'rotation_batch'> & { honeypot_id?: string; rotation_batch?: string }): Honeypot {
  const id = h.honeypot_id ?? `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const batch = h.rotation_batch ?? `b_${new Date(now).toISOString().slice(0, 10)}`;
  db.prepare(`
    INSERT OR REPLACE INTO honeypots
      (honeypot_id, unit_type, payload, decoy_answer, true_answer, expert_notes, retired_at, created_at, rotation_batch, served_count)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, COALESCE((SELECT served_count FROM honeypots WHERE honeypot_id = ?), 0))
  `).run(id, h.unit_type, h.payload, h.decoy_answer, h.true_answer, h.expert_notes, now, batch, id);
  return db.prepare(`SELECT * FROM honeypots WHERE honeypot_id = ?`).get(id) as Honeypot;
}

export function retireHoneypot(honeypot_id: string): void {
  db.prepare(`UPDATE honeypots SET retired_at = ? WHERE honeypot_id = ?`).run(Date.now(), honeypot_id);
}

// active counts per type — used by rotation alert
export function activeCountsByType(): Record<string, number> {
  const rows = db.prepare(`SELECT unit_type, COUNT(*) AS n FROM honeypots WHERE retired_at IS NULL GROUP BY unit_type`).all() as Array<{ unit_type: string; n: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.unit_type] = r.n;
  return out;
}

export const HONEYPOT_TYPES: UnitType[] = [
  'sarcasm_detect', 'ai_vs_real', 'taste_rank', 'step_validity', 'skill_diff', 'hallucination_flag',
];
