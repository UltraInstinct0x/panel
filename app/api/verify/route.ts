import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@/lib/attestation';
import { isJtiConsumed, consumeJti } from '@/lib/db';
import { audit } from '@/lib/audit';
import { enforceBillingGate } from '@/lib/billing/gate';
import { recordVerify } from '@/lib/billing/meter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }
  const token = body?.token;
  if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  const r = verify(String(token));
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });

  // D-hardening: replay protection. jti consumed once, then locked.
  // (verify() already rejects expired tokens — exp < now)
  if (isJtiConsumed(r.payload.jti)) {
    audit('operator', String(r.payload.site_key || 'unknown'), 'verify.replay_rejected', 'jti_consumed', String(r.payload.jti), null);
    return NextResponse.json({ ok: false, error: 'replay' }, { status: 409 });
  }
  consumeJti(r.payload.jti, r.payload.exp);
  const operatorId = String(r.payload.site_key || 'default_operator');
  const gate = enforceBillingGate(operatorId);
  if (gate) return gate;
  recordVerify(operatorId);
  audit('operator', String(r.payload.site_key || 'unknown'), 'verify.ok', 'judgments', String(r.payload.jti || ''), {
    jti: r.payload.jti,
    score: r.payload.rater?.behavioral_score,
  });

  return NextResponse.json({ ok: true, payload: r.payload });
}
