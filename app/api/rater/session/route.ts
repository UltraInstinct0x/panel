import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verify } from '@/lib/attestation';
import { createRaterSession } from '@/lib/db';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { verify_token?: string } | null;
  const tok = body?.verify_token;
  if (!tok) return NextResponse.json({ error: 'missing_verify_token' }, { status: 400 });

  const v = verify(tok);
  if (!v.ok) return NextResponse.json({ error: 'invalid_verify_token' }, { status: 401 });
  const rid = (v.payload as any).rid;
  const siteKey = (v.payload as any).site_key || null;
  if (!rid) return NextResponse.json({ error: 'invalid_verify_token' }, { status: 401 });

  const token = crypto.randomBytes(32).toString('base64url');
  const { expires_at } = createRaterSession(token, String(rid), siteKey);
  try { audit('rater', String(rid), 'rater.session_created', 'rater_sessions', token, { site_key: siteKey }); } catch {}
  return NextResponse.json({ session: token, expires_at });
}
