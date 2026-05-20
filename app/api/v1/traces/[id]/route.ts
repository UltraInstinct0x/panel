// WS-N: GET /v1/traces/[id] — poll an async trace.
import { NextRequest, NextResponse } from 'next/server';
import { getTrace } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  // WS-T: migrated to kysely (queries.getTrace)
  const row = await getTrace(id);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.status === 'pending') {
    return NextResponse.json({ trace_id: row.trace_id, status: 'pending' }, { status: 202 });
  }
  let result: any = {};
  try { result = JSON.parse(row.result_json || '{}'); } catch {}
  return NextResponse.json({
    trace_id: row.trace_id,
    status: row.status,
    blob_size: row.blob_size,
    ingested_at: row.ingested_at,
    ...result,
  });
}
