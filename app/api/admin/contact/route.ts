// admin contact queue — list + triage contact_submissions.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_STATUS = new Set(['new', 'triaged', 'resolved', 'spam']);

export async function GET(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'new';
  const topicFilter = url.searchParams.get('topic') || 'all';
  const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);

  const where: string[] = [];
  const params: any[] = [];
  if (statusFilter !== 'all') {
    where.push('status = ?');
    params.push(statusFilter);
  }
  if (topicFilter !== 'all') {
    where.push('topic = ?');
    params.push(topicFilter);
  }
  const sql = `
    SELECT id, topic, name, email, org, subject, message,
           ip_hash, user_agent, status, created_at,
           handled_at, handled_by, notes
    FROM contact_submissions
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  // summary counts per status
  const counts = db.prepare(`
    SELECT status, COUNT(*) AS n FROM contact_submissions GROUP BY status
  `).all() as Array<{ status: string; n: number }>;

  const summary: Record<string, number> = { new: 0, triaged: 0, resolved: 0, spam: 0 };
  for (const c of counts) summary[c.status] = c.n;

  return NextResponse.json({ ok: true, submissions: rows, summary });
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const id = String(body?.id || '').trim();
  const newStatus = String(body?.status || '').trim();
  const notes = body?.notes ? String(body.notes).trim().slice(0, 2000) : null;

  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  if (!ALLOWED_STATUS.has(newStatus)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 });

  const row = db.prepare('SELECT id, status FROM contact_submissions WHERE id = ?').get(id) as { id: string; status: string } | undefined;
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  db.prepare(`
    UPDATE contact_submissions
    SET status = ?, handled_at = ?, handled_by = ?, notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(newStatus, Date.now(), a.admin_key || 'admin', notes, id);

  audit('system', a.admin_key || 'admin', 'contact.triaged', 'contact_submissions', id, {
    from: row.status, to: newStatus, has_notes: !!notes,
  });

  return NextResponse.json({ ok: true });
}
