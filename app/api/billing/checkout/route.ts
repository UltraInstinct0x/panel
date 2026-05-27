import { NextRequest, NextResponse } from 'next/server';
import { getBillingConfig, getPriceIdsForTier } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const cfg = getBillingConfig();
  if (!stripe || !cfg.enabled) return NextResponse.json({ error: 'billing_disabled' }, { status: 503 });
  const body = await req.json().catch(() => null) as { tier?: 'designpartner' | 'growth' | 'enterprise'; interval?: 'monthly' | 'annual'; operatorId?: string; email?: string } | null;
  if (!body?.tier || !body?.interval || !body?.operatorId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const prices = getPriceIdsForTier(cfg, body.tier, body.interval);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: prices.base, quantity: 1 }, { price: prices.meter, quantity: 1 }],
    customer_email: body.email,
    automatic_tax: { enabled: true },
    subscription_data: { metadata: { panel_operator_id: body.operatorId, panel_tier: body.tier } },
    success_url: cfg.stripe.checkoutSuccessUrl,
    cancel_url: cfg.stripe.checkoutCancelUrl,
  });
  return NextResponse.json({ url: session.url });
}
