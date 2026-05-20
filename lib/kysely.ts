// WS-T: kysely query builder, dialect-pluggable.
// wraps the EXISTING better-sqlite3 connection from lib/db.ts so the underlying
// file + schema bootstrap is shared. zero data migration. raw `db` export stays
// usable for unmigrated callers (hybrid mode).
//
// dialect swap: set PANEL_DB_DIALECT=postgres + PANEL_DB_URL — adds a
// PostgresDialect branch (driver lazy-loaded) without changing call sites.
// see (600) Work/panel/DB Scale Ready Design.md for swap runbook.
import { Kysely, SqliteDialect } from 'kysely';
import { db as sqliteConn } from './db';
import type { Database } from './db-types';

export type DB = Kysely<Database>;

declare global {
  // eslint-disable-next-line no-var
  var __panel_kysely__: DB | undefined;
}

function build(): DB {
  const dialect = (process.env.PANEL_DB_DIALECT || 'sqlite').toLowerCase();
  if (dialect === 'postgres' || dialect === 'pg') {
    // lazy: only require pg when explicitly opted-in so sqlite-only prod builds
    // don't pull the pg native dep.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PostgresDialect } = require('kysely');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require('pg');
    const url = process.env.PANEL_DB_URL;
    if (!url) throw new Error('PANEL_DB_URL required when PANEL_DB_DIALECT=postgres');
    return new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: url }) }),
    });
  }
  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqliteConn }),
  });
}

export const kdb: DB =
  globalThis.__panel_kysely__ ?? (globalThis.__panel_kysely__ = build());
