import { NextRequest, NextResponse } from 'next/server';
import { getPanelSession } from '@/lib/server-session';
import { db } from '@/lib/db';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  const session = await getPanelSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const operatorId = (session as any).operatorId || (session.user as any)?.operatorId;
  if (!operatorId) return NextResponse.json({ error: 'no_operator_for_user' }, { status: 403 });

  const stripe = getStripeClient();
  const cfg = getBillingConfig();
  if (!stripe || !cfg.enabled) return NextResponse.json({ error: 'billing_disabled' }, { status: 503 });

  const row = db.prepare('SELECT stripe_customer_id FROM stripe_customers WHERE operator_id = ?').get(operatorId) as { stripe_customer_id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });

  const s = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: cfg.stripe.portalReturnUrl });
  try { audit('operator', operatorId, 'billing.portal_session_created', 'stripe_customers', operatorId, { customer_id: row.stripe_customer_id }); } catch {}
  return NextResponse.json({ url: s.url });
}
