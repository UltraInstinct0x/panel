import { db } from '@/lib/db';
import { getBillingConfig } from '@/lib/billing/config';
import { getStripeClient } from '@/lib/billing/stripe';

async function main() {
  const cfg = getBillingConfig();
  if (!cfg.connect.enabled) {
    console.log(JSON.stringify({ ok: true, skipped: 'connect_disabled' }));
    return;
  }
  const stripe = getStripeClient();
  if (!stripe) throw new Error('Stripe disabled');

  const rows = db.prepare(`
    SELECT rc.id, rc.rater_id, rc.net_cents, rc.judgment_id, ra.stripe_account_id
    FROM rater_credits rc
    JOIN rater_accounts ra ON ra.rater_id = rc.rater_id
    WHERE rc.status = 'pending'
    ORDER BY rc.created_at ASC
  `).all() as Array<{ id: string; rater_id: string; net_cents: number; judgment_id: string; stripe_account_id: string }>;

  let settled = 0;
  for (const row of rows) {
    if (row.net_cents < cfg.connect.payoutMinUsdCents) continue;
    const tr = await stripe.transfers.create({
      amount: row.net_cents,
      currency: 'usd',
      destination: row.stripe_account_id,
      metadata: { judgment_id: row.judgment_id, rater_id: row.rater_id },
    });
    db.prepare('UPDATE rater_credits SET status = ?, transfer_id = ?, settled_at = ? WHERE id = ?').run('settled', tr.id, Date.now(), row.id);
    settled += 1;
  }
  console.log(JSON.stringify({ ok: true, settled }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
