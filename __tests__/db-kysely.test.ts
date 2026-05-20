// WS-T phase 1: smoke kysely abstraction against sqlite (default dialect).
// runs against an isolated temp db so it doesn't touch dev data.
// invoke: node --import tsx __tests__/db-kysely.test.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-kysely-'));
process.env.PANEL_DB_DIR = tmpDir;
process.env.PANEL_DB_PATH = path.join(tmpDir, 'test.db');
process.env.PANEL_DB_DIALECT = 'sqlite';

let pass = 0, fail = 0;
function ok(cond: any, msg: string) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗', msg); }
}

async function run() {
  // import AFTER env vars set so module-init opens correct file.
  const { db } = await import('../lib/db');
  // honeypots table is created by lib/honeypot ensureHoneypotSchema; create stub
  db.exec(`CREATE TABLE IF NOT EXISTS honeypots (
    honeypot_id TEXT PRIMARY KEY,
    unit_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    decoy_answer TEXT NOT NULL,
    true_answer TEXT NOT NULL
  )`);
  // also add honeypot_id + honeypot_result columns to judgments (added by WS-O migration)
  try { db.exec(`ALTER TABLE judgments ADD COLUMN honeypot_id TEXT`); } catch {}
  try { db.exec(`ALTER TABLE judgments ADD COLUMN honeypot_result TEXT`); } catch {}

  const q = await import('../lib/queries');

  console.log('# units ingest + fetch');
  await q.insertUnit({ id: 'u_a', json: JSON.stringify({ id: 'u_a', t: 1 }), pool: 'public', is_honeypot: 0, created_at: 1 });
  const fetched = await q.getUnitJson('u_a');
  ok(fetched && JSON.parse(fetched).t === 1, 'getUnitJson roundtrips');

  console.log('# units bulk + listByPool');
  await q.insertUnitsBulk([
    { id: 'u_b', json: '{"x":1}', pool: 'public', is_honeypot: 0, created_at: 1 },
    { id: 'u_c', json: '{"x":2}', pool: 'technical', is_honeypot: 0, created_at: 1 },
    { id: 'u_d', json: '{"x":3}', pool: 'public', is_honeypot: 1, created_at: 1 },
  ]);
  const pubs = await q.listUnitsByPool('public');
  ok(pubs.length === 3, `listUnitsByPool('public') = 3 (got ${pubs.length})`);
  const all = await q.listAllUnitsJson();
  ok(all.length === 4, `listAllUnitsJson = 4 (got ${all.length})`);
  const cnt = await q.countUnits();
  ok(cnt === 4, `countUnits = 4 (got ${cnt})`);
  const hp = await q.countUnits({ is_honeypot: 1 });
  ok(hp === 1, `countUnits honeypot = 1 (got ${hp})`);

  console.log('# judgments insert + seen-by-rater');
  await q.insertJudgment({
    id: 'j_1', unit_id: 'u_a', rater_id: 'r_x', choice: 'yes',
    latency_ms: 100, confidence: 0.5, created_at: Date.now(),
    agreed_with_gold: 1, honeypot_failed: 0, pool: 'public',
    site_key: null, behavioral_json: null, honeypot_id: null, honeypot_result: null,
  });
  await q.insertJudgment({
    id: 'j_2', unit_id: 'u_b', rater_id: 'r_x', choice: 'no',
    latency_ms: 200, confidence: 0.9, created_at: Date.now(),
    agreed_with_gold: 0, honeypot_failed: 0, pool: 'public',
    site_key: null, behavioral_json: null, honeypot_id: null, honeypot_result: null,
  });
  const seen = await q.listSeenUnitIdsByRater('r_x');
  ok(seen.length === 2 && seen.includes('u_a') && seen.includes('u_b'), 'listSeenUnitIdsByRater = [u_a, u_b]');

  console.log('# traces upsert + fetch + status update');
  await q.upsertTrace({
    trace_id: 'tr_1', operator_id: 'op_a', source_agent: 'sa',
    raw_blob_hash: 'h', sanitized_at: 1, ingested_at: 1,
    scrubber_attestation_jti: null, blob_size: 100, status: 'pending',
    result_json: null, blob_json: '{}',
  });
  let t = await q.getTrace('tr_1');
  ok(t && t.status === 'pending', 'getTrace status = pending');
  await q.updateTraceStatus('tr_1', 'done', '{"ok":1}');
  t = await q.getTrace('tr_1');
  ok(t && t.status === 'done' && t.result_json === '{"ok":1}', 'updateTraceStatus → done');

  // upsert again with same id should overwrite (ON CONFLICT)
  await q.upsertTrace({
    trace_id: 'tr_1', operator_id: 'op_b', source_agent: 'sa2',
    raw_blob_hash: 'h2', sanitized_at: 2, ingested_at: 2,
    scrubber_attestation_jti: 'jti', blob_size: 200, status: 'done',
    result_json: '{"v":2}', blob_json: '{}',
  });
  t = await q.getTrace('tr_1');
  ok(t && t.blob_size === 200, 'upsertTrace overwrites on conflict');

  console.log(`\n${pass} passed, ${fail} failed`);
  // cleanup
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(2); });
