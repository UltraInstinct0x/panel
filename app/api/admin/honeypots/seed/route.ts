// WS-O: trigger honeypot seed load (idempotent). admin-only.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { seedHoneypotsFromFile } from '@/lib/honeypot_seed';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const r = seedHoneypotsFromFile();
  return NextResponse.json({ ok: true, ...r });
}
