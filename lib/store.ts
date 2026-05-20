// sqlite-backed store. API-compatible with the prior in-memory PoC.
import { db } from './db';
import { seedUnitsAll } from './seed_units';

export type UnitType =
  | 'pairwise_trace'
  | 'step_validity'
  | 'skill_diff'
  | 'hallucination_flag'
  | 'taste_rank'
  | 'sarcasm_detect'
  | 'ai_vs_real'
  | 'dub_sync'
  | 'drag_to_rank'
  | 'span_highlight';

export type UnitPool = 'public' | 'technical';

export interface PairwiseChoice { label: string; text: string; }

export interface Unit {
  id: string;
  type: UnitType;
  pool: UnitPool;
  source_agent: string;
  prompt_context: string;
  question: string;
  choices?: PairwiseChoice[];
  binary?: { yes: string; no: string };
  diff?: string;
  // dub_sync extras
  video_url?: string;
  audio_offset_ms?: number;
  // drag_to_rank extras: items to rank + canonical ranking like "A,B,C,D"
  items?: PairwiseChoice[];
  gold_ranking?: string;
  // span_highlight extras: passage + acceptable char ranges as ["start-end", ...]
  passage?: string;
  gold_spans?: string[];
  gold?: string;
  // honeypot: seeded units where the "obvious LLM answer" is wrong by design.
  is_honeypot?: boolean;
  obvious_wrong_answer?: string;
  est_seconds: number;
}

export interface BehavioralSignals {
  mouse_path_summary?: {
    sample_count: number;
    total_distance_px: number;
    avg_speed_px_ms: number;
    direction_changes: number;
  };
  dwell_ms?: number;
  focus_events?: number;
  viewport?: { w: number; h: number };
  ua?: string;
}

export interface Judgment {
  id: string;
  unit_id: string;
  rater_id: string;
  choice: string;
  latency_ms: number;
  confidence: number;
  created_at: number;
  agreed_with_gold: boolean | null;
  honeypot_failed?: boolean;
  pool?: UnitPool;
  site_key?: string;
  behavioral?: BehavioralSignals;
}

export interface Rater {
  id: string;
  trust: number;
  judgments_count: number;
  agreed_count: number;
  earned_cents: number;
  bot_flag: number;
  created_at: number;
}

// ---------- seeding ----------

function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM units').get() as { n: number };
  if (row.n > 0) return;
  const ins = db.prepare(
    'INSERT INTO units (id, json, pool, is_honeypot, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const now = Date.now();
  const tx = db.transaction((units: Unit[]) => {
    for (const u of units) {
      ins.run(u.id, JSON.stringify(u), u.pool, u.is_honeypot ? 1 : 0, now);
    }
  });
  tx(seedUnitsAll());
}

// ---------- unit access ----------

export function getUnit(id: string): Unit | undefined {
  const row = db.prepare('SELECT json FROM units WHERE id = ?').get(id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as Unit) : undefined;
}

export function listUnits(): Unit[] {
  const rows = db.prepare('SELECT json FROM units').all() as { json: string }[];
  return rows.map(r => JSON.parse(r.json) as Unit);
}

export function pickNextUnit(raterId: string, pool: UnitPool = 'public'): Unit {
  // D12: anon raters only get the public pool. technical pool is paid-rater only.
  const all = db
    .prepare('SELECT id, json FROM units WHERE pool = ?')
    .all(pool) as { id: string; json: string }[];
  if (all.length === 0) throw new Error('no units in pool ' + pool);
  const seenRows = db
    .prepare('SELECT DISTINCT unit_id FROM judgments WHERE rater_id = ?')
    .all(raterId) as { unit_id: string }[];
  const seen = new Set(seenRows.map(s => s.unit_id));
  const unseen = all.filter(u => !seen.has(u.id));
  const pickFrom = unseen.length ? unseen : all;
  const row = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  return JSON.parse(row.json) as Unit;
}

