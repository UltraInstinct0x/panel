import { NextRequest, NextResponse } from 'next/server';
import { recordJudgment, getUnit } from '@/lib/store';
import { requireSiteKey } from '@/lib/auth';
import { issue, scoreBehavioral } from '@/lib/attestation';

export const dynamic = 'force-dynamic';

const ENGAGEMENT_MIN_MS = 2500;

export async function POST(req: NextRequest) {
  const auth = requireSiteKey(req);
  if (!auth.ok) return auth.res;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const { unit_id, rater_id, choice, latency_ms, confidence, behavioral } = body || {};
  if (!unit_id || !rater_id || !choice) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  const lat = Number(latency_ms) || 0;
  // D13.2: engagement window — reject impossibly-fast submits.
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

    return NextResponse.json({
      ok: true,
      token,
      trust: result.rater.trust,
      trust_delta: result.trust_delta,
      earned_cents: result.rater.earned_cents,
      judgments_count: result.rater.judgments_count,
      // demo-only transparency:
      _demo_agreed_with_gold: result.judgment.agreed_with_gold,
      _demo_honeypot_failed: result.honeypot_failed,
      _demo_behavioral_score: behavioral_score,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
