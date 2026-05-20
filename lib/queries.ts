// WS-T phase 1: kysely-backed query layer.
// migrated 10 hot-path queries off `db.prepare(...).run/get/all()` onto kysely.
// raw `db` export in lib/db.ts stays for unmigrated callers — hybrid by design.
//
// migrated:
//   1. insertUnit          (units ingest)
//   2. insertUnitsBulk     (units ingest — bulk tx)
//   3. getUnitJson         (units fetch by id)
//   4. listUnitsByPool     (units list filtered by pool)
//   5. listAllUnitsJson    (units list — all)
//   6. countUnits          (stats)
//   7. listSeenUnitIdsByRater (pickNextUnit join)
//   8. insertJudgment      (judgments insert)
//   9. upsertTrace         (traces insert/upsert)
//  10. getTrace            (traces fetch by id)
//  11. updateTraceStatus   (traces status update — bonus, same hot path)
//
// pattern: same shape as before. inserts/updates return void. selects return
// typed rows or undefined. transactions use kdb.transaction().execute(cb).
import { kdb } from './kysely';
import type { JudgmentsTable, TracesTable, UnitsTable } from './db-types';

// ---------- units ----------

export interface UnitInsert {
  id: string;
  json: string;
  pool: string;
  is_honeypot: 0 | 1;
  created_at: number;
  trace_id?: string | null;
  parent_span_path?: string | null;
}

export async function insertUnit(u: UnitInsert): Promise<void> {
  await kdb.insertInto('units').values({
    id: u.id,
    json: u.json,
    pool: u.pool,
    is_honeypot: u.is_honeypot,
    created_at: u.created_at,
    trace_id: u.trace_id ?? null,
    parent_span_path: u.parent_span_path ?? null,
  })
    .onConflict(oc => oc.column('id').doUpdateSet({
      json: eb => eb.ref('excluded.json'),
      pool: eb => eb.ref('excluded.pool'),
      is_honeypot: eb => eb.ref('excluded.is_honeypot'),
      created_at: eb => eb.ref('excluded.created_at'),
      trace_id: eb => eb.ref('excluded.trace_id'),
      parent_span_path: eb => eb.ref('excluded.parent_span_path'),
    }))
    .execute();
}

export async function insertUnitsBulk(rows: UnitInsert[]): Promise<void> {
  if (rows.length === 0) return;
  await kdb.transaction().execute(async tx => {
    // sqlite + pg both happy with multi-row insert; chunk to be safe.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).map(u => ({
        id: u.id,
        json: u.json,
        pool: u.pool,
        is_honeypot: u.is_honeypot,
        created_at: u.created_at,
        trace_id: u.trace_id ?? null,
        parent_span_path: u.parent_span_path ?? null,
      }));
      await tx.insertInto('units').values(slice).execute();
    }
  });
}

export async function getUnitJson(id: string): Promise<string | undefined> {
  const row = await kdb.selectFrom('units')
    .select('json')
    .where('id', '=', id)
    .executeTakeFirst();
  return row?.json;
}

export async function listUnitsByPool(pool: string): Promise<Array<Pick<UnitsTable, 'id' | 'json'>>> {
  return await kdb.selectFrom('units')
    .select(['id', 'json'])
    .where('pool', '=', pool)
    .execute();
}

export async function listAllUnitsJson(): Promise<Array<{ json: string }>> {
  return await kdb.selectFrom('units').select('json').execute();
}

export async function countUnits(filter?: { pool?: string; is_honeypot?: 0 | 1 }): Promise<number> {
  let q = kdb.selectFrom('units').select(eb => eb.fn.countAll<number>().as('n'));
  if (filter?.pool) q = q.where('pool', '=', filter.pool);
  if (filter?.is_honeypot !== undefined) q = q.where('is_honeypot', '=', filter.is_honeypot);
  const row = await q.executeTakeFirstOrThrow();
  return Number(row.n);
}

export async function listSeenUnitIdsByRater(raterId: string): Promise<string[]> {
  const rows = await kdb.selectFrom('judgments')
    .select('unit_id')
    .distinct()
    .where('rater_id', '=', raterId)
    .execute();
  return rows.map(r => r.unit_id);
}

// ---------- judgments ----------

export type JudgmentInsert = Omit<JudgmentsTable, never>;

export async function insertJudgment(j: JudgmentInsert): Promise<void> {
  await kdb.insertInto('judgments').values(j).execute();
}

// ---------- traces ----------

export type TraceUpsert = TracesTable;

export async function upsertTrace(t: TraceUpsert): Promise<void> {
  await kdb.insertInto('traces').values(t)
    .onConflict(oc => oc.column('trace_id').doUpdateSet({
      operator_id: eb => eb.ref('excluded.operator_id'),
      source_agent: eb => eb.ref('excluded.source_agent'),
      raw_blob_hash: eb => eb.ref('excluded.raw_blob_hash'),
      sanitized_at: eb => eb.ref('excluded.sanitized_at'),
      ingested_at: eb => eb.ref('excluded.ingested_at'),
      scrubber_attestation_jti: eb => eb.ref('excluded.scrubber_attestation_jti'),
      blob_size: eb => eb.ref('excluded.blob_size'),
      status: eb => eb.ref('excluded.status'),
      result_json: eb => eb.ref('excluded.result_json'),
      blob_json: eb => eb.ref('excluded.blob_json'),
    }))
    .execute();
}

export async function getTrace(traceId: string): Promise<Pick<TracesTable, 'trace_id' | 'status' | 'result_json' | 'blob_size' | 'ingested_at'> | undefined> {
  return await kdb.selectFrom('traces')
    .select(['trace_id', 'status', 'result_json', 'blob_size', 'ingested_at'])
    .where('trace_id', '=', traceId)
    .executeTakeFirst();
}

export async function updateTraceStatus(traceId: string, status: string, result_json: string | null): Promise<void> {
  await kdb.updateTable('traces')
    .set({ status, result_json })
    .where('trace_id', '=', traceId)
    .execute();
}
