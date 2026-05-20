// in-memory store for the PoC. real impl uses postgres + redis.
// data resets on server restart — that's intentional, this is a demo.

export type UnitType = 'pairwise_trace' | 'step_validity' | 'skill_diff' | 'hallucination_flag' | 'taste_rank';

export interface PairwiseChoice { label: string; text: string; }

export interface Unit {
  id: string;
  type: UnitType;
  source_agent: string;             // which agent stack produced this trace
  prompt_context: string;           // shown above the question
  question: string;                 // the actual ask to the rater
  choices?: PairwiseChoice[];       // for pairwise / taste_rank
  binary?: { yes: string; no: string }; // for step_validity / hallucination_flag
  diff?: string;                    // raw multi-line diff for skill_diff
  gold?: string;                    // gold answer (only used server-side for trust scoring)
  est_seconds: number;              // operator-facing latency budget
}

export interface Judgment {
  id: string;
  unit_id: string;
  rater_id: string;
  choice: string;
  latency_ms: number;
  confidence: number;
  created_at: number;
  agreed_with_gold: boolean | null;  // null if no gold
}

export interface Rater {
  id: string;
  trust: number;          // 0-1, ELO-shaped, starts at 0.5
  judgments_count: number;
  agreed_count: number;
  earned_cents: number;
  created_at: number;
}

const _units = seedUnits();
const _judgments: Judgment[] = [];
const _raters = new Map<string, Rater>();

export function getUnit(id: string): Unit | undefined { return _units.find(u => u.id === id); }
export function listUnits(): Unit[] { return _units; }

