import { db } from '@/lib/db';

export type LedgerRow = {
  rater_id: string;
  judgments_total: number;
  converged_judgments_total: number;
  converged_agree_total: number;
  agreement_rate: number;
  calibration_events_total: number;
  calibration_brier_sum: number;
  calibration_score: number;
  last_seen: number;
};

export type WeightedConsensusResult = {
  weighted_consensus: number;
  raw_consensus: number;
  total_yes_weight: number;
  total_no_weight: number;
  weighted_raters: number;
  fallback_unweighted_raters: number;
  min_weight_applied: number;
  max_weight_applied: number;
};

export function platformFeeBpsForRater(input: { defaultBps: number; isT3: boolean; designPartnerManaged: boolean }): number {
  if (input.designPartnerManaged) return 0;
  if (input.isT3) return 1500;
  return input.defaultBps;
}

export function creditRater(raterId: string, amountCents: number, judgmentId: string, platformFeeBps = 2000): { netCents: number; grossCents: number } {
  const gross = Math.max(0, Math.floor(amountCents));
  const fee = Math.floor((gross * platformFeeBps) / 10_000);
  const net = Math.max(0, gross - fee);
  db.prepare(`INSERT INTO rater_credits (id, rater_id, judgment_id, gross_cents, platform_fee_bps, net_cents, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    ON CONFLICT(judgment_id) DO NOTHING`).run(
      `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      raterId,
      judgmentId,
      gross,
      platformFeeBps,
      net,
      Date.now(),
    );
  return { netCents: net, grossCents: gross };
}

const PANEL_RATER_LEDGER_MIN_JUDGMENTS = Number(process.env.PANEL_RATER_LEDGER_MIN_JUDGMENTS || 12);

export function getLedgerFallbackThreshold(): number {
  return Number.isFinite(PANEL_RATER_LEDGER_MIN_JUDGMENTS) && PANEL_RATER_LEDGER_MIN_JUDGMENTS > 0
    ? PANEL_RATER_LEDGER_MIN_JUDGMENTS
    : 12;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeLedgerWeight(ledger: Pick<LedgerRow, 'agreement_rate' | 'judgments_total' | 'calibration_score'>): number {
  const a = clamp(ledger.agreement_rate, 0, 1);
  const c = clamp(ledger.calibration_score, 0, 1);
  const j = Math.max(0, ledger.judgments_total);
  const reliability = 0.5 + 0.5 * a;
  const volume = Math.min(1, Math.log(1 + j) / Math.log(1 + 50));
  const wBase = reliability * (0.7 + 0.3 * volume);
  const w = wBase * (0.8 + 0.4 * c);
  return clamp(w, 0.25, 2.0);
}

export function updateRaterLedgerOnJudgment(input: {
  rater_id: string;
  agreed_with_gold: boolean | null;
  nowMs: number;
}): void {
  const row = db.prepare('SELECT * FROM rater_ledger WHERE rater_id = ?').get(input.rater_id) as LedgerRow | undefined;
  const prev = row ?? {
    rater_id: input.rater_id,
    judgments_total: 0,
    converged_judgments_total: 0,
    converged_agree_total: 0,
    agreement_rate: 0.5,
    calibration_events_total: 0,
    calibration_brier_sum: 0,
    calibration_score: 0.5,
    last_seen: input.nowMs,
  };
  const judgmentsTotal = prev.judgments_total + 1;
  const convergedJudgmentsTotal = prev.converged_judgments_total + (input.agreed_with_gold === null ? 0 : 1);
  const convergedAgreeTotal = prev.converged_agree_total + (input.agreed_with_gold === true ? 1 : 0);
  const agreementRate = convergedJudgmentsTotal > 0 ? convergedAgreeTotal / convergedJudgmentsTotal : 0.5;

  db.prepare(
    `INSERT INTO rater_ledger (
      rater_id, judgments_total, converged_judgments_total, converged_agree_total,
      agreement_rate, calibration_events_total, calibration_brier_sum, calibration_score, last_seen
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(rater_id) DO UPDATE SET
      judgments_total = excluded.judgments_total,
      converged_judgments_total = excluded.converged_judgments_total,
      converged_agree_total = excluded.converged_agree_total,
      agreement_rate = excluded.agreement_rate,
      calibration_events_total = excluded.calibration_events_total,
      calibration_brier_sum = excluded.calibration_brier_sum,
      calibration_score = excluded.calibration_score,
      last_seen = excluded.last_seen`
  ).run(
    input.rater_id,
    judgmentsTotal,
    convergedJudgmentsTotal,
    convergedAgreeTotal,
    agreementRate,
    prev.calibration_events_total,
    prev.calibration_brier_sum,
    prev.calibration_score,
    input.nowMs,
  );
}

export function computeWeightedConsensus(
  judgments: Array<{ choice: string; trust: number | null; judgments_total: number | null; agreement_rate: number | null; calibration_score: number | null }>
): WeightedConsensusResult {
  const fallbackN = getLedgerFallbackThreshold();
  let yesN = 0;
  let noN = 0;
  let yesW = 0;
  let noW = 0;
  let weightedRaters = 0;
  let fallbackUnweightedRaters = 0;
  let minWeightApplied = Number.POSITIVE_INFINITY;
  let maxWeightApplied = 0;

  for (const j of judgments) {
    if (j.choice !== 'yes' && j.choice !== 'no') continue;
    if (j.choice === 'yes') yesN += 1;
    if (j.choice === 'no') noN += 1;

    const judgmentsTotal = Math.max(0, j.judgments_total ?? 0);
    const useFallback = judgmentsTotal < fallbackN;
    const w = useFallback
      ? 1
      : computeLedgerWeight({
        judgments_total: judgmentsTotal,
        agreement_rate: j.agreement_rate ?? (j.trust ?? 0.5),
        calibration_score: j.calibration_score ?? 0.5,
      });

    if (useFallback) fallbackUnweightedRaters += 1;
    else weightedRaters += 1;

    minWeightApplied = Math.min(minWeightApplied, w);
    maxWeightApplied = Math.max(maxWeightApplied, w);

    if (j.choice === 'yes') yesW += w;
    else noW += w;
  }

  const rawDecisive = yesN + noN;
  const weightedDecisive = yesW + noW;
  const rawConsensus = rawDecisive > 0 ? Math.max(yesN / rawDecisive, noN / rawDecisive) : 0;
  const weightedConsensus = weightedDecisive > 0 ? Math.max(yesW / weightedDecisive, noW / weightedDecisive) : 0;

  return {
    weighted_consensus: weightedConsensus,
    raw_consensus: rawConsensus,
    total_yes_weight: yesW,
    total_no_weight: noW,
    weighted_raters: weightedRaters,
    fallback_unweighted_raters: fallbackUnweightedRaters,
    min_weight_applied: Number.isFinite(minWeightApplied) ? minWeightApplied : 0,
    max_weight_applied: maxWeightApplied,
  };
}
