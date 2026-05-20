// GET /api/v1/skill-review/[unit_id] — public consensus endpoint for skill-diff rater review.
// No auth: verdicts are public artifacts; agents and CI gates poll this URL.
// Shape designed for GitHub Action consumption: status + n + consensus + threshold metadata.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    `SELECT j.choice, j.created_at, j.honeypot_failed, r.trust
       FROM judgments j LEFT JOIN raters r ON r.id = j.rater_id
      WHERE j.unit_id = ? AND j.honeypot_failed = 0`
  ).all(unitId) as { choice: string; created_at: number; honeypot_failed: number; trust: number | null }[];

  let yesW = 0, noW = 0, otherW = 0;
  let yesN = 0, noN = 0, otherN = 0;
  for (const j of judgments) {
    const w = Math.max(0.1, Math.min(1, j.trust ?? 0.5));
    if (j.choice === 'yes') { yesW += w; yesN += 1; }
    else if (j.choice === 'no') { noW += w; noN += 1; }
    else { otherW += w; otherN += 1; }
  }
  const n = yesN + noN + otherN;
  const decisiveW = yesW + noW;
  const yesShare = decisiveW > 0 ? yesW / decisiveW : 0;
  const noShare = decisiveW > 0 ? noW / decisiveW : 0;

  let status: Verdict;
  let consensus = 0;
  if (n < DEFAULT_MIN_N) {
    status = 'pending';
    consensus = Math.max(yesShare, noShare);
  } else if (yesShare >= DEFAULT_THRESHOLD) {
    status = 'approved';
    consensus = yesShare;
  } else if (noShare >= DEFAULT_THRESHOLD) {
    status = 'rejected';
    consensus = noShare;
  } else {
    status = 'no_consensus';
    consensus = Math.max(yesShare, noShare);
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
    n,
    counts: { yes: yesN, no: noN, other: otherN },
    threshold: DEFAULT_THRESHOLD,
    min_n: DEFAULT_MIN_N,
    last_judged_at: judgments.length ? Math.max(...judgments.map(j => j.created_at)) : null,
    review_url: `/review/${unitId}`,
  });
}
