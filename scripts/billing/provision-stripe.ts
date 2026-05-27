import fs from 'fs';
import path from 'path';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const cfg = getBillingConfig();
  const stripe = getStripeClient();
  if (!cfg.enabled || !stripe) {
    console.log('Stripe disabled (missing STRIPE_SECRET_KEY).');
    return;
  }

  const products = [
    { key: 'designpartner', name: 'panel_designpartner', monthly: 9900, annual: 99000, meter: 0.2 },
    { key: 'growth', name: 'panel_growth', monthly: 49900, annual: 499000, meter: 0.15 },
  ] as const;

  const env: Record<string, string> = {};

  for (const p of products) {
    if (DRY_RUN) {
      console.log(`[dry-run] would ensure product ${p.name}`);
      continue;
    }
    const product = await stripe.products.create({ name: p.name, metadata: { panel_tier: p.key } });
    const monthly = await stripe.prices.create({ product: product.id, unit_amount: p.monthly, currency: 'usd', recurring: { interval: 'month' } });
    const annual = await stripe.prices.create({ product: product.id, unit_amount: p.annual, currency: 'usd', recurring: { interval: 'year' } });
    const meter = await stripe.prices.create({ product: product.id, currency: 'usd', recurring: { interval: 'month', usage_type: 'metered' }, billing_scheme: 'per_unit', unit_amount_decimal: String(p.meter) });
    env[`STRIPE_PRICE_${p.key.toUpperCase()}_MONTHLY`] = monthly.id;
    env[`STRIPE_PRICE_${p.key.toUpperCase()}_ANNUAL`] = annual.id;
    env[`STRIPE_PRICE_${p.key.toUpperCase()}_METER`] = meter.id;
  }

  const outfile = path.join(process.cwd(), '.env.billing.example');
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(outfile, `${lines.join('\n')}\n`, 'utf8');
  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
