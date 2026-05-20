import { NextResponse } from 'next/server';
import { stats, listJudgments } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ...stats(),
    recent_judgments: listJudgments(undefined, 20),
  });
}
