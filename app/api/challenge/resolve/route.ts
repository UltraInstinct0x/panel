// WS-P: POST /api/challenge/resolve
//
// accepts answers + (final) behavioral payload for the active challenge_token.
// returns { success, token, trust, attempts } on pass, or { success: false, retry: true, payload: <same units> } on fail.
//
// D19 anti-reroll invariant: a failed attempt re-renders the SAME unit_ids
// from the session. retry counter advances; after max_attempts, hard-fail.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verify, issue, scoreBehavioral } from '@/lib/attestation';
import { getSession, bumpAttempt, deleteSession } from '@/lib/tier-session';
import { deriveFingerprint } from '@/lib/behavioral-fingerprint';
import { getUnit } from '@/lib/store';
import { recordChallengeResolved } from '@/lib/operator-stats';
import { buildStructuredVerdict, ingestEdgeModelPayload } from '@/lib/edge-model-contract';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const tokenStr = String(body?.challenge_token || '');
  if (!tokenStr) return NextResponse.json({ error: 'missing challenge_token' }, { status: 400 });
  const v = verify(tokenStr);
  if (!v.ok) return NextResponse.json({ error: 'bad_token', reason: v.error }, { status: 400 });
  const jti = v.payload.jti;
  const sess = getSession(jti);
  if (!sess) return NextResponse.json({ error: 'no_session' }, { status: 410 });

  const updated = bumpAttempt(jti)!;
  const fp = deriveFingerprint(body?.fingerprint);
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  const edge = ingestEdgeModelPayload(body?.edge_model);

  // tier-specific resolution
  let pass = false;
  let resolveReason = '';

  if (sess.tier === 'C0') {
    // invisible-auto-check: passive only. require minimum fingerprint trust + dwell floor.
    // 500ms minimum dwell is the spec floor.
    const dwellOk = fp.dwell_ms >= 500;
    const trustOk = fp.trust >= 0.35;
    pass = dwellOk && trustOk;
    if (!pass) resolveReason = !dwellOk ? 'c0_dwell_floor' : 'c0_trust_floor';
  } else {
    // C1/C2/C3: match answers to unit choices. answers is [{ unit_id, choice, latency_ms }, ...]
    if (answers.length < sess.unit_ids.length) {
      pass = false; resolveReason = 'incomplete';
    } else {
      let allOk = true;
      for (const uid of sess.unit_ids) {
        const ans = answers.find((a: any) => a?.unit_id === uid);
        if (!ans) { allOk = false; break; }
        const u: any = getUnit(uid);
        if (!u) { allOk = false; break; }
        // collect valid choice tokens from any of the shapes our units use.
        const valid: string[] = [];
        if (Array.isArray(u.choices)) valid.push(...u.choices.map(String));
        if (u.binary && typeof u.binary === 'object') valid.push(...Object.keys(u.binary));
        if (Array.isArray(u.options)) valid.push(...u.options.map((o: any) => String(o?.id ?? o)));
        if (valid.length > 0 && !valid.includes(String(ans.choice))) { allOk = false; break; }
        // honeypot scoring lives in recordJudgment elsewhere — here we only
        // gate structural validity of the answer.
      }
      pass = allOk;
      if (!pass) resolveReason = 'wrong_or_missing';
    }
  }

  if (!pass) {
    const verdict = buildStructuredVerdict({ pass, trust: fp.trust, resolveReason, edge });
    if (updated.attempts >= updated.max_attempts) {
      try {
        recordChallengeResolved(jti, 'hard_fail', {
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          trust_tier: verdict.trust_tier,
          reason_codes: verdict.reason_codes,
          edge_runtime: edge.runtime,
          edge_model_version: edge.model_version,
          edge_feature_version: edge.feature_version,
          edge_fallback: edge.fallback,
          edge_model_error: edge.model_error,
        });
      } catch {}
      deleteSession(jti);
      return NextResponse.json({
        success: false,
        retry: false,
        hard_fail: true,
        attempts: updated.attempts,
        reason: resolveReason,
        verdict,
        message: 'human verification unavailable, contact site operator',
      }, { status: 403 });
    }
    try {
      recordChallengeResolved(jti, 'retry', {
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        trust_tier: verdict.trust_tier,
        reason_codes: verdict.reason_codes,
        edge_runtime: edge.runtime,
        edge_model_version: edge.model_version,
        edge_feature_version: edge.feature_version,
        edge_fallback: edge.fallback,
        edge_model_error: edge.model_error,
      });
    } catch {}
    // D19: same unit set, same token still valid.
    const units = sess.unit_ids.map(id => getUnit(id)).filter(Boolean);
    return NextResponse.json({
      success: false,
      retry: true,
      attempts: updated.attempts,
      max_attempts: updated.max_attempts,
      units: sess.tier === 'C0' ? [] : units,
      reason: resolveReason,
      verdict,
    });
  }

  // pass — mint verify token (same envelope as judgments path uses).
  const verifyJti = `j_${crypto.randomBytes(10).toString('hex')}`;
  const verifyToken = issue({
    jti: verifyJti,
    uid: sess.unit_ids[0] || `c0:${jti}`,
    rid: v.payload.rid,
    pool: v.payload.pool,
    site_key: sess.site_key,
    rater: { trust: fp.trust, behavioral_score: scoreBehavioral({ dwell_ms: fp.dwell_ms, focus_events: fp.has_focus ? 1 : 0 }) },
    judgment_summary: { agreed_with_pool: null, latency_ms: fp.dwell_ms, honeypot_failed: false },
    scrubber_attestation: { service: 'na', rules_version: 'na', redactions: [], passed: true },
  });
  const verdict = buildStructuredVerdict({ pass, trust: fp.trust, edge });
  try {
    recordChallengeResolved(jti, 'pass', {
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      trust_tier: verdict.trust_tier,
      reason_codes: verdict.reason_codes,
      edge_runtime: edge.runtime,
      edge_model_version: edge.model_version,
      edge_feature_version: edge.feature_version,
      edge_fallback: edge.fallback,
      edge_model_error: edge.model_error,
    });
  } catch {}
  deleteSession(jti);
  try {
    console.info(JSON.stringify({
      evt: 'challenge_resolve_verdict',
      jti,
      verdict: verdict.verdict,
      confidence: round(verdict.confidence, 3),
      trust_tier: verdict.trust_tier,
      runtime: edge.runtime,
      model_version: edge.model_version,
      feature_version: edge.feature_version,
      reason_codes: verdict.reason_codes,
      fallback: edge.fallback,
      model_error: edge.model_error,
    }));
  } catch {}
  return NextResponse.json({
    success: true,
    token: verifyToken,
    trust: round(fp.trust, 3),
    tier_used: sess.tier,
    attempts: updated.attempts,
    verdict,
  });
}

function round(n: number, p: number): number { const f = Math.pow(10, p); return Math.round(n * f) / f; }
