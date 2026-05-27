import * as path from 'path';

process.env.PANEL_DB_PATH = path.join('/tmp', `panel-billing-${Date.now()}.db`);

import { db } from '../lib/db';
import { nextDunningState } from '../lib/billing/dunning';
import { includedPoolForTier, recordVerify, usageForCurrentPeriod } from '../lib/billing/meter';
import { platformFeeBpsForRater } from '../lib/rater-ledger';

let pass = 0;
let fail = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (a === b) { pass++; console.log('ok', name); }
  else { fail++; console.error('FAIL', name, a, b); }
}

recordVerify('op_test');
recordVerify('op_test');
eq('usage buffered', usageForCurrentPeriod('op_test') >= 2, true);
eq('designpartner pool', includedPoolForTier('designpartner'), 50_000);

eq('dunning 1 failure', nextDunningState(1), 'past_due');
eq('dunning 3 failures', nextDunningState(3), 'soft_suspended');
eq('dunning 7 failures', nextDunningState(7), 'hard_suspended');

eq('fee default 20%', platformFeeBpsForRater({ defaultBps: 2000, isT3: false, designPartnerManaged: false }), 2000);
eq('fee t3 15%', platformFeeBpsForRater({ defaultBps: 2000, isT3: true, designPartnerManaged: false }), 1500);
eq('fee managed 0%', platformFeeBpsForRater({ defaultBps: 2000, isT3: true, designPartnerManaged: true }), 0);

const id = 'evt_123';
db.prepare('INSERT INTO billing_events (id, stripe_event_id, type, payload_json, processed_at) VALUES (?, ?, ?, ?, ?)').run('be1', id, 'invoice.paid', '{}', Date.now());
const exists = db.prepare('SELECT stripe_event_id FROM billing_events WHERE stripe_event_id = ?').get(id) as { stripe_event_id: string } | undefined;
eq('webhook idempotency ledger row exists', exists?.stripe_event_id, id);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
