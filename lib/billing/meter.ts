import crypto from 'crypto';
import { db } from '@/lib/db';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';

const INCLUDED: Record<string, number> = {
  selfhost: Number.MAX_SAFE_INTEGER,
  designpartner: 50_000,
  growth: 500_000,
  enterprise: 5_000_000,
};

export function recordVerify(operatorId: string): void {
  db.prepare('INSERT OR IGNORE INTO operators (id, created_at, updated_at) VALUES (?, ?, ?)').run(operatorId, Date.now(), Date.now());
  db.prepare('INSERT INTO usage_events (id, operator_id, event_name, quantity, ts, flushed_at) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(`ue_${crypto.randomUUID()}`, operatorId, 'verify', 1, Date.now());
}

export function usageForCurrentPeriod(operatorId: string): number {
  const now = new Date();
  const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const row = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM usage_events WHERE operator_id = ? AND event_name = ? AND ts >= ?')
    .get(operatorId, 'verify', from) as { n: number };
  return row.n;
}

export function includedPoolForTier(tier: string): number {
  return INCLUDED[tier] ?? INCLUDED.enterprise;
}

export async function flushUsageEvents(nowMs = Date.now()): Promise<{ flushed: number }> {
  const stripe = getStripeClient();
  const cfg = getBillingConfig();
  const pending = db.prepare(`
    SELECT operator_id, event_name, SUM(quantity) AS qty
    FROM usage_events
    WHERE flushed_at IS NULL
    GROUP BY operator_id, event_name
  `).all() as Array<{ operator_id: string; event_name: string; qty: number }>;

  let flushed = 0;
  for (const row of pending) {
    const customer = db.prepare('SELECT stripe_customer_id FROM stripe_customers WHERE operator_id = ?').get(row.operator_id) as { stripe_customer_id: string } | undefined;
    if (!customer || !stripe) continue;
    await stripe.billing.meterEvents.create({
      event_name: cfg.stripe.meterEventName,
      payload: {
        stripe_customer_id: customer.stripe_customer_id,
        value: String(row.qty),
      },
    });
    db.prepare('UPDATE usage_events SET flushed_at = ? WHERE flushed_at IS NULL AND operator_id = ? AND event_name = ?')
      .run(nowMs, row.operator_id, row.event_name);
    flushed += row.qty;
  }
  return { flushed };
}
