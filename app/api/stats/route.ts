import { NextResponse } from 'next/server';
import { stats, listJudgments } from '@/lib/store';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = stats();
  const recent = listJudgments(undefined, 20);

  // derived: avg latency over last 500 judgments
  const latRow = db
    .prepare('SELECT AVG(latency_ms) AS a FROM (SELECT latency_ms FROM judgments ORDER BY created_at DESC LIMIT 500)')
    .get() as { a: number | null };
  const avg_latency_ms = Math.round(latRow.a ?? 0);

  // derived: solve rate (proxy: judgments that produced a scored agreement OR null gold (no-gold units))
  // here we treat: "solve" = any judgment NOT honeypot_failed. "challenge served" = total_judgments.
  const solveRow = db
    .prepare('SELECT COUNT(*) AS solved FROM judgments WHERE honeypot_failed = 0').get() as { solved: number };
  const solve_rate_pct = base.total_judgments > 0
    ? (solveRow.solved / base.total_judgments) * 100
    : 100;

  // bot-flag rate: honeypot failures / total judgments
  const bot_flag_rate_pct = base.total_judgments > 0
    ? (base.honeypot_failures / base.total_judgments) * 100
    : 0;

  // captcha-quality: agreement-rate among scored judgments
  const agRow = db
    .prepare("SELECT SUM(CASE WHEN agreed_with_gold=1 THEN 1 ELSE 0 END) AS ok, SUM(CASE WHEN agreed_with_gold IS NOT NULL THEN 1 ELSE 0 END) AS scored FROM judgments")
    .get() as { ok: number | null; scored: number | null };
  const captcha_quality_pct = (agRow.scored ?? 0) > 0 ? ((agRow.ok ?? 0) / (agRow.scored as number)) * 100 : 0;

  // trust distribution buckets (10 buckets of 10%)
  const trustRows = db.prepare('SELECT trust FROM raters').all() as { trust: number }[];
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    trust_lo: i / 10,
    label: `${i * 10}–${(i + 1) * 10}%`,
    raters: 0,
  }));
  for (const r of trustRows) {
    const idx = Math.min(9, Math.max(0, Math.floor(r.trust * 10)));
    buckets[idx].raters += 1;
  }

  return NextResponse.json({
    ...base,
    avg_latency_ms,
    solve_rate_pct,
    bot_flag_rate_pct,
    captcha_quality_pct,
    trust_distribution: buckets,
    recent_judgments: recent,
  });
}
