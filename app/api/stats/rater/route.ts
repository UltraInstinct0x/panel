import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { RaterAgreementPoint } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats/rater?rater_id=…&limit=14
 * per-rater rolling-agreement trajectory across last N judgments (oldest→newest).
 * also returns a per-type breakdown for the rater.
 */
export async function GET(req: NextRequest) {
  const raterId = req.nextUrl.searchParams.get('rater_id') || '';
  const limit = Math.max(1, Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') || '14', 10)));
  if (!raterId) return NextResponse.json({ error: 'rater_id required' }, { status: 400 });

  const rater = db.prepare('SELECT trust FROM raters WHERE id = ?').get(raterId) as { trust: number } | undefined;
  const currentTrust = rater?.trust ?? 0.5;

  // pull last `limit` judgments newest-first, then reverse to oldest-first for charting
  const rows = db
    .prepare(
      `SELECT j.created_at, j.agreed_with_gold, j.honeypot_failed, u.json AS ujson
       FROM judgments j LEFT JOIN units u ON u.id = j.unit_id
       WHERE j.rater_id = ? ORDER BY j.created_at DESC LIMIT ?`,
    )
    .all(raterId, limit) as { created_at: number; agreed_with_gold: number | null; honeypot_failed: number; ujson: string | null }[];

  const oldestFirst = rows.reverse();

  // simulate trust trajectory backwards from current using the same rule the store uses
  // (forward sim is fine since rules are deterministic given pre-state)
  let trust = 0.5;
  // walk through *all* judgments older than these to get an approximate start trust? cheaper: start at 0.5.
  const series: RaterAgreementPoint[] = [];
  let win: (boolean | null)[] = [];
  const WIN = 5;
  for (let i = 0; i < oldestFirst.length; i++) {
    const r = oldestFirst[i];
    const agreed = r.agreed_with_gold === null ? null : !!r.agreed_with_gold;
    const honey = !!r.honeypot_failed;
    if (honey) trust = trust * 0.6;
    else if (agreed === true) trust = trust + (1 - trust) * 0.08;
    else if (agreed === false) trust = trust * 0.92;
    trust = Math.max(0, Math.min(1, trust));

    win.push(agreed);
    if (win.length > WIN) win = win.slice(-WIN);
    const scored = win.filter(v => v !== null) as boolean[];
    const rolling = scored.length ? (scored.filter(Boolean).length / scored.length) * 100 : 0;

    let type: string | null = null;
    if (r.ujson) {
      try { type = (JSON.parse(r.ujson) as { type: string }).type; } catch {}
    }
    series.push({
      i: i + 1,
      rolling_pct: Math.round(rolling * 10) / 10,
      trust_pct: Math.round(trust * 1000) / 10,
      type,
    });
  }

  // per-type breakdown for *this rater*
  const typeRows = db
    .prepare(
      `SELECT u.json AS ujson, COUNT(*) AS n
       FROM judgments j JOIN units u ON u.id = j.unit_id
       WHERE j.rater_id = ? GROUP BY u.json`,
    )
    .all(raterId) as { ujson: string; n: number }[];
  const byType = new Map<string, number>();
  for (const r of typeRows) {
    try {
      const t = (JSON.parse(r.ujson) as { type: string }).type;
      byType.set(t, (byType.get(t) ?? 0) + r.n);
    } catch {}
  }

  return NextResponse.json({
    rater_id: raterId,
    current_trust_pct: Math.round(currentTrust * 1000) / 10,
    series,
    by_type: Array.from(byType.entries()).map(([type, judgments]) => ({ type, judgments })),
  });
}
