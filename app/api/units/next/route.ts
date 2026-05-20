import { NextRequest, NextResponse } from 'next/server';
import { pickNextUnit, getOrCreateRater, UnitPool } from '@/lib/store';
import { requireSiteKey } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = requireSiteKey(req);
  if (!auth.ok) return auth.res;

  const rater_id = req.nextUrl.searchParams.get('rater_id') || 'anon';
  const poolParam = (req.nextUrl.searchParams.get('pool') || 'public') as UnitPool;
  // D12: technical pool requires a trust-tier rater id prefix (T2+). anon → forbidden.
  if (poolParam === 'technical' && !rater_id.startsWith('t2_') && !rater_id.startsWith('t3_')) {
    return NextResponse.json({ error: 'technical_pool_requires_trust_tier' }, { status: 403 });
  }
  getOrCreateRater(rater_id);
  const u = pickNextUnit(rater_id, poolParam);
  // strip gold + honeypot internals before sending
  const { gold, obvious_wrong_answer, is_honeypot, ...safe } = u;
  return NextResponse.json(safe);
}
