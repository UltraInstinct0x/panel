import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-skill-review-'));
process.env.PANEL_DB_DIR = tmpDir;
process.env.PANEL_DB_PATH = path.join(tmpDir, 'test.db');
process.env.PANEL_REVIEW_MIN_N = '3';
process.env.PANEL_REVIEW_THRESHOLD = '0.66';
process.env.PANEL_RATER_LEDGER_MIN_JUDGMENTS = '12';
process.env.PANEL_INGEST_SECRET = 'test_secret';

let pass = 0;
let fail = 0;
function ok(cond: unknown, msg: string) {
  if (cond) {
    pass += 1;
    console.log('  ✓', msg);
    return;
  }
  fail += 1;
  console.log('  ✗', msg);
}

async function run() {
  const { db } = await import('../lib/db');
  const ledger = await import('../lib/rater-ledger');
  const verdictRoute = await import('../app/api/v1/skill-review/[unit_id]/route');
  const ingestRoute = await import('../app/api/v1/skill-review/route');

  const now = Math.floor(Date.now() / 1000);

  console.log('# ledger math');
  const wHi = ledger.computeLedgerWeight({ agreement_rate: 999, judgments_total: 999, calibration_score: 999 });
  const wLo = ledger.computeLedgerWeight({ agreement_rate: -1, judgments_total: 0, calibration_score: -1 });
  ok(wHi <= 2, `weight is capped at 2.0 (got ${wHi})`);
  ok(wLo >= 0.25, `weight has lower bound 0.25 (got ${wLo})`);

  console.log('# weighted consensus + compatibility fields');
  const unitId = 'u_weighted_case';
  db.prepare('INSERT INTO units(id, json, pool, is_honeypot, created_at) VALUES (?,?,?,?,?)').run(
    unitId,
    JSON.stringify({ id: unitId, type: 'skill_diff_review', pool: 'public', question: 'q' }),
    'public',
    0,
    now,
  );

  db.prepare('INSERT INTO raters(id, trust, judgments_count, agreed_count, earned_cents, bot_flag, created_at) VALUES (?,?,?,?,?,?,?)').run('r1', 0.9, 100, 90, 0, 0, now);
  db.prepare('INSERT INTO raters(id, trust, judgments_count, agreed_count, earned_cents, bot_flag, created_at) VALUES (?,?,?,?,?,?,?)').run('r2', 0.9, 100, 90, 0, 0, now);
  db.prepare('INSERT INTO raters(id, trust, judgments_count, agreed_count, earned_cents, bot_flag, created_at) VALUES (?,?,?,?,?,?,?)').run('r3', 0.9, 100, 90, 0, 0, now);
  db.prepare('INSERT INTO rater_ledger(rater_id, judgments_total, converged_judgments_total, converged_agree_total, agreement_rate, calibration_events_total, calibration_brier_sum, calibration_score, last_seen) VALUES (?,?,?,?,?,?,?,?,?)').run('r1', 100, 100, 100, 1, 0, 0, 1, now);
  db.prepare('INSERT INTO rater_ledger(rater_id, judgments_total, converged_judgments_total, converged_agree_total, agreement_rate, calibration_events_total, calibration_brier_sum, calibration_score, last_seen) VALUES (?,?,?,?,?,?,?,?,?)').run('r2', 2, 2, 1, 0.5, 0, 0, 0.5, now);
  db.prepare('INSERT INTO rater_ledger(rater_id, judgments_total, converged_judgments_total, converged_agree_total, agreement_rate, calibration_events_total, calibration_brier_sum, calibration_score, last_seen) VALUES (?,?,?,?,?,?,?,?,?)').run('r3', 2, 2, 1, 0.5, 0, 0, 0.5, now);
  db.prepare('INSERT INTO judgments(id, unit_id, rater_id, choice, latency_ms, confidence, created_at, agreed_with_gold, honeypot_failed, pool, site_key, behavioral_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('j1', unitId, 'r1', 'yes', 100, 0.8, now, null, 0, 'public', null, null);
  db.prepare('INSERT INTO judgments(id, unit_id, rater_id, choice, latency_ms, confidence, created_at, agreed_with_gold, honeypot_failed, pool, site_key, behavioral_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('j2', unitId, 'r2', 'no', 100, 0.8, now, null, 0, 'public', null, null);
  db.prepare('INSERT INTO judgments(id, unit_id, rater_id, choice, latency_ms, confidence, created_at, agreed_with_gold, honeypot_failed, pool, site_key, behavioral_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('j3', unitId, 'r3', 'no', 100, 0.8, now, null, 0, 'public', null, null);

  const verdictRes = await verdictRoute.GET(new NextRequest('http://localhost/api/v1/skill-review/u_weighted_case'), { params: { unit_id: unitId } });
  const verdictJson = await verdictRes.json();
  ok(verdictJson.ok === true, 'verdict route returns ok=true');
  ok(verdictJson.consensus === verdictJson.weighted_consensus, 'consensus aliases weighted_consensus');
  ok(typeof verdictJson.raw_consensus === 'number', 'raw_consensus is present');
  ok(!!verdictJson.weight_distribution, 'weight_distribution is present');
  ok(
    verdictJson.status !== 'approved' && verdictJson.weight_distribution.total_no_weight > verdictJson.weight_distribution.total_yes_weight,
    `weighted/cap path prevents single-rater domination (status=${verdictJson.status})`
  );

  console.log('# fallback threshold behavior (<N uses unweighted)');
  const fallbackCalc = ledger.computeWeightedConsensus([
    { choice: 'yes', trust: 0.9, judgments_total: 1, agreement_rate: 1, calibration_score: 1 },
    { choice: 'no', trust: 0.9, judgments_total: 1, agreement_rate: 1, calibration_score: 1 },
    { choice: 'no', trust: 0.9, judgments_total: 1, agreement_rate: 1, calibration_score: 1 },
  ]);
  ok(fallbackCalc.fallback_unweighted_raters === 3, 'all low-history raters fallback to unweighted');
  ok(Math.abs(fallbackCalc.raw_consensus - fallbackCalc.weighted_consensus) < 1e-9, 'fallback weighted equals raw consensus');

  console.log('# trusted_pool_only pricing hook');
  const payloadA = JSON.stringify({
    external_ref: 'ref-a',
    skill_name: 'skill-a',
    diff: 'diff-a',
    trusted_pool_only: true,
  });
  const sigA = crypto.createHmac('sha256', 'test_secret').update(payloadA).digest('hex');
  const reqA = new NextRequest('http://localhost/api/v1/skill-review', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-panel-site-key': 'pk_test',
      'x-panel-ingest-sig': sigA,
    },
    body: payloadA,
  });
  const resA = await ingestRoute.POST(reqA);
  const jsonA = await resA.json();
  const rowA = db.prepare('SELECT pool, json FROM units WHERE id=?').get(jsonA.unit_id) as { pool: string; json: string };
  const unitA = JSON.parse(rowA.json) as { pool: string };
  ok(rowA.pool === 'technical' && unitA.pool === 'technical', 'trusted_pool_only=true routes unit to technical pool');

  const payloadB = JSON.stringify({ external_ref: 'ref-b', skill_name: 'skill-b', diff: 'diff-b' });
  const sigB = crypto.createHmac('sha256', 'test_secret').update(payloadB).digest('hex');
  const reqB = new NextRequest('http://localhost/api/v1/skill-review', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-panel-site-key': 'pk_test',
      'x-panel-ingest-sig': sigB,
    },
    body: payloadB,
  });
  const resB = await ingestRoute.POST(reqB);
  const jsonB = await resB.json();
  const rowB = db.prepare('SELECT pool, json FROM units WHERE id=?').get(jsonB.unit_id) as { pool: string; json: string };
  const unitB = JSON.parse(rowB.json) as { pool: string };
  ok(rowB.pool === 'public' && unitB.pool === 'public', 'default routing remains public when trusted_pool_only is absent');

  console.log(`\n${pass} passed, ${fail} failed`);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
