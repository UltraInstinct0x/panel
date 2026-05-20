import { NextRequest, NextResponse } from 'next/server';
import { pickNextUnit, getOrCreateRater } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rater_id = req.nextUrl.searchParams.get('rater_id') || 'anon';
  getOrCreateRater(rater_id);
  const u = pickNextUnit(rater_id);
  // strip gold before sending — never leak ground truth to rater
  const { gold, ...safe } = u;
  return NextResponse.json(safe);
}
