import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.redirect('http://127.0.0.1:3015/rater/payouts?return=1');
}
