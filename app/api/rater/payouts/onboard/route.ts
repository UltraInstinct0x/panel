import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cfg = getBillingConfig();
  if (!cfg.connect.enabled) return NextResponse.json({ error: 'connect_disabled' }, { status: 404 });
  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: 'billing_disabled' }, { status: 503 });
  const body = await req.json().catch(() => null) as { raterId?: string; country?: string; email?: string; designPartnerManaged?: boolean } | null;
  if (!body?.raterId) return NextResponse.json({ error: 'rater_id_required' }, { status: 400 });

  const account = await stripe.accounts.create({
    type: 'express',
    country: body.country || 'US',
    email: body.email,
    capabilities: { transfers: { requested: true } },
  });
  const now = Date.now();
  db.prepare(`INSERT INTO rater_accounts (rater_id, stripe_account_id, country, payouts_enabled, charges_enabled, platform_fee_bps, design_partner_managed, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
    ON CONFLICT(rater_id) DO UPDATE SET stripe_account_id=excluded.stripe_account_id, country=excluded.country, design_partner_managed=excluded.design_partner_managed, updated_at=excluded.updated_at`)
    .run(body.raterId, account.id, body.country || 'US', cfg.connect.defaultPlatformFeeBps, body.designPartnerManaged ? 1 : 0, now, now);

  const link = await stripe.accountLinks.create({ account: account.id, type: 'account_onboarding', refresh_url: cfg.connect.refreshUrl, return_url: cfg.connect.returnUrl });
  return NextResponse.json({ url: link.url, account_id: account.id });
}
