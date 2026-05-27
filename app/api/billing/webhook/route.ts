import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';
import { nextDunningState } from '@/lib/billing/dunning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function uid(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }

function markPaymentFailed(operatorId: string): void {
  const row = db.prepare('SELECT payment_failures, dunning_state FROM operators WHERE id = ?').get(operatorId) as { payment_failures: number; dunning_state: string } | undefined;
  const failures = (row?.payment_failures ?? 0) + 1;
  const dunning = nextDunningState(failures);
  db.prepare(`INSERT INTO operators (id, payment_failures, dunning_state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payment_failures=excluded.payment_failures, dunning_state=excluded.dunning_state, updated_at=excluded.updated_at`)
    .run(operatorId, failures, dunning, Date.now(), Date.now());
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const cfg = getBillingConfig();
  if (!stripe || !cfg.enabled || !cfg.stripe.webhookSecret) return NextResponse.json({ error: 'billing_disabled' }, { status: 503 });
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  const payload = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, cfg.stripe.webhookSecret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  const seen = db.prepare('SELECT 1 FROM billing_events WHERE stripe_event_id = ?').get(event.id);
  if (seen) return NextResponse.json({ ok: true, deduped: true });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const operatorId = String(session?.metadata?.panel_operator_id || session?.subscription_data?.metadata?.panel_operator_id || '');
    const tier = String(session?.metadata?.panel_tier || session?.subscription_data?.metadata?.panel_tier || 'designpartner');
    if (operatorId) {
      db.prepare(`INSERT INTO operators (id, email, tier, stripe_customer_id, stripe_subscription_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET email=excluded.email, tier=excluded.tier, stripe_customer_id=excluded.stripe_customer_id, stripe_subscription_id=excluded.stripe_subscription_id, updated_at=excluded.updated_at`)
        .run(operatorId, session.customer_details?.email || null, tier, session.customer, session.subscription, Date.now(), Date.now());
      db.prepare('INSERT OR REPLACE INTO stripe_customers (operator_id, stripe_customer_id, email, created_at) VALUES (?, ?, ?, ?)')
        .run(operatorId, session.customer, session.customer_details?.email || null, Date.now());
    }
  }

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as any;
    const operatorId = String(sub?.metadata?.panel_operator_id || '');
    const tier = String(sub?.metadata?.panel_tier || 'selfhost');
    if (operatorId) {
      db.prepare(`INSERT INTO subscriptions (id, operator_id, stripe_subscription_id, tier, status, current_period_end, cancel_at_period_end, metered_price_id, base_price_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stripe_subscription_id) DO UPDATE SET tier=excluded.tier, status=excluded.status, current_period_end=excluded.current_period_end, cancel_at_period_end=excluded.cancel_at_period_end, metered_price_id=excluded.metered_price_id, base_price_id=excluded.base_price_id, updated_at=excluded.updated_at`)
        .run(uid('sub'), operatorId, sub.id, tier, sub.status || 'unknown', sub.current_period_end ? sub.current_period_end * 1000 : null, sub.cancel_at_period_end ? 1 : 0, sub.items?.data?.find((x: any) => x.price?.recurring?.usage_type === 'metered')?.price?.id || null, sub.items?.data?.find((x: any) => x.price?.recurring?.usage_type !== 'metered')?.price?.id || null, Date.now(), Date.now());
      db.prepare('INSERT OR IGNORE INTO operators (id, created_at, updated_at) VALUES (?, ?, ?)').run(operatorId, Date.now(), Date.now());
      db.prepare('UPDATE operators SET tier = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?').run(tier, sub.id, Date.now(), operatorId);
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as any;
    const operator = db.prepare('SELECT operator_id FROM stripe_customers WHERE stripe_customer_id = ?').get(invoice.customer) as { operator_id: string } | undefined;
    if (operator) {
      db.prepare('UPDATE operators SET dunning_state = ?, payment_failures = 0, updated_at = ? WHERE id = ?').run('ok', Date.now(), operator.operator_id);
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as any;
    const operator = db.prepare('SELECT operator_id FROM stripe_customers WHERE stripe_customer_id = ?').get(invoice.customer) as { operator_id: string } | undefined;
    if (operator) markPaymentFailed(operator.operator_id);
  }

  if (event.type === 'account.updated') {
    const acct = event.data.object as any;
    db.prepare('UPDATE rater_accounts SET payouts_enabled = ?, charges_enabled = ?, updated_at = ? WHERE stripe_account_id = ?')
      .run(acct.payouts_enabled ? 1 : 0, acct.charges_enabled ? 1 : 0, Date.now(), acct.id);
  }

  db.prepare('INSERT INTO billing_events (id, stripe_event_id, type, payload_json, processed_at) VALUES (?, ?, ?, ?, ?)')
    .run(uid('be'), event.id, event.type, JSON.stringify(event), Date.now());

  return NextResponse.json({ ok: true });
}