export function pickNextUnit(raterId: string): Unit {
  // PoC pick: random, weighted slightly toward unseen-by-this-rater
  const seen = new Set(_judgments.filter(j => j.rater_id === raterId).map(j => j.unit_id));
  const unseen = _units.filter(u => !seen.has(u.id));
  const pool = unseen.length > 0 ? unseen : _units;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getOrCreateRater(id: string): Rater {
  let r = _raters.get(id);
  if (!r) {
    r = { id, trust: 0.5, judgments_count: 0, agreed_count: 0, earned_cents: 0, created_at: Date.now() };
    _raters.set(id, r);
  }
  return r;
}

export function recordJudgment(input: { unit_id: string; rater_id: string; choice: string; latency_ms: number; confidence: number }): { judgment: Judgment; rater: Rater; trust_delta: number } {
  const unit = getUnit(input.unit_id);
  if (!unit) throw new Error('unit not found');
  const rater = getOrCreateRater(input.rater_id);

  const agreed = unit.gold ? input.choice === unit.gold : null;
  const j: Judgment = {
    id: `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    unit_id: input.unit_id,
    rater_id: input.rater_id,
    choice: input.choice,
    latency_ms: input.latency_ms,
    confidence: input.confidence,
    created_at: Date.now(),
    agreed_with_gold: agreed,
  };
  _judgments.push(j);

  // toy trust update — real impl uses a properly-calibrated bayesian update
  const prevTrust = rater.trust;
  let newTrust = prevTrust;
  if (agreed === true) newTrust = prevTrust + (1 - prevTrust) * 0.08;
  else if (agreed === false) newTrust = prevTrust * 0.92;
  // 1 cent per judgment, 2 cents bonus on agreement
  const earned = 1 + (agreed === true ? 2 : 0);
  rater.trust = Math.max(0, Math.min(1, newTrust));
  rater.judgments_count += 1;
  if (agreed === true) rater.agreed_count += 1;
  rater.earned_cents += earned;

  return { judgment: j, rater, trust_delta: rater.trust - prevTrust };
}

export function listJudgments(raterId?: string, limit = 50): Judgment[] {
  let out = _judgments.slice().reverse();
  if (raterId) out = out.filter(j => j.rater_id === raterId);
  return out.slice(0, limit);
}

export function stats(): { total_units: number; total_judgments: number; total_raters: number; avg_trust: number } {
  const raters = Array.from(_raters.values());
  const avg = raters.length ? raters.reduce((a, r) => a + r.trust, 0) / raters.length : 0;
  return {
    total_units: _units.length,
    total_judgments: _judgments.length,
    total_raters: _raters.size,
    avg_trust: avg,
  };
}

function seedUnits(): Unit[] {
  return [
    {
      id: 'u_pair_001', type: 'pairwise_trace', source_agent: 'opencode/atlas',
      prompt_context: 'goal: write a python function that returns the nth fibonacci number',
      question: 'which response is better?',
      choices: [
        { label: 'A', text: 'def fib(n):\n    if n < 2: return n\n    return fib(n-1) + fib(n-2)' },
        { label: 'B', text: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a' },
      ],
      gold: 'B', est_seconds: 8,
    },
    {
      id: 'u_pair_002', type: 'pairwise_trace', source_agent: 'hermes/clawd',
      prompt_context: 'user asked: "is izmir warmer than istanbul in may?"',
      question: 'which answer is more useful?',
      choices: [
        { label: 'A', text: 'yes, generally. izmir average high in may is ~26°C; istanbul ~21°C. izmir gets ~10h more sun across the month too.' },
        { label: 'B', text: 'climates vary — please consult a meteorological service for accurate data.' },
      ],
      gold: 'A', est_seconds: 7,
    },
    {
      id: 'u_step_001', type: 'step_validity', source_agent: 'paperclip/librarian',
      prompt_context: 'goal: find the original publication date of "The Brothers Karamazov"\nprevious step output: result is 1880',
      question: 'next tool call: web_search("dostoevsky karamazov publication"). is this valid given the goal?',
      binary: { yes: 'yes — sensible verification step', no: 'no — wasteful, already answered' },
      gold: 'no', est_seconds: 6,
    },
    {
      id: 'u_step_002', type: 'step_validity', source_agent: 'opencode/atlas',
      prompt_context: 'goal: refactor user.controller.ts to use the new auth middleware\nfile location: src/controllers/user.controller.ts',
      question: 'next tool call: read_file("src/middleware/auth.ts"). valid?',
      binary: { yes: 'yes — needs to see the middleware interface', no: 'no — irrelevant file' },
      gold: 'yes', est_seconds: 6,
    },
    {
      id: 'u_skill_001', type: 'skill_diff', source_agent: 'hermes/skills/devops/oracle-cloud-vm-ops',
      prompt_context: 'proposed edit to the "VM disk expansion" section of oracle-cloud-vm-ops:',
      question: 'is this skill update an improvement?',
      diff: ` ## VM disk expansion\n \n-Run growpart and resize2fs after expanding via console.\n+Run \`sudo growpart /dev/sda 1\` then \`sudo resize2fs /dev/sda1\` after expanding via console.\n+\n+**Gotcha:** if the partition is in use, growpart may need \`--no-relabel\`. Common when iSCSI is mounted.\n \n Verify with \`df -h\`.`,
      binary: { yes: 'yes — more actionable, adds gotcha', no: 'no — adds noise' },
      gold: 'yes', est_seconds: 12,
    },
    {
      id: 'u_skill_002', type: 'skill_diff', source_agent: 'hermes/skills/research/arxiv',
      prompt_context: 'proposed edit to the "search filters" section of arxiv:',
      question: 'is this skill update an improvement?',
      diff: ` ## Search filters\n \n-You can filter by category and date.\n+You can probably filter by various things, see docs.`,
      binary: { yes: 'yes', no: 'no — strictly less useful' },
      gold: 'no', est_seconds: 10,
    },
    {
      id: 'u_hall_001', type: 'hallucination_flag', source_agent: 'opencode/atlas',
      prompt_context: 'agent claim: "the Next.js 14 App Router uses the new `useFormState` hook from React 19 to handle server actions, which was released alongside Next.js 14 in October 2023."',
      question: 'does this look fabricated?',
      binary: { yes: 'yes — at least one claim wrong', no: 'no — looks correct' },
      gold: 'yes', est_seconds: 10,
    },
    {
      id: 'u_hall_002', type: 'hallucination_flag', source_agent: 'hermes/clawd',
      prompt_context: 'agent claim: "PostgreSQL 16 added the `random_normal()` function for sampling from a normal distribution, available in the core build without extensions."',
      question: 'does this look fabricated?',
      binary: { yes: 'yes', no: 'no — correct as stated' },
      gold: 'no', est_seconds: 10,
    },
    {
      id: 'u_pair_003', type: 'pairwise_trace', source_agent: 'kanban/worker',
      prompt_context: 'goal: write a one-line bash that finds the 5 largest files in /var/log',
      question: 'which command is correct AND idiomatic?',
      choices: [
        { label: 'A', text: 'du -ah /var/log 2>/dev/null | sort -hr | head -5' },
        { label: 'B', text: 'find /var/log -type f -exec ls -la {} \\; | sort -k5 -nr | head -5' },
      ],
      gold: 'A', est_seconds: 9,
    },
    {
      id: 'u_taste_001', type: 'taste_rank', source_agent: 'hermes/clawd',
      prompt_context: 'task: rewrite the sentence "the agent did not find any relevant results in the database" for clarity',
      question: 'click your favorite. one click, no analysis.',
      choices: [
        { label: 'A', text: 'No matching records found.' },
        { label: 'B', text: 'The agent failed to locate results.' },
        { label: 'C', text: 'Zero relevant rows in the database.' },
      ],
      gold: 'A', est_seconds: 6,
    },
  ];
}
