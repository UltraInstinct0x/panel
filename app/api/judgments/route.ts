import { NextRequest, NextResponse } from 'next/server';
import { recordJudgment, getUnit } from '@/lib/store';
import { requireSiteKey } from '@/lib/auth';
import { issue, scoreBehavioral } from '@/lib/attestation';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { logAccess } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ENGAGEMENT_MIN_MS = 2500;

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIp(req);
  const siteKeyHdr = req.headers.get('x-panel-site-key');
  const rl = checkBoth(ip, siteKeyHdr);
  if (!rl.ok) {
    const res = NextResponse.json({ error: 'rate_limited', scope: rl.scope, retry_after_s: rl.retry_after_s }, { status: 429 });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    logAccess({ ts: started, method: 'POST', path: '/api/judgments', status: 429, ms: Date.now() - started, site_key: siteKeyHdr, ip, rl });
    return res;
  }

  const auth = requireSiteKey(req);
  if (!auth.ok) {
    logAccess({ ts: started, method: 'POST', path: '/api/judgments', status: 401, ms: Date.now() - started, site_key: siteKeyHdr, ip, rl });
    return auth.res;
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const { unit_id, rater_id, choice, latency_ms, confidence, behavioral } = body || {};
  if (!unit_id || !rater_id || !choice) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  const lat = Number(latency_ms) || 0;
  if (lat < ENGAGEMENT_MIN_MS) {
    return NextResponse.json({ error: 'too_fast', min_ms: ENGAGEMENT_MIN_MS }, { status: 429 });
  }

  try {
    const result = recordJudgment({
      unit_id,
      rater_id: String(rater_id),
      choice: String(choice),
      latency_ms: lat,
      confidence: Number(confidence) || 0.5,
      site_key: auth.site_key,
      behavioral,
    });

    const unit = getUnit(unit_id)!;
    const behavioral_score = scoreBehavioral(behavioral);
    const token = issue({
      jti: result.judgment.id,
      uid: unit_id,
      rid: rater_id,
      pool: unit.pool,
      site_key: auth.site_key,
      rater: { trust: result.rater.trust, behavioral_score },
      judgment_summary: {
        agreed_with_pool: result.judgment.agreed_with_gold,
        latency_ms: lat,
        honeypot_failed: result.honeypot_failed,
      },
      scrubber_attestation: {
        service: 'scrubber-proxy@v0.3.2',
        rules_version: 'compliance/gdpr-2026.05',
        redactions: ['pii.email', 'pii.ipv4'],
        passed: true,
      },
    });

    const res = NextResponse.json({
      ok: true,
      token,
      trust: result.rater.trust,
      trust_delta: result.trust_delta,
      earned_cents: result.rater.earned_cents,
      judgments_count: result.rater.judgments_count,
      _demo_agreed_with_gold: result.judgment.agreed_with_gold,
      _demo_honeypot_failed: result.honeypot_failed,
      _demo_behavioral_score: behavioral_score,
    });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    logAccess({ ts: started, method: 'POST', path: '/api/judgments', status: 200, ms: Date.now() - started, site_key: auth.site_key, ip, rl });
    return res;
  } catch (e: any) {
    logAccess({ ts: started, method: 'POST', path: '/api/judgments', status: 400, ms: Date.now() - started, site_key: auth.site_key, ip, rl, err: String(e?.message || e) });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
