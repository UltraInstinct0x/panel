import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { SeriesPoint, StatsSeriesResponse } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats/series?window=7d[&rater_id=…]
 * daily buckets (UTC) of judgments, agreed, disagreed, honeypot_failed, agreement_pct.
 */
export async function GET(req: NextRequest) {
  const windowParam = req.nextUrl.searchParams.get('window') || '7d';
  const raterId = req.nextUrl.searchParams.get('rater_id') || undefined;
  const days = parseWindowDays(windowParam);

  const now = Date.now();
  const dayMs = 86_400_000;
  // start at UTC midnight `days-1` days ago so we return exactly `days` buckets ending today
  const todayMid = Math.floor(now / dayMs) * dayMs;
  const startMs = todayMid - (days - 1) * dayMs;

  const where = raterId
    ? 'WHERE created_at >= ? AND rater_id = ?'
    : 'WHERE created_at >= ?';
  const params = raterId ? [startMs, raterId] : [startMs];

  const rows = db
    .prepare(
      `SELECT created_at, agreed_with_gold, honeypot_failed FROM judgments ${where}`,
    )
    .all(...params) as { created_at: number; agreed_with_gold: number | null; honeypot_failed: number }[];

  const buckets = new Map<number, SeriesPoint>();
  for (let i = 0; i < days; i++) {
    const t = startMs + i * dayMs;
    buckets.set(t, {
      t,
      date: new Date(t).toISOString().slice(0, 10),
      judgments: 0,
      agreed: 0,
      disagreed: 0,
      honeypot_failed: 0,
      agreement_pct: null,
    });
  }
  for (const r of rows) {
    const t = Math.floor(r.created_at / dayMs) * dayMs;
    const b = buckets.get(t);
    if (!b) continue;
    b.judgments += 1;
    if (r.agreed_with_gold === 1) b.agreed += 1;
    else if (r.agreed_with_gold === 0) b.disagreed += 1;
    if (r.honeypot_failed) b.honeypot_failed += 1;
  }
  const series = Array.from(buckets.values()).map(b => {
    const scored = b.agreed + b.disagreed;
    return { ...b, agreement_pct: scored > 0 ? (b.agreed / scored) * 100 : null };
  });

  const body: StatsSeriesResponse = { window_days: days, series };
  return NextResponse.json(body);
}

function parseWindowDays(w: string): number {
  const m = /^(\d+)d$/.exec(w);
  if (!m) return 7;
  return Math.max(1, Math.min(90, parseInt(m[1], 10)));
}
