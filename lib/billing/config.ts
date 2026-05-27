export type BillingTier = 'selfhost' | 'designpartner' | 'growth' | 'enterprise';
export type BillingInterval = 'monthly' | 'annual';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function opt(name: string): string | null {
  return process.env[name] ?? null;
}

export function getBillingConfig() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const enabled = Boolean(stripeSecretKey);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !enabled) {
    throw new Error('STRIPE_SECRET_KEY is required in production');
  }

  return {
    enabled,
    stripe: {
      secretKey: stripeSecretKey,
      publishableKey: opt('STRIPE_PUBLISHABLE_KEY'),
      webhookSecret: opt('STRIPE_WEBHOOK_SECRET'),
      meterEventName: process.env.STRIPE_METER_VERIFY_EVENT || 'verify',
      portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'http://127.0.0.1:3015/operator/billing',
      checkoutSuccessUrl: process.env.STRIPE_CHECKOUT_SUCCESS_URL || 'http://127.0.0.1:3015/operator/billing?checkout=success',
      checkoutCancelUrl: process.env.STRIPE_CHECKOUT_CANCEL_URL || 'http://127.0.0.1:3015/operator/billing?checkout=cancel',
      prices: {
        designpartner: {
          monthly: opt('STRIPE_PRICE_DESIGNPARTNER_MONTHLY'),
          annual: opt('STRIPE_PRICE_DESIGNPARTNER_ANNUAL'),
          meter: opt('STRIPE_PRICE_DESIGNPARTNER_METER'),
        },
        growth: {
          monthly: opt('STRIPE_PRICE_GROWTH_MONTHLY'),
          annual: opt('STRIPE_PRICE_GROWTH_ANNUAL'),
          meter: opt('STRIPE_PRICE_GROWTH_METER'),
        },
        enterprise: {
          monthly: opt('STRIPE_PRICE_ENTERPRISE_MONTHLY'),
          annual: opt('STRIPE_PRICE_ENTERPRISE_ANNUAL'),
          meter: opt('STRIPE_PRICE_ENTERPRISE_METER'),
        },
      },
    },
    connect: {
      enabled: process.env.PANEL_CONNECT_ENABLED === 'true',
      clientId: opt('STRIPE_CONNECT_CLIENT_ID'),
      returnUrl: process.env.STRIPE_CONNECT_RETURN_URL || 'http://127.0.0.1:3015/rater/payouts',
      refreshUrl: process.env.STRIPE_CONNECT_REFRESH_URL || 'http://127.0.0.1:3015/rater/payouts/refresh',
      defaultPlatformFeeBps: Number(process.env.STRIPE_PLATFORM_FEE_BPS || '2000'),
      payoutMinUsdCents: Number(process.env.STRIPE_PAYOUT_MIN_USD_CENTS || '1000'),
    },
    caps: {
      softMultiplier: 10,
      hardMultiplier: 100,
    },
  };
}

export function getPriceIdsForTier(cfg: ReturnType<typeof getBillingConfig>, tier: BillingTier, interval: BillingInterval): { base: string; meter: string } {
  if (tier === 'selfhost') {
    throw new Error('selfhost does not have Stripe prices');
  }
  const t = cfg.stripe.prices[tier as 'designpartner' | 'growth' | 'enterprise'];
  const base = t[interval];
  const meter = t.meter;
  if (!base || !meter) throw new Error(`Missing Stripe price IDs for tier=${tier} interval=${interval}`);
  return { base, meter };
}
