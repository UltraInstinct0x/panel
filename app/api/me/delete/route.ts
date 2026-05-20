import { NextRequest, NextResponse } from 'next/server';
import { eraseRater } from '@/lib/store';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/me/delete  body or query: rater_id
// soft-delete: anonymize rater_id, zero behavioral signals. judgment counts preserved as anonymized ML signal.
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const rater_id =
    body?.rater_id ||
    req.nextUrl.searchParams.get('rater_id') ||
    req.cookies.get('panel_rater')?.value ||
    '';
  if (!rater_id) {
    return NextResponse.json({ ok: false, error: 'missing_rater_id' }, { status: 400 });
  }
  const r = eraseRater(rater_id);
  if (!r.ok) {
    audit('rater', rater_id, 'me.delete.miss', 'raters', rater_id, null);
    return NextResponse.json({ ok: false, error: 'rater_not_found' }, { status: 404 });
  }
  audit('rater', rater_id, 'me.delete', 'raters', rater_id, {
    new_id: r.new_id,
    judgments_anonymized: r.judgments_anonymized,
  });
  const res = NextResponse.json({
    ok: true,
    anonymized_to: r.new_id,
    judgments_anonymized: r.judgments_anonymized,
    notice: 'your identifier has been anonymized; judgment counts preserved as aggregate ML signal per Recital 26.',
  });
  // best-effort: clear the cookie so the client stops self-identifying.
  res.cookies.set('panel_rater', '', { path: '/', maxAge: 0 });
  return res;
}
