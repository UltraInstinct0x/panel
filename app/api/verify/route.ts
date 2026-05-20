import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@/lib/attestation';
import { isJtiConsumed, consumeJti } from '@/lib/db';

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
    return NextResponse.json({ ok: false, error: 'replay' }, { status: 409 });
  }
  consumeJti(r.payload.jti, r.payload.exp);

  return NextResponse.json({ ok: true, payload: r.payload });
}
