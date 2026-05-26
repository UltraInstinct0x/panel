import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listHoneypots, insertHoneypot, getHoneypotStats, retireHoneypot, activeCountsByType, HONEYPOT_TYPES } from '@/lib/honeypot';
import type { UnitType } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const type = req.nextUrl.searchParams.get('type') as UnitType | null;
  const status = (req.nextUrl.searchParams.get('status') as 'active' | 'retired' | 'all' | null) ?? 'all';
  const rows = listHoneypots({ type: type ?? undefined, status });
  const out = rows.map(h => ({ ...h, stats: getHoneypotStats(h.honeypot_id) }));
  return NextResponse.json({ ok: true, honeypots: out, active_counts: activeCountsByType(), types: HONEYPOT_TYPES });
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { unit_type, payload, decoy_answer, true_answer, expert_notes } = body || {};
  if (!unit_type || !payload || !decoy_answer || !true_answer || !expert_notes) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!HONEYPOT_TYPES.includes(unit_type)) return NextResponse.json({ error: 'bad_type' }, { status: 400 });
  const h = insertHoneypot({
    unit_type,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    decoy_answer: String(decoy_answer),
    true_answer: String(true_answer),
    expert_notes: String(expert_notes),
  });
  return NextResponse.json({ ok: true, honeypot: h });
}

export async function DELETE(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  retireHoneypot(id);
  return NextResponse.json({ ok: true, retired: id });
}
