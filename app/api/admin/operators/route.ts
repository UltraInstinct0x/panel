// WS-Q: GET /api/admin/operators — list site_keys with summary stats.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  listAllSiteKeys,
  ingestCount,
  challengeCount,
} from '@/lib/operator-stats';
import { DEFAULT_POLICY } from '@/lib/tier-ladder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const rows = listAllSiteKeys();
  const out = rows.map(r => {
    let policy: any = { ...DEFAULT_POLICY };
    if (r.tier_policy) {
      try { policy = { ...DEFAULT_POLICY, ...JSON.parse(r.tier_policy) }; } catch {}
    }
    return {
      site_key: r.site_key,
      label: r.label,
      scrubber_required: r.scrubber_required === 1,
      created_at: r.created_at,
      tier_policy: policy,
      stats_7d: {
        ingests: ingestCount(r.site_key, 7),
        challenges: challengeCount(r.site_key, 7),
      },
    };
  });
  return NextResponse.json({ ok: true, operators: out });
}
