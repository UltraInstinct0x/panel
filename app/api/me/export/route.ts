import { NextRequest, NextResponse } from 'next/server';
import { exportRaterData } from '@/lib/store';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/me/export?rater_id=<id> → downloadable JSON.
// auth model: holding the rater_id cookie / param IS the auth (pseudonymous self-identification).
export async function GET(req: NextRequest) {
  const rater_id = req.nextUrl.searchParams.get('rater_id') || req.cookies.get('panel_rater')?.value || '';
  if (!rater_id) {
    return NextResponse.json({ ok: false, error: 'missing_rater_id' }, { status: 400 });
  }
  const data = exportRaterData(rater_id);
  audit('rater', rater_id, 'me.export', 'raters', rater_id, {
    judgments_count: data.judgments.length,
    has_profile: !!data.rater,
  });
  const body = JSON.stringify(data, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="panel-export-${rater_id}-${Date.now()}.json"`,
      'cache-control': 'no-store',
    },
  });
}
