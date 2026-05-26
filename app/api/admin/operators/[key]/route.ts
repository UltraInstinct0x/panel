// WS-Q: PUT /api/admin/operators/[key] — update scrubber_required + label.
// every mutation is logged to events_audit.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSiteKey, upsertSiteKey } from '@/lib/db';
import { logAudit } from '@/lib/operator-audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { key: string } }) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const row = getSiteKey(ctx.params.key);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, site_key: row });
}

export async function PUT(req: NextRequest, ctx: { params: { key: string } }) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const key = ctx.params.key;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const before = getSiteKey(key);
  // upsert semantics: if missing, create with provided values (defaults applied).
  const scrubberRequired = typeof body?.scrubber_required === 'boolean'
    ? body.scrubber_required
    : before?.scrubber_required === 1;
  const label = typeof body?.label === 'string' ? body.label : before?.label ?? null;
  upsertSiteKey(key, scrubberRequired, label ?? undefined);
  const after = getSiteKey(key);
  logAudit({
    event: 'operator.update',
    actor: a.admin_key,
    site_key: key,
    before: before ?? null,
    after,
  });
  return NextResponse.json({ ok: true, site_key: after });
}
