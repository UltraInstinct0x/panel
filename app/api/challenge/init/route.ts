// WS-P: POST /api/challenge/init
// assigns a tier based on (passive fingerprint + risk signals + operator policy),
// returns a signed challenge_token + unit payload per tier.
//
// contract:
//   request:  { site_key, pool?, fingerprint?: RawFingerprint, fingerprint_id?, session_age_ms? }
//   response: {
//     tier: 'C0'|'C1'|'C2'|'C3',
//     challenge_token: string,
//     units: Unit[],                  // [] for C0, [1] for C1, [2-3] for C2, [3-5] for C3
//     trust: number, risk: number,    // diagnostics — also embedded in token
//     max_attempts: number,
//     animation_hint?: { glyph: string; ms: number }   // C0 only
//   }
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { deriveFingerprint } from '@/lib/behavioral-fingerprint';
import { riskFromReq } from '@/lib/threat-score';
import { pickTier, DEFAULT_POLICY, TierPolicy } from '@/lib/tier-ladder';
import { createSession } from '@/lib/tier-session';
import { getTierPolicyJson, getSiteKey, getActiveSiteKey } from '@/lib/db';
import { recordChallengeIssued } from '@/lib/operator-stats';
import { pickNextUnit } from '@/lib/store';
import { issue } from '@/lib/attestation';
import { audit } from '@/lib/audit';

const DEMO_SITE_KEY = process.env.PANEL_DEMO_SITE_KEY || 'demo_public';

export const dynamic = 'force-dynamic';

function loadPolicy(siteKey: string): TierPolicy {
  const raw = getTierPolicyJson(siteKey);
  if (!raw) return DEFAULT_POLICY;
  try {
    const p = JSON.parse(raw);
    return { ...DEFAULT_POLICY, ...p };
  } catch {
    return DEFAULT_POLICY;
  }
}

function countForTier(t: 'C0'|'C1'|'C2'|'C3'): number {
  if (t === 'C0') return 0;
  if (t === 'C1') return 1;
  if (t === 'C2') return 2;
  return 3;
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const siteKey = String(body?.site_key || '');
  if (!siteKey) return NextResponse.json({ error: 'missing site_key' }, { status: 400 });
  const pool = (body?.pool === 'technical' ? 'technical' : 'public') as 'public' | 'technical';

  // launch-blocker T2: reject unknown/inactive site_keys; demo key is the
  // sole exception (kept for marketing demo path without a real operator row).
  const isDemoKey = siteKey === DEMO_SITE_KEY;
  if (!isDemoKey) {
    const active = getActiveSiteKey(siteKey);
    if (!active) {
      try {
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
        audit('operator', siteKey, 'challenge.site_key_rejected', 'site_keys', siteKey, { ip });
      } catch {}
      return NextResponse.json({ error: 'site_key_unknown_or_inactive' }, { status: 403 });
    }
  } else {
    void getSiteKey(siteKey);
  }

  const fp = deriveFingerprint(body?.fingerprint);
  const risk = riskFromReq(req, body?.fingerprint_id || null, Number(body?.session_age_ms) || 0);
  const policy = loadPolicy(siteKey);
  let tier = pickTier(policy, fp, risk.score);

  // launch-blocker T1: _debug_force_tier gated on non-prod NODE_ENV AND signed
  // header matching PANEL_DEBUG_SECRET. Unset secret → unconditionally disabled.
  // Disallowed requests are silently ignored (no 4xx — avoids leaking env state).
  const debugAllowed =
    process.env.NODE_ENV !== 'production' &&
    !!process.env.PANEL_DEBUG_SECRET &&
    req.headers.get('x-panel-debug-secret') === process.env.PANEL_DEBUG_SECRET;
  const requestedForced = body?._debug_force_tier;
  const forced = debugAllowed ? requestedForced : undefined;
  if (forced === 'C0' || forced === 'C1' || forced === 'C2' || forced === 'C3') {
    tier = forced;
  } else if (requestedForced && !debugAllowed) {
    try {
      audit('operator', siteKey, 'challenge.debug_force_tier_ignored', 'challenge', '', {
        site_key: siteKey,
        requested: String(requestedForced),
      });
    } catch {}
  }

  // pick units. for C2/C3 we pick distinct units (anti-dup).
  const raterId = String(body?.rater_id || `anon_${crypto.randomBytes(6).toString('hex')}`);
  const need = countForTier(tier);
  const units: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < need; i++) {
    let tries = 0;
    while (tries++ < 8) {
      const u = pickNextUnit(raterId, pool, siteKey);
      if (!seen.has(u.id)) { seen.add(u.id); units.push(u); break; }
    }
  }

  // mint challenge_token — signed jti, carries tier + unit_ids + trust.
  const jti = `ch_${crypto.randomBytes(10).toString('hex')}`;
  // we reuse the attestation envelope but with a distinct "kind" via uid="challenge:<jti>"
  // and a short exp (5min). this is *not* the verify token — that gets minted on resolve.
  const token = issue({
    jti,
    uid: `challenge:${jti}`,
    rid: raterId,
    pool,
    site_key: siteKey,
    rater: { trust: fp.trust, behavioral_score: fp.trust },
    judgment_summary: { agreed_with_pool: null, latency_ms: 0, honeypot_failed: false },
    scrubber_attestation: { service: 'na', rules_version: 'na', redactions: [], passed: true },
    exp_ms: 5 * 60 * 1000,
  });

  // WS-Q: record issuance for operator dashboard stats.
  try { recordChallengeIssued({ jti, site_key: siteKey, tier, pool, trust: fp.trust, risk: risk.score }); } catch {}

  const sess = createSession({
    id: jti,
    site_key: siteKey,
    tier,
    unit_ids: units.map(u => u.id),
  });

  const resp: any = {
    tier,
    challenge_token: token,
    units: tier === 'C0' ? [] : units,
    trust: round(fp.trust, 3),
    risk: round(risk.score, 3),
    risk_reasons: risk.reasons,
    max_attempts: sess.max_attempts,
    rater_id: raterId,
  };
  if (isDemoKey) resp.pool = 'public';
  if (tier === 'C0') {
    // panel-native animation hint. widget owns the implementation; this is the spec marker.
    resp.animation_hint = { glyph: 'diamond_scanline', ms: 1200, caption: 'verified' };
  }
  return NextResponse.json(resp);
}

function round(n: number, p: number): number { const f = Math.pow(10, p); return Math.round(n * f) / f; }
