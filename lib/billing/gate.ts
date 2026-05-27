import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { includedPoolForTier, usageForCurrentPeriod } from '@/lib/billing/meter';
import { getBillingConfig } from '@/lib/billing/config';

export function enforceBillingGate(operatorId: string): NextResponse | null {
  const cfg = getBillingConfig();
  const operator = db.prepare('SELECT tier, dunning_state FROM operators WHERE id = ?').get(operatorId) as { tier: string; dunning_state: string } | undefined;
  const tier = operator?.tier || 'selfhost';
  const dunningState = operator?.dunning_state || 'ok';

  if (dunningState === 'hard_suspended') {
    return NextResponse.json({ ok: false, error: 'hard_suspended' }, { status: 503 });
  }
  if (dunningState === 'soft_suspended') {
    return NextResponse.json({ ok: false, error: 'soft_suspended' }, { status: 402 });
  }

  const used = usageForCurrentPeriod(operatorId);
  const included = includedPoolForTier(tier);
  if (!Number.isFinite(included)) return null;

  const softCap = included * cfg.caps.softMultiplier;
  const hardCap = included * cfg.caps.hardMultiplier;

  if (used >= hardCap) {
    db.prepare('INSERT INTO billing_alerts (id, operator_id, level, event_name, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`ba_${operatorId}_${Date.now()}`, operatorId, 'critical', 'hard_cap', JSON.stringify({ used, hardCap }), Date.now());
    return NextResponse.json({ ok: false, error: 'hard_cap' }, { status: 503 });
  }

  if (used >= softCap) {
    db.prepare('INSERT INTO billing_alerts (id, operator_id, level, event_name, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`ba_${operatorId}_${Date.now()}`, operatorId, 'warn', 'soft_cap', JSON.stringify({ used, softCap }), Date.now());
    return NextResponse.json({ ok: false, error: 'soft_cap' }, { status: 429 });
  }
  return null;
}
