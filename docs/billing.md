# Billing Layer (Stripe test mode)

## Enablement

`BILLING_ENABLED=false` is the default. The billing routes (`/api/billing/portal`, `/api/billing/checkout`) and webhook handlers respond `503 billing_disabled` when the flag is off, regardless of whether Stripe keys are present.

Flip `BILLING_ENABLED=true` **only after Stripe live keys are provisioned**. In production (`NODE_ENV=production`) with `BILLING_ENABLED=true`, the absence of `STRIPE_SECRET_KEY` throws at config load — this is intentional so misconfigured prod deploys fail fast. With `BILLING_ENABLED=false` no Stripe env vars are required at all.

## Local setup

Set env vars (test keys):

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_DESIGNPARTNER_MONTHLY`
- `STRIPE_PRICE_DESIGNPARTNER_ANNUAL`
- `STRIPE_PRICE_DESIGNPARTNER_METER`
- `STRIPE_PRICE_GROWTH_MONTHLY`
- `STRIPE_PRICE_GROWTH_ANNUAL`
- `STRIPE_PRICE_GROWTH_METER`
- `STRIPE_METER_VERIFY_EVENT` (default `verify`)
- `STRIPE_PORTAL_RETURN_URL`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `PANEL_CONNECT_ENABLED` (default false)
- `STRIPE_CONNECT_CLIENT_ID`
- `STRIPE_CONNECT_RETURN_URL`
- `STRIPE_CONNECT_REFRESH_URL`
- `STRIPE_PLATFORM_FEE_BPS` (default 2000)
- `STRIPE_PAYOUT_MIN_USD_CENTS` (default 1000)

## Provision products/prices

Dry run:

```bash
tsx scripts/billing/provision-stripe.ts --dry-run
```

Real create (test mode keys):

```bash
tsx scripts/billing/provision-stripe.ts
```

Writes `.env.billing.example` with generated price IDs.

## Webhook local testing

Run app, then:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

This validates signature handling with `STRIPE_WEBHOOK_SECRET`.

## Meter flusher worker

Run manually/cron every minute:

```bash
tsx scripts/billing/meter-flusher.ts
```

## API surface

- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/billing/webhook`
- `POST /api/rater/payouts/onboard`
- `GET /api/rater/payouts/refresh`
- `GET /api/rater/payouts/return`
