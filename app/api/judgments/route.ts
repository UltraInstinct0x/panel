import { NextRequest, NextResponse } from 'next/server';
import { recordJudgment } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { unit_id, rater_id, choice, latency_ms, confidence } = body;
  if (!unit_id || !rater_id || !choice) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }
  try {
    const result = recordJudgment({
      unit_id,
      rater_id,
      choice: String(choice),
      latency_ms: Number(latency_ms) || 0,
      confidence: Number(confidence) || 0.5,
    });
    return NextResponse.json({
      ok: true,
      trust: result.rater.trust,
      trust_delta: result.trust_delta,
      earned_cents: result.rater.earned_cents,
      judgments_count: result.rater.judgments_count,
      // never leak agreed_with_gold to rater UI in real impl —
      // exposed here only for demo transparency.
      _demo_agreed_with_gold: result.judgment.agreed_with_gold,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
