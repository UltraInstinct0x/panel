// GET /api/v1/skill-review/[unit_id] — public consensus endpoint for skill-diff rater review.
// No auth: verdicts are public artifacts; agents and CI gates poll this URL.
// Shape designed for GitHub Action consumption: status + n + consensus + threshold metadata.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeWeightedConsensus } from '@/lib/rater-ledger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Defaults — overridable per-unit via env, future per-key override.
const DEFAULT_MIN_N = Number(process.env.PANEL_REVIEW_MIN_N || 3);
const DEFAULT_THRESHOLD = Number(process.env.PANEL_REVIEW_THRESHOLD || 0.66);

type Verdict = 'approved' | 'rejected' | 'pending' | 'no_consensus';

export async function GET(_req: NextRequest, ctx: { params: { unit_id: string } }) {
  const unitId = ctx.params.unit_id;
  if (!unitId || !/^u_[a-z0-9_]+$/i.test(unitId)) {
    return NextResponse.json({ error: 'bad_unit_id' }, { status: 400 });
  }

  const unitRow = db.prepare('SELECT id, json, pool, created_at FROM units WHERE id=?').get(unitId) as
    | { id: string; json: string; pool: string; created_at: number }
    | undefined;
  if (!unitRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let unit: any = {};
  try { unit = JSON.parse(unitRow.json); } catch { /* noop */ }
  const type = unit?.type || '';
  if (type !== 'skill_diff_review' && type !== 'skill_diff') {
    return NextResponse.json({ error: 'not_a_skill_review_unit', type }, { status: 400 });
  }

  const judgments = db.prepare(
    `SELECT j.choice, j.created_at, j.honeypot_failed, r.trust,
            rl.judgments_total, rl.agreement_rate, rl.calibration_score
       FROM judgments j
       LEFT JOIN raters r ON r.id = j.rater_id
       LEFT JOIN rater_ledger rl ON rl.rater_id = j.rater_id
      WHERE j.unit_id = ? AND j.honeypot_failed = 0`
  ).all(unitId) as Array<{
    choice: string;
    created_at: number;
    honeypot_failed: number;
    trust: number | null;
    judgments_total: number | null;
    agreement_rate: number | null;
    calibration_score: number | null;
  }>;

  const yesN = judgments.filter((j) => j.choice === 'yes').length;
  const noN = judgments.filter((j) => j.choice === 'no').length;
  const otherN = judgments.length - yesN - noN;
  const n = judgments.length;

  const weighted = computeWeightedConsensus(judgments);
  const weightedDecisive = weighted.total_yes_weight + weighted.total_no_weight;
  const yesWeightedShare = weightedDecisive > 0 ? weighted.total_yes_weight / weightedDecisive : 0;
  const noWeightedShare = weightedDecisive > 0 ? weighted.total_no_weight / weightedDecisive : 0;

  let status: Verdict;
  let consensus = 0;
  if (n < DEFAULT_MIN_N) {
    status = 'pending';
    consensus = weighted.weighted_consensus;
  } else if (yesWeightedShare >= DEFAULT_THRESHOLD) {
    status = 'approved';
    consensus = yesWeightedShare;
  } else if (noWeightedShare >= DEFAULT_THRESHOLD) {
    status = 'rejected';
    consensus = noWeightedShare;
  } else {
    status = 'no_consensus';
    consensus = weighted.weighted_consensus;
  }

  return NextResponse.json({
    ok: true,
    unit_id: unitId,
    type,
    pool: unitRow.pool,
    source_agent: unit?.source_agent || null,
    prompt_context: unit?.prompt_context || null,
    status,
    consensus: Math.round(consensus * 1000) / 1000,
    weighted_consensus: Math.round(weighted.weighted_consensus * 1000) / 1000,
    raw_consensus: Math.round(weighted.raw_consensus * 1000) / 1000,
    n,
    counts: { yes: yesN, no: noN, other: otherN },
    weight_distribution: {
      raters_considered: yesN + noN,
      weighted_raters: weighted.weighted_raters,
      fallback_unweighted_raters: weighted.fallback_unweighted_raters,
      max_weight_applied: Math.round(weighted.max_weight_applied * 1000) / 1000,
      min_weight_applied: Math.round(weighted.min_weight_applied * 1000) / 1000,
      total_yes_weight: Math.round(weighted.total_yes_weight * 1000) / 1000,
      total_no_weight: Math.round(weighted.total_no_weight * 1000) / 1000,
    },
    threshold: DEFAULT_THRESHOLD,
    min_n: DEFAULT_MIN_N,
    last_judged_at: judgments.length ? Math.max(...judgments.map(j => j.created_at)) : null,
    review_url: `/review/${unitId}`,
  });
}
