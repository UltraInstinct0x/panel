// WS-U: admin review queue for operator applications.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listApplications, approveApplication, rejectApplication } from '@/lib/operator-mint';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const status = (req.nextUrl.searchParams.get('status') || 'pending') as any;
  return NextResponse.json({ ok: true, applications: listApplications(status) });
}

// POST /api/admin/onboard/applications  { application_id, action: 'approve'|'reject', reason?, label_override? }
export async function POST(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const id = String(body?.application_id || '');
  const action = body?.action;
  if (action === 'approve') {
    const r = approveApplication({ application_id: id, admin_key: a.admin_key, label_override: body?.label_override });
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
    audit('operator', a.admin_key.slice(0, 12), 'application.approved', 'operator_applications', id, { site_key: r.minted.site_key });
    return NextResponse.json({ ok: true, application_id: r.application_id, minted: r.minted });
  }
  if (action === 'reject') {
    const r = rejectApplication({ application_id: id, admin_key: a.admin_key, reason: String(body?.reason || 'unspecified') });
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
    audit('operator', a.admin_key.slice(0, 12), 'application.rejected', 'operator_applications', id, null);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
