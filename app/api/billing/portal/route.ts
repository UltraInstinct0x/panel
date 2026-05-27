import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const cfg = getBillingConfig();
  if (!stripe || !cfg.enabled) return NextResponse.json({ error: 'billing_disabled' }, { status: 503 });
  const body = await req.json().catch(() => null) as { operatorId?: string } | null;
  if (!body?.operatorId) return NextResponse.json({ error: 'operator_id_required' }, { status: 400 });
  const row = db.prepare('SELECT stripe_customer_id FROM stripe_customers WHERE operator_id = ?').get(body.operatorId) as { stripe_customer_id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
  const s = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: cfg.stripe.portalReturnUrl });
  return NextResponse.json({ url: s.url });
}