export function getOrCreateRater(id: string): Rater {
  const row = db.prepare('SELECT * FROM raters WHERE id = ?').get(id) as Rater | undefined;
  if (row) return row;
  const now = Date.now();
  db.prepare(
    'INSERT INTO raters (id, trust, judgments_count, agreed_count, earned_cents, bot_flag, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 0.5, 0, 0, 0, 0, now);
  return { id, trust: 0.5, judgments_count: 0, agreed_count: 0, earned_cents: 0, bot_flag: 0, created_at: now };
}

export function recordJudgment(input: {
  unit_id: string;
  rater_id: string;
  choice: string;
  latency_ms: number;
  confidence: number;
  site_key?: string;
  behavioral?: BehavioralSignals;
}): { judgment: Judgment; rater: Rater; trust_delta: number; honeypot_failed: boolean } {
  const unit = getUnit(input.unit_id);
  if (!unit) throw new Error('unit not found');
  const rater = getOrCreateRater(input.rater_id);

  const agreed = computeAgreement(unit, input.choice);
  const honeypot_failed =
    !!unit.is_honeypot && !!unit.obvious_wrong_answer && input.choice === unit.obvious_wrong_answer;

  const prevTrust = rater.trust;
  let newTrust = prevTrust;
  if (honeypot_failed) {
    newTrust = prevTrust * 0.6; // hard penalty
  } else if (agreed === true) {
    newTrust = prevTrust + (1 - prevTrust) * 0.08;
  } else if (agreed === false) {
    newTrust = prevTrust * 0.92;
  }
  newTrust = Math.max(0, Math.min(1, newTrust));
  const earned = honeypot_failed ? 0 : 1 + (agreed === true ? 2 : 0);

  const j: Judgment = {
    id: `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    unit_id: input.unit_id,
    rater_id: input.rater_id,
    choice: input.choice,
    latency_ms: input.latency_ms,
    confidence: input.confidence,
    created_at: Date.now(),
    agreed_with_gold: agreed,
    honeypot_failed,
    pool: unit.pool,
    site_key: input.site_key,
    behavioral: input.behavioral,
  };

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO judgments
       (id, unit_id, rater_id, choice, latency_ms, confidence, created_at, agreed_with_gold, honeypot_failed, pool, site_key, behavioral_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      j.id, j.unit_id, j.rater_id, j.choice, j.latency_ms, j.confidence, j.created_at,
      agreed === null ? null : agreed ? 1 : 0,
      honeypot_failed ? 1 : 0,
      unit.pool, input.site_key ?? null,
      input.behavioral ? JSON.stringify(input.behavioral) : null
    );
    db.prepare(
      `UPDATE raters SET
        trust = ?,
        judgments_count = judgments_count + 1,
        agreed_count = agreed_count + ?,
        earned_cents = earned_cents + ?,
        bot_flag = bot_flag + ?
       WHERE id = ?`
    ).run(
      newTrust,
      agreed === true ? 1 : 0,
      earned,
      honeypot_failed ? 1 : 0,
      input.rater_id
    );
  });
  tx();

  const updated = db.prepare('SELECT * FROM raters WHERE id = ?').get(input.rater_id) as Rater;
  return { judgment: j, rater: updated, trust_delta: updated.trust - prevTrust, honeypot_failed };
}

export function listJudgments(raterId?: string, limit = 50): Judgment[] {
  const rows = raterId
    ? db.prepare('SELECT * FROM judgments WHERE rater_id = ? ORDER BY created_at DESC LIMIT ?').all(raterId, limit)
    : db.prepare('SELECT * FROM judgments ORDER BY created_at DESC LIMIT ?').all(limit);
  return (rows as any[]).map(r => ({
    id: r.id,
    unit_id: r.unit_id,
    rater_id: r.rater_id,
    choice: r.choice,
    latency_ms: r.latency_ms,
    confidence: r.confidence,
    created_at: r.created_at,
    agreed_with_gold: r.agreed_with_gold === null ? null : !!r.agreed_with_gold,
    honeypot_failed: !!r.honeypot_failed,
    pool: r.pool as any,
    site_key: r.site_key ?? undefined,
    behavioral: r.behavioral_json ? JSON.parse(r.behavioral_json) : undefined,
  }));
}

export function stats(): {
  total_units: number; total_judgments: number; total_raters: number;
  avg_trust: number; public_units: number; technical_units: number;
  honeypot_units: number; honeypot_failures: number; flagged_raters: number;
} {
  const tu = (db.prepare('SELECT COUNT(*) AS n FROM units').get() as { n: number }).n;
  const pu = (db.prepare("SELECT COUNT(*) AS n FROM units WHERE pool='public'").get() as { n: number }).n;
  const tcu = (db.prepare("SELECT COUNT(*) AS n FROM units WHERE pool='technical'").get() as { n: number }).n;
  const hu = (db.prepare('SELECT COUNT(*) AS n FROM units WHERE is_honeypot=1').get() as { n: number }).n;
  const tj = (db.prepare('SELECT COUNT(*) AS n FROM judgments').get() as { n: number }).n;
  const tr = (db.prepare('SELECT COUNT(*) AS n FROM raters').get() as { n: number }).n;
  const avg = (db.prepare('SELECT COALESCE(AVG(trust), 0) AS a FROM raters').get() as { a: number }).a;
  const hf = (db.prepare('SELECT COUNT(*) AS n FROM judgments WHERE honeypot_failed=1').get() as { n: number }).n;
  const fr = (db.prepare('SELECT COUNT(*) AS n FROM raters WHERE bot_flag > 0').get() as { n: number }).n;
  return {
    total_units: tu, total_judgments: tj, total_raters: tr, avg_trust: avg,
    public_units: pu, technical_units: tcu, honeypot_units: hu,
    honeypot_failures: hf, flagged_raters: fr,
  };
}

// ---------- agreement scoring ----------

function computeAgreement(unit: Unit, choice: string): boolean | null {
  if (unit.type === 'drag_to_rank') {
    if (!unit.gold_ranking) return null;
    // exact-order match for now; could relax to kendall-tau distance later.
    return choice.trim().toUpperCase() === unit.gold_ranking.trim().toUpperCase();
  }
  if (unit.type === 'span_highlight') {
    if (!unit.gold_spans || unit.gold_spans.length === 0) return null;
    // choice format: "start-end". accept any gold span if overlap >= 60% of either side.
    const m = /^(\d+)-(\d+)$/.exec(choice.trim());
    if (!m) return false;
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    const [aLo, aHi] = a <= b ? [a, b] : [b, a];
    const aLen = Math.max(1, aHi - aLo);
    for (const g of unit.gold_spans) {
      const gm = /^(\d+)-(\d+)$/.exec(g);
      if (!gm) continue;
      const gLo = parseInt(gm[1], 10), gHi = parseInt(gm[2], 10);
      const gLen = Math.max(1, gHi - gLo);
      const overlap = Math.max(0, Math.min(aHi, gHi) - Math.max(aLo, gLo));
      if (overlap / aLen >= 0.6 || overlap / gLen >= 0.6) return true;
    }
    return false;
  }
  return unit.gold ? choice === unit.gold : null;
}

// ---------- GDPR/KVKK: export + erasure ----------

export function exportRaterData(raterId: string): {
  rater: Rater | null;
  judgments: Judgment[];
  export_meta: { exported_at: number; rater_id: string; format_version: string };
} {
  const rater = (db.prepare('SELECT * FROM raters WHERE id = ?').get(raterId) as Rater | undefined) ?? null;
  const judgments = listJudgments(raterId, 100000);
  return {
    rater,
    judgments,
    export_meta: {
      exported_at: Date.now(),
      rater_id: raterId,
      format_version: '1',
    },
  };
}

// soft-delete: anonymize rater_id to deleted_<random>, zero behavioral signals on judgments.
// keeps judgment counts intact as anonymized ML signal (Recital 26 — no longer personal data once unlinkable).
export function eraseRater(raterId: string): { ok: boolean; new_id: string; judgments_anonymized: number } {
  const exists = db.prepare('SELECT 1 FROM raters WHERE id = ?').get(raterId);
  if (!exists) return { ok: false, new_id: '', judgments_anonymized: 0 };
  const newId = `deleted_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const tx = db.transaction(() => {
    db.prepare('UPDATE raters SET id = ?, bot_flag = 0 WHERE id = ?').run(newId, raterId);
    const r = db.prepare(
      `UPDATE judgments SET rater_id = ?, behavioral_json = NULL WHERE rater_id = ?`,
    ).run(newId, raterId);
    return r.changes;
  });
  const changes = tx() as number;
  return { ok: true, new_id: newId, judgments_anonymized: changes };
}

// run seed on module import
seedIfEmpty();
