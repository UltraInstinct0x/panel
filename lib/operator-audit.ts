// WS-Q: events_audit — every policy / config change on an operator key.
// rows are immutable; we never UPDATE/DELETE here.
import { db } from './db';
import crypto from 'crypto';

let _ensured = false;
function ensure(): void {
  if (_ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS events_audit (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      actor TEXT NOT NULL,
      site_key TEXT,
      before_json TEXT,
      after_json TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_audit_key ON events_audit(site_key, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_events_audit_ts ON events_audit(ts DESC);
  `);
  _ensured = true;
}

export interface AuditRow {
  id: string;
  event: string;
  actor: string;
  site_key: string | null;
  before_json: string | null;
  after_json: string | null;
  ts: number;
}

export function logAudit(args: {
  event: string;
  actor: string;
  site_key?: string | null;
  before?: unknown;
  after?: unknown;
}): AuditRow {
  ensure();
  const row: AuditRow = {
    id: `ev_${crypto.randomBytes(8).toString('hex')}`,
    event: args.event,
    actor: args.actor,
    site_key: args.site_key ?? null,
    before_json: args.before === undefined ? null : JSON.stringify(args.before),
    after_json: args.after === undefined ? null : JSON.stringify(args.after),
    ts: Date.now(),
  };
  db.prepare(
    'INSERT INTO events_audit (id, event, actor, site_key, before_json, after_json, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(row.id, row.event, row.actor, row.site_key, row.before_json, row.after_json, row.ts);
  return row;
}

export function listAuditForKey(siteKey: string, limit = 100): AuditRow[] {
  ensure();
  return db.prepare(
    'SELECT id, event, actor, site_key, before_json, after_json, ts FROM events_audit WHERE site_key = ? ORDER BY ts DESC LIMIT ?',
  ).all(siteKey, limit) as AuditRow[];
}

export function listAuditAll(limit = 200): AuditRow[] {
  ensure();
  return db.prepare(
    'SELECT id, event, actor, site_key, before_json, after_json, ts FROM events_audit ORDER BY ts DESC LIMIT ?',
  ).all(limit) as AuditRow[];
}

// WS-Q: convenience adapter — page expects {before, after} string fields.
export function recentAuditForKey(
  siteKey: string,
  limit = 50,
): { id: string; event: string; actor: string; ts: number; before: string | null; after: string | null }[] {
  return listAuditForKey(siteKey, limit).map(r => ({
    id: r.id, event: r.event, actor: r.actor, ts: r.ts,
    before: r.before_json, after: r.after_json,
  }));
}
