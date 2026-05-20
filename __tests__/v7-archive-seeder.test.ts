// V7 archive seeder smoke — verifies seeded honeypots have the right shape.
// usage: tsx __tests__/v7-archive-seeder.test.ts

import * as fs from 'fs';
import * as path from 'path';

const TMP_DB = path.join('/tmp', `panel-test-v7-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.PANEL_DB_PATH = TMP_DB;

import { db } from '../lib/db';
import { insertHoneypot } from '../lib/honeypot';

let passed = 0, failed = 0;
function eq(name: string, a: any, b: any) {
  if (JSON.stringify(a) === JSON.stringify(b)) { passed++; console.log('  ok ', name); }
  else { failed++; console.log('  FAIL', name, '— expected', JSON.stringify(b), 'got', JSON.stringify(a)); }
}
function truthy(name: string, v: any) {
  if (v) { passed++; console.log('  ok ', name); }
  else { failed++; console.log('  FAIL', name); }
}

console.log('V7 archive seeder');

// 1. shape — media_origin honeypot with true=real / decoy=ai
const hp = insertHoneypot({
  unit_type: 'media_origin' as any,
  payload: JSON.stringify({
    question: 'is this AI-generated or real?',
    media_url: 'https://example.test/img.jpg',
    media_type: 'image',
    source: 'wikimedia_commons',
    source_url: 'https://example.test/page',
    attribution: 'test author / Wikimedia Commons (cc)',
    choices: [
      { id: 'real', label: 'Real' },
      { id: 'ai',   label: 'AI-generated' },
    ],
  }),
  decoy_answer: 'ai',
  true_answer:  'real',
  expert_notes: 'unit-test fake',
});
eq('unit_type', hp.unit_type, 'media_origin');
eq('true_answer', hp.true_answer, 'real');
eq('decoy_answer', hp.decoy_answer, 'ai');
const payload = JSON.parse(hp.payload);
eq('media_type', payload.media_type, 'image');
truthy('media_url is http(s)', /^https?:\/\//.test(payload.media_url));
eq('choices', payload.choices.map((c: any) => c.id).sort(), ['ai', 'real']);

// 2. archive_seed_log table for idempotency
db.exec(`
  CREATE TABLE IF NOT EXISTS archive_seed_log (
    source       TEXT NOT NULL,
    source_id    TEXT NOT NULL,
    honeypot_id  TEXT NOT NULL,
    seeded_at    INTEGER NOT NULL,
    PRIMARY KEY (source, source_id)
  );
`);
const cols = (db.prepare(`PRAGMA table_info(archive_seed_log)`).all() as Array<{ name: string }>).map(c => c.name).sort();
eq('seed log columns', cols, ['honeypot_id', 'seeded_at', 'source', 'source_id']);

// 3. dedup — second insert with same (source, source_id) should be rejected by PK
db.prepare(`INSERT INTO archive_seed_log (source, source_id, honeypot_id, seeded_at) VALUES (?, ?, ?, ?)`)
  .run('commons', '12345', hp.honeypot_id, Date.now());
let dedupOk = false;
try {
  db.prepare(`INSERT INTO archive_seed_log (source, source_id, honeypot_id, seeded_at) VALUES (?, ?, ?, ?)`)
    .run('commons', '12345', 'h_other', Date.now());
} catch (e) {
  dedupOk = true;
}
truthy('dedup PK rejects re-insert', dedupOk);

// cleanup
try { fs.unlinkSync(TMP_DB); } catch {}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
