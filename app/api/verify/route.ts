import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@/lib/attestation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }
  const token = body?.token;
  if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  const r = verify(String(token));
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, payload: r.payload });
}
