// WS-T phase 1: prove the kysely query patterns compile + run on postgres too.
// spins up a pg16 testcontainer on 5433, builds the panel schema, exercises
// the same query shapes used by lib/queries.ts. skipped if docker unavailable.
//
// run: node --import tsx __tests__/db-kysely-pg.test.ts
import { spawnSync } from 'node:child_process';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '../lib/db-types';

function have(cmd: string) {
  const r = spawnSync('which', [cmd]);
  return r.status === 0;
}

async function waitReady(pool: Pool, attempts = 30): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try { await pool.query('SELECT 1'); return true; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  return false;
}

async function run() {
  if (!have('docker')) {
    console.log('SKIP: docker not on PATH');
    process.exit(0);
  }
  // port: env override or default 5433. CI uses service container; local may collide.
  const PG_PORT = Number(process.env.PANEL_PG_TEST_PORT || 5433);
  // best-effort spin up. tolerate "already running" by killing first.
  spawnSync('docker', ['rm', '-f', 'panel-pg-test'], { stdio: 'ignore' });
  const r = spawnSync('docker', [
    'run', '--rm', '-d',
    '--name', 'panel-pg-test',
    '-p', `${PG_PORT}:5432`,
    '-e', 'POSTGRES_PASSWORD=test',
    'postgres:16-alpine',
  ]);
  if (r.status !== 0) {
    console.log('SKIP: docker run failed (perms? port in use? set PANEL_PG_TEST_PORT)');
    process.exit(0);
  }

  const pool = new Pool({
    host: '127.0.0.1', port: PG_PORT, user: 'postgres',
    password: 'test', database: 'postgres',
  });
  const ready = await waitReady(pool);
  if (!ready) {
    console.log('FAIL: pg never came up');
    spawnSync('docker', ['rm', '-f', 'panel-pg-test'], { stdio: 'ignore' });
    process.exit(2);
  }

  const kdb = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

  let pass = 0, fail = 0;
  const ok = (c: any, m: string) => { c ? (pass++, console.log('  ✓', m)) : (fail++, console.log('  ✗', m)); };

  try {
    // build minimal schema (pg flavor — INTEGER/BIGINT/TEXT)
    await sql`CREATE TABLE units (
      id TEXT PRIMARY KEY, json TEXT NOT NULL, pool TEXT NOT NULL,
      is_honeypot INTEGER NOT NULL, created_at BIGINT NOT NULL,
      trace_id TEXT, parent_span_path TEXT
    )`.execute(kdb);
    await sql`CREATE TABLE judgments (
      id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, rater_id TEXT NOT NULL,
      choice TEXT NOT NULL, latency_ms INTEGER NOT NULL, confidence DOUBLE PRECISION NOT NULL,
      created_at BIGINT NOT NULL, agreed_with_gold INTEGER, honeypot_failed INTEGER,
      pool TEXT, site_key TEXT, behavioral_json TEXT, honeypot_id TEXT, honeypot_result TEXT
    )`.execute(kdb);
    await sql`CREATE TABLE traces (
      trace_id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, source_agent TEXT NOT NULL,
      raw_blob_hash TEXT NOT NULL, sanitized_at BIGINT NOT NULL, ingested_at BIGINT NOT NULL,
      scrubber_attestation_jti TEXT, blob_size INTEGER NOT NULL, status TEXT NOT NULL,
      result_json TEXT, blob_json TEXT
    )`.execute(kdb);

    // same query shapes from lib/queries.ts
    await kdb.insertInto('units').values({
      id: 'u_pg_1', json: '{"x":1}', pool: 'public', is_honeypot: 0, created_at: 1,
      trace_id: null, parent_span_path: null,
    }).execute();

    const fetched = await kdb.selectFrom('units').select('json').where('id', '=', 'u_pg_1').executeTakeFirst();
    ok(fetched?.json === '{"x":1}', 'pg: getUnitJson roundtrips');

    // bulk
    await kdb.insertInto('units').values([
      { id: 'u_pg_2', json: '{}', pool: 'public', is_honeypot: 0, created_at: 1, trace_id: null, parent_span_path: null },
      { id: 'u_pg_3', json: '{}', pool: 'technical', is_honeypot: 0, created_at: 1, trace_id: null, parent_span_path: null },
    ]).execute();
    const pubs = await kdb.selectFrom('units').select(['id', 'json']).where('pool', '=', 'public').execute();
    ok(pubs.length === 2, `pg: listUnitsByPool('public') = 2 (got ${pubs.length})`);

    // upsert
    await kdb.insertInto('units').values({
      id: 'u_pg_1', json: '{"x":2}', pool: 'public', is_honeypot: 0, created_at: 2,
      trace_id: null, parent_span_path: null,
    }).onConflict(oc => oc.column('id').doUpdateSet({
      json: eb => eb.ref('excluded.json'),
      created_at: eb => eb.ref('excluded.created_at'),
    })).execute();
    const after = await kdb.selectFrom('units').select('json').where('id', '=', 'u_pg_1').executeTakeFirst();
    ok(after?.json === '{"x":2}', 'pg: insert ... on conflict do update');

    // judgments + seen
    await kdb.insertInto('judgments').values({
      id: 'j_pg_1', unit_id: 'u_pg_1', rater_id: 'r_p', choice: 'yes',
      latency_ms: 1, confidence: 0.5, created_at: Date.now(),
      agreed_with_gold: 1, honeypot_failed: 0, pool: 'public',
      site_key: null, behavioral_json: null, honeypot_id: null, honeypot_result: null,
    }).execute();
    const seen = await kdb.selectFrom('judgments').select('unit_id').distinct().where('rater_id', '=', 'r_p').execute();
    ok(seen.length === 1 && seen[0].unit_id === 'u_pg_1', 'pg: listSeenUnitIdsByRater');

    // traces upsert + status update
    await kdb.insertInto('traces').values({
      trace_id: 'tr_pg', operator_id: 'op', source_agent: 'sa',
      raw_blob_hash: 'h', sanitized_at: 1, ingested_at: 1,
      scrubber_attestation_jti: null, blob_size: 1, status: 'pending',
      result_json: null, blob_json: '{}',
    }).execute();
    await kdb.updateTable('traces').set({ status: 'done', result_json: '{}' }).where('trace_id', '=', 'tr_pg').execute();
    const tr = await kdb.selectFrom('traces').select(['trace_id', 'status']).where('trace_id', '=', 'tr_pg').executeTakeFirst();
    ok(tr?.status === 'done', 'pg: updateTraceStatus');

    // count
    const cnt = await kdb.selectFrom('units').select(eb => eb.fn.countAll<number>().as('n')).executeTakeFirstOrThrow();
    ok(Number(cnt.n) === 3, `pg: countUnits = 3 (got ${cnt.n})`);

    console.log(`\n${pass} passed, ${fail} failed`);
  } catch (e) {
    console.error(e);
    fail++;
  } finally {
    await kdb.destroy().catch(() => {});
    spawnSync('docker', ['rm', '-f', 'panel-pg-test'], { stdio: 'ignore' });
  }
  process.exit(fail === 0 ? 0 : 1);
}

run();
