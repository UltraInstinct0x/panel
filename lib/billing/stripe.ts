import Stripe from 'stripe';
import { getBillingConfig } from '@/lib/billing/config';

let _stripe: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  const cfg = getBillingConfig();
  if (!cfg.enabled) {
    _stripe = null;
    return _stripe;
  }
  _stripe = new Stripe(cfg.stripe.secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
  return _stripe;
}
