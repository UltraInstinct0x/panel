import { db } from '@/lib/db';
import { usageForCurrentPeriod } from '@/lib/billing/meter';

export const dynamic = 'force-dynamic';

export default async function OperatorBillingPage() {
  const operatorId = 'default_operator';
  const operator = db.prepare('SELECT tier, dunning_state FROM operators WHERE id = ?').get(operatorId) as { tier: string; dunning_state: string } | undefined;
  const usage = usageForCurrentPeriod(operatorId);
  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1>operator billing</h1>
      <p>tier: <strong>{operator?.tier || 'selfhost'}</strong></p>
      <p>usage this period: <strong>{usage}</strong> verify events</p>
      <p>dunning state: <strong>{operator?.dunning_state || 'ok'}</strong></p>
      <div style={{ display: 'flex', gap: 12 }}>
        <form action="/api/billing/portal" method="post"><button type="submit">open customer portal</button></form>
        <form action="/api/billing/checkout" method="post"><button type="submit">upgrade via checkout</button></form>
      </div>
    </main>
  );
}
