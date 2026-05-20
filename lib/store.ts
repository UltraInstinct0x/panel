// sqlite-backed store. API-compatible with the prior in-memory PoC.
import { db } from './db';

export type UnitType =
  | 'pairwise_trace'
  | 'step_validity'
  | 'skill_diff'
  | 'hallucination_flag'
  | 'taste_rank'
  | 'sarcasm_detect'
  | 'ai_vs_real'
  | 'dub_sync';

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
  tx(seedUnits());
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

  const agreed = unit.gold ? input.choice === unit.gold : null;
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

// ---------- seed data ----------

function seedUnits(): Unit[] {
  return [
    // ===== technical pool (D12: flagship-solvable, paid trust pipeline only) =====
    {
      id: 'u_pair_001', type: 'pairwise_trace', pool: 'technical', source_agent: 'opencode/atlas',
      prompt_context: 'goal: write a python function that returns the nth fibonacci number',
      question: 'which response is better?',
      choices: [
        { label: 'A', text: 'def fib(n):\n    if n < 2: return n\n    return fib(n-1) + fib(n-2)' },
        { label: 'B', text: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a' },
      ],
      gold: 'B', est_seconds: 8,
    },
    {
      id: 'u_step_001', type: 'step_validity', pool: 'technical', source_agent: 'paperclip/librarian',
      prompt_context: 'goal: find the original publication date of "The Brothers Karamazov"\nprevious step output: result is 1880',
      question: 'next tool call: web_search("dostoevsky karamazov publication"). is this valid given the goal?',
      binary: { yes: 'yes — sensible verification step', no: 'no — wasteful, already answered' },
      gold: 'no', est_seconds: 6,
    },
    {
      id: 'u_step_002', type: 'step_validity', pool: 'technical', source_agent: 'opencode/atlas',
      prompt_context: 'goal: refactor user.controller.ts to use the new auth middleware\nfile location: src/controllers/user.controller.ts',
      question: 'next tool call: read_file("src/middleware/auth.ts"). valid?',
      binary: { yes: 'yes — needs to see the middleware interface', no: 'no — irrelevant file' },
      gold: 'yes', est_seconds: 6,
    },
    {
      id: 'u_skill_001', type: 'skill_diff', pool: 'technical', source_agent: 'hermes/skills/devops/oracle-cloud-vm-ops',
      prompt_context: 'proposed edit to the "VM disk expansion" section of oracle-cloud-vm-ops:',
      question: 'is this skill update an improvement?',
      diff: ` ## VM disk expansion\n \n-Run growpart and resize2fs after expanding via console.\n+Run \`sudo growpart /dev/sda 1\` then \`sudo resize2fs /dev/sda1\` after expanding via console.\n+\n+**Gotcha:** if the partition is in use, growpart may need \`--no-relabel\`. Common when iSCSI is mounted.\n \n Verify with \`df -h\`.`,
      binary: { yes: 'yes — more actionable, adds gotcha', no: 'no — adds noise' },
      gold: 'yes', est_seconds: 12,
    },
    {
      id: 'u_skill_002', type: 'skill_diff', pool: 'technical', source_agent: 'hermes/skills/research/arxiv',
      prompt_context: 'proposed edit to the "search filters" section of arxiv:',
      question: 'is this skill update an improvement?',
      diff: ` ## Search filters\n \n-You can filter by category and date.\n+You can probably filter by various things, see docs.`,
      binary: { yes: 'yes', no: 'no — strictly less useful' },
      gold: 'no', est_seconds: 10,
    },
    {
      id: 'u_hall_001', type: 'hallucination_flag', pool: 'technical', source_agent: 'opencode/atlas',
      prompt_context: 'agent claim: "the Next.js 14 App Router uses the new `useFormState` hook from React 19 to handle server actions, which was released alongside Next.js 14 in October 2023."',
      question: 'does this look fabricated?',
      binary: { yes: 'yes — at least one claim wrong', no: 'no — looks correct' },
      gold: 'yes', est_seconds: 10,
    },
    {
      id: 'u_pair_003', type: 'pairwise_trace', pool: 'technical', source_agent: 'kanban/worker',
      prompt_context: 'goal: write a one-line bash that finds the 5 largest files in /var/log',
      question: 'which command is correct AND idiomatic?',
      choices: [
        { label: 'A', text: 'du -ah /var/log 2>/dev/null | sort -hr | head -5' },
        { label: 'B', text: 'find /var/log -type f -exec ls -la {} \\; | sort -k5 -nr | head -5' },
      ],
      gold: 'A', est_seconds: 9,
    },

    // ===== public pool (D12: taste/perception/cultural — flagships cannot reliably solve) =====
    {
      id: 'u_taste_001', type: 'taste_rank', pool: 'public', source_agent: 'hermes/clawd',
      prompt_context: 'task: rewrite "the agent did not find any relevant results in the database" for clarity',
      question: 'click your favorite. one click, no analysis.',
      choices: [
        { label: 'A', text: 'No matching records found.' },
        { label: 'B', text: 'The agent failed to locate results.' },
        { label: 'C', text: 'Zero relevant rows in the database.' },
      ],
      gold: 'A', est_seconds: 6,
    },
    {
      id: 'u_taste_002', type: 'taste_rank', pool: 'public', source_agent: 'hermes/clawd',
      prompt_context: 'task: write a one-line product tagline for a meditation app',
      question: 'which feels least like AI slop?',
      choices: [
        { label: 'A', text: 'Unlock your inner peace and discover the journey within.' },
        { label: 'B', text: 'Ten minutes. Then back to your life.' },
        { label: 'C', text: 'Empowering mindfulness through transformative meditation experiences.' },
      ],
      gold: 'B', est_seconds: 6,
    },
    {
      id: 'u_sarc_001', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      prompt_context: 'tweet from a developer after a 6-hour outage: "love when our prod DB decides to take a personal day"',
      question: 'is this sarcastic?',
      binary: { yes: 'yes — sarcastic', no: 'no — sincere' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_sarc_002', type: 'sarcasm_detect', pool: 'public', source_agent: 'social/feed',
      // honeypot: looks sarcastic to an LLM scanning surface markers, but is sincere given context.
      prompt_context: 'reply from a junior dev who just shipped their first PR: "honestly this is the best day of my week, no joke"',
      question: 'is this sarcastic?',
      binary: { yes: 'yes — sarcastic', no: 'no — sincere' },
      gold: 'no',
      is_honeypot: true, obvious_wrong_answer: 'yes',
      est_seconds: 5,
    },
    {
      id: 'u_aivr_001', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'short product description: "Our innovative solution leverages cutting-edge technology to deliver unparalleled value to discerning customers seeking premium experiences."',
      question: 'AI-written or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'yes', est_seconds: 5,
    },
    {
      id: 'u_aivr_002', type: 'ai_vs_real', pool: 'public', source_agent: 'content/feed',
      prompt_context: 'reddit comment: "got the part in for $14 off ebay, took me like an hour with a torx bit. dishwasher works. would not recommend if you havent done it before tho, theres a spring that wants to murder you"',
      question: 'AI-written or human?',
      binary: { yes: 'AI', no: 'human' },
      gold: 'no', est_seconds: 5,
    },
    {
      id: 'u_taste_003', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'error toast for a failed payment',
      question: 'which would you rather see as a user?',
      choices: [
        { label: 'A', text: 'An unexpected error occurred. Please try again.' },
        { label: 'B', text: 'Card declined. The bank didn’t say why — try another?' },
        { label: 'C', text: 'Transaction processing failed due to upstream issues.' },
      ],
      gold: 'B', est_seconds: 6,
    },
    // honeypot in taste pool: the "obviously most polished" option is corporate slop.
    {
      id: 'u_taste_004', type: 'taste_rank', pool: 'public', source_agent: 'design/ui-copy',
      prompt_context: 'empty state for a notes app with zero notes',
      question: 'which has the most personality?',
      choices: [
        { label: 'A', text: 'You have no notes yet. Click "New" to create your first note.' },
        { label: 'B', text: 'nothing here. that’s ok.' },
        { label: 'C', text: 'Welcome to your notes! Get started by creating your first note today.' },
      ],
      gold: 'B',
      is_honeypot: true, obvious_wrong_answer: 'C',
      est_seconds: 6,
    },
    {
      id: 'u_dub_001', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'short clip with a dubbed track. play it, then judge.',
      question: 'does the dub sync to the on-screen action?',
      binary: { yes: 'yes — in sync', no: 'no — drifts' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      audio_offset_ms: 240,
      gold: 'no', est_seconds: 10,
    },
    // honeypot dub: offset is small and surface-cue-free; an LLM with only metadata flips on the number.
    {
      id: 'u_dub_002', type: 'dub_sync', pool: 'public', source_agent: 'video/dub-pipeline',
      prompt_context: 'second clip. same prompt.',
      question: 'does the dub sync to the on-screen action?',
      binary: { yes: 'yes — in sync', no: 'no — drifts' },
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      audio_offset_ms: 80,
      gold: 'yes', // within human-perceptible tolerance ~ ±100ms
      is_honeypot: true, obvious_wrong_answer: 'no',
      est_seconds: 10,
    },
  ];
}

// run seed on module import
seedIfEmpty();
