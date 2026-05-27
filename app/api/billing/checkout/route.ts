import { NextRequest, NextResponse } from 'next/server';
import { getPanelSession } from '@/lib/server-session';
import { getBillingConfig, getPriceIdsForTier } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TIERS = new Set(['designpartner', 'growth', 'enterprise']);
const VALID_INTERVALS = new Set(['monthly', 'annual']);

export async function POST(req: NextRequest) {
  const session = await getPanelSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const operatorId = session.operatorId || session.user?.operatorId;
  if (!operatorId) return NextResponse.json({ error: 'no_operator_for_user' }, { status: 403 });
  const email = session.user?.email || undefined;

  const stripe = getStripeClient();
  const cfg = getBillingConfig();
  if (!stripe || !cfg.enabled) return NextResponse.json({ error: 'billing_disabled' }, { status: 503 });

  const body = await req.json().catch(() => null) as { tier?: string; interval?: string } | null;
  const tier = body?.tier;
  const interval = body?.interval;
  if (!tier || !interval || !VALID_TIERS.has(tier) || !VALID_INTERVALS.has(interval)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const prices = getPriceIdsForTier(cfg, tier as 'designpartner' | 'growth' | 'enterprise', interval as 'monthly' | 'annual');
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: prices.base, quantity: 1 }, { price: prices.meter, quantity: 1 }],
    customer_email: email,
    automatic_tax: { enabled: true },
    subscription_data: { metadata: { panel_operator_id: operatorId, panel_tier: tier } },
    success_url: cfg.stripe.checkoutSuccessUrl,
    cancel_url: cfg.stripe.checkoutCancelUrl,
  });
  try { audit('operator', operatorId, 'billing.checkout_session_created', 'subscriptions', operatorId, { tier, interval, session_id: checkout.id }); } catch {}
  return NextResponse.json({ url: checkout.url });
}
