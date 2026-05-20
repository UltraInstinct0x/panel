// WS-O: load db/seeds/honeypots.json into the honeypots table.
// idempotent: keyed by (unit_type + payload + decoy + true) hash → stable id.
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { insertHoneypot, listHoneypots, HONEYPOT_TYPES, ensureHoneypotSchema } from './honeypot';
import type { UnitType } from './store';

interface SeedRow {
  unit_type: UnitType;
  payload: unknown;
  decoy_answer: string;
  true_answer: string;
  expert_notes: string;
}

export function seedHoneypotsFromFile(file?: string): { inserted: number; total_active: number; by_type: Record<string, number> } {
  ensureHoneypotSchema();
  const p = file ?? path.join(process.cwd(), 'db', 'seeds', 'honeypots.json');
  if (!fs.existsSync(p)) return { inserted: 0, total_active: 0, by_type: {} };
  const rows = JSON.parse(fs.readFileSync(p, 'utf8')) as SeedRow[];
  const existing = new Set(listHoneypots().map(h => h.honeypot_id));
  let inserted = 0;
  for (const r of rows) {
    const payloadStr = JSON.stringify(r.payload);
    const stableId = 'hseed_' + createHash('sha256')
      .update([r.unit_type, payloadStr, r.decoy_answer, r.true_answer].join('|'))
      .digest('hex')
      .slice(0, 16);
    if (existing.has(stableId)) continue;
    insertHoneypot({
      honeypot_id: stableId,
      unit_type: r.unit_type,
      payload: payloadStr,
      decoy_answer: r.decoy_answer,
      true_answer: r.true_answer,
      expert_notes: r.expert_notes,
      rotation_batch: 'b_seed_2026_05',
    });
    inserted++;
  }
  const by_type: Record<string, number> = {};
  for (const t of HONEYPOT_TYPES) by_type[t] = 0;
  for (const h of listHoneypots({ status: 'active' })) by_type[h.unit_type] = (by_type[h.unit_type] ?? 0) + 1;
  return { inserted, total_active: listHoneypots({ status: 'active' }).length, by_type };
}

// CLI entrypoint: `pnpm tsx lib/honeypot_seed.ts` or via node loader
if (require.main === module) {
  const r = seedHoneypotsFromFile();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(r, null, 2));
}
