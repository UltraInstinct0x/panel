import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRater, listJudgments } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rater_id = req.nextUrl.searchParams.get('rater_id') || 'anon';
  const rater = getOrCreateRater(rater_id);
  return NextResponse.json({
    rater,
    recent: listJudgments(rater_id, 25),
  });
}
