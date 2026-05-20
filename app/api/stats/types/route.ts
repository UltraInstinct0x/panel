import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { StatsTypesResponse, TypeDistRow } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats/types
 * distribution of unit-types across the pool + per-type judgment counts.
 */
export async function GET() {
  const unitRows = db
    .prepare('SELECT json FROM units')
    .all() as { json: string }[];
  const judgRows = db
    .prepare(
      `SELECT u.json AS json, j.id AS jid
       FROM judgments j JOIN units u ON u.id = j.unit_id`,
    )
    .all() as { json: string; jid: string }[];

  const by_type = new Map<string, TypeDistRow>();
  for (const r of unitRows) {
    try {
      const u = JSON.parse(r.json) as { type: string };
      const cur = by_type.get(u.type) ?? { type: u.type, units: 0, judgments: 0 };
      cur.units += 1;
      by_type.set(u.type, cur);
    } catch { /* skip */ }
  }
  for (const r of judgRows) {
    try {
      const u = JSON.parse(r.json) as { type: string };
      const cur = by_type.get(u.type) ?? { type: u.type, units: 0, judgments: 0 };
      cur.judgments += 1;
      by_type.set(u.type, cur);
    } catch { /* skip */ }
  }

  const body: StatsTypesResponse = {
    total_units: unitRows.length,
    total_judgments: judgRows.length,
    by_type: Array.from(by_type.values()).sort((a, b) => b.judgments - a.judgments || b.units - a.units),
  };
  return NextResponse.json(body);
}
