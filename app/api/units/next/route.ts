import { NextRequest, NextResponse } from 'next/server';
import { pickNextUnit, getOrCreateRater, UnitPool } from '@/lib/store';
import { requireSiteKey } from '@/lib/auth';
import { scrubberConfigured, scrubText } from '@/lib/scrubber-client';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { logAccess } from '@/lib/logger';
import { resolveRaterSession } from '@/lib/db';

export const dynamic = 'force-dynamic';

function bearerToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const ip = clientIp(req);
  const siteKeyHdr = req.headers.get('x-panel-site-key') || req.nextUrl.searchParams.get('site_key');
  const rl = checkBoth(ip, siteKeyHdr);
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'rate_limited', scope: rl.scope, retry_after_s: rl.retry_after_s },
      { status: 429 },
    );
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    logAccess({ ts: started, method: 'GET', path: '/api/units/next', status: 429, ms: Date.now() - started, site_key: siteKeyHdr, ip, rl });
    return res;
  }

  const auth = requireSiteKey(req);
  if (!auth.ok) {
    logAccess({ ts: started, method: 'GET', path: '/api/units/next', status: 401, ms: Date.now() - started, site_key: siteKeyHdr, ip, rl });
    return auth.res;
  }

  const tok = bearerToken(req);
  if (!tok) {
    logAccess({ ts: started, method: 'GET', path: '/api/units/next', status: 401, ms: Date.now() - started, site_key: auth.site_key, ip, rl });
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const sess = resolveRaterSession(tok);
  if (!sess) {
    logAccess({ ts: started, method: 'GET', path: '/api/units/next', status: 401, ms: Date.now() - started, site_key: auth.site_key, ip, rl });
    return NextResponse.json({ error: 'invalid_rater_session' }, { status: 401 });
  }
  const rater_id = sess.rater_id;
  const poolParam = (req.nextUrl.searchParams.get('pool') || 'public') as UnitPool;
  if (poolParam === 'technical' && !rater_id.startsWith('t2_') && !rater_id.startsWith('t3_')) {
    logAccess({ ts: started, method: 'GET', path: '/api/units/next', status: 403, ms: Date.now() - started, site_key: auth.site_key, ip, rl });
    return NextResponse.json({ error: 'technical_pool_requires_trust_tier' }, { status: 403 });
  }
  getOrCreateRater(rater_id);
  const u = pickNextUnit(rater_id, poolParam, auth.site_key);
  const { gold, obvious_wrong_answer, is_honeypot, ...safe } = u;

  const sendJson = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    logAccess({ ts: started, method: 'GET', path: '/api/units/next', status, ms: Date.now() - started, site_key: auth.site_key, ip, rl });
    return res;
  };

  // F: technical-pool units go through scrubber-proxy when configured (fail-closed).
  if (poolParam === 'technical' && scrubberConfigured()) {
    const candidateKeys = ['prompt', 'body', 'content', 'text', 'question'];
    let scrubbed = false;
    let engine = '';
    for (const k of candidateKeys) {
      const v = (safe as any)[k];
      if (typeof v !== 'string' || !v) continue;
      const r = await scrubText(v);
      if (!r.ok) {
        return sendJson(
          { error: 'scrubber_unavailable', detail: r.error, pool: 'technical' },
          503,
        );
      }
      (safe as any)[k] = r.text;
      scrubbed = true;
      engine = r.engine_version;
    }
    return sendJson({ ...safe, scrubbed, scrubber_engine: scrubbed ? engine : null });
  }

  return sendJson(safe);
}
