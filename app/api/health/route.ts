import { NextResponse } from 'next/server';
import { db, registerShutdown } from '@/lib/db';
import { stats } from '@/lib/store';

export const dynamic = 'force-dynamic';

// register graceful shutdown handlers on first health hit (or any cold start).
registerShutdown();
const STARTED_AT = Date.now();

export async function GET() {
  let db_ok = false;
  let units = 0;
  let judgments = 0;
  try {
    const r1 = db.prepare('SELECT 1 AS x').get() as { x: number };
    db_ok = r1?.x === 1;
    const s = stats();
    units = s.total_units;
    judgments = s.total_judgments;
  } catch {}
  const status = db_ok ? 'ok' : 'degraded';
  return NextResponse.json({
    status,
    db_ok,
    uptime_s: Math.floor((Date.now() - STARTED_AT) / 1000),
    units,
    judgments,
    version: process.env.PANEL_VERSION || 'dev',
  }, { status: db_ok ? 200 : 503 });
}
