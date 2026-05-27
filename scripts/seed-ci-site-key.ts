// CI-only seed: ensure the demo site_key exists as an active row so
// /api/challenge/init's getActiveSiteKey() lookup succeeds even without
// the PANEL_DEMO_SITE_KEY env-bypass. Idempotent — safe to re-run.
//
// Schema reference (lib/db.ts site_keys table after migrations):
//   site_key, scrubber_required, label, created_at,
//   tier_policy, ingest_secret_hash, owner_email, status
//
// We seed scrubber_required=0 so /api/units/next doesn't try to call out
// to a (non-existent) scrubber service for technical pools. Smoke only
// exercises the public pool, so this is a no-op for that flow.
import { db } from '@/lib/db';

const key = process.env.PANEL_DEMO_SITE_KEY ?? 'pk_demo_ci';

db.prepare(
  `INSERT INTO site_keys (site_key, scrubber_required, label, created_at, status)
   VALUES (?, 0, 'ci-smoke', ?, 'active')
   ON CONFLICT(site_key) DO UPDATE SET status='active', scrubber_required=0`,
).run(key, Date.now());

// eslint-disable-next-line no-console
console.log(`seeded site_key=${key} status=active`);
