import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRater, listJudgments } from '@/lib/store';
import { resolveRaterSession } from '@/lib/db';

export const dynamic = 'force-dynamic';

function bearerToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function GET(req: NextRequest) {
  const tok = bearerToken(req);
  if (!tok) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const sess = resolveRaterSession(tok);
  if (!sess) return NextResponse.json({ error: 'invalid_rater_session' }, { status: 401 });
  const rater_id = sess.rater_id;
  const rater = getOrCreateRater(rater_id);
  return NextResponse.json({ rater, recent: listJudgments(rater_id, 25) });
}
