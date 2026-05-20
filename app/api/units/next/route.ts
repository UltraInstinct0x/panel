import { NextRequest, NextResponse } from 'next/server';
import { pickNextUnit, getOrCreateRater, UnitPool } from '@/lib/store';
import { requireSiteKey } from '@/lib/auth';
import { scrubberConfigured, scrubText } from '@/lib/scrubber-client';

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

  // F: technical-pool units go through scrubber-proxy when configured (fail-closed).
  if (poolParam === 'technical' && scrubberConfigured()) {
    // Scrub any string fields in the unit body (prompt, body, content, text).
    const candidateKeys = ['prompt', 'body', 'content', 'text', 'question'];
    let scrubbed = false;
    let engine = '';
    for (const k of candidateKeys) {
      const v = (safe as any)[k];
      if (typeof v !== 'string' || !v) continue;
      const r = await scrubText(v);
      if (!r.ok) {
        return NextResponse.json(
          { error: 'scrubber_unavailable', detail: r.error, pool: 'technical' },
          { status: 503 }
        );
      }
      (safe as any)[k] = r.text;
      scrubbed = true;
      engine = r.engine_version;
    }
    return NextResponse.json({ ...safe, scrubbed, scrubber_engine: scrubbed ? engine : null });
  }

  return NextResponse.json(safe);
}
