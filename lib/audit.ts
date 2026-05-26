// append-only audit log. minimal, just enough to demonstrate audit-trail capability.
// not hash-chained (yet). lives in the same sqlite as everything else.
import { db } from './db';

export type ActorKind = 'rater' | 'operator' | 'system' | 'contact';

export interface AuditEntry {
  id: string;
  ts: number;
  actor_kind: ActorKind;
  actor_id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  meta_json: string | null;
}

// schema bootstrap. safe to call repeatedly; uses CREATE TABLE IF NOT EXISTS.
function ensure() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      actor_kind TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_table TEXT,
      target_id TEXT,
      meta_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_kind, actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
  `);
}
ensure();

export function audit(
  actor_kind: ActorKind,
  actor_id: string,
  action: string,
  target_table: string | null = null,
  target_id: string | null = null,
  meta: Record<string, unknown> | null = null,
): void {
  try {
    const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      `INSERT INTO audit_log (id, ts, actor_kind, actor_id, action, target_table, target_id, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, Date.now(), actor_kind, actor_id, action, target_table, target_id, meta ? JSON.stringify(meta) : null);
  } catch (e) {
    // never let audit failures break the request path. log + swallow.
    // eslint-disable-next-line no-console
    console.error('[audit] insert failed', e);
  }
}

export function listAudit(opts: {
  actor_kind?: ActorKind;
  actor_id?: string;
  action?: string;
  limit?: number;
} = {}): AuditEntry[] {
  const limit = Math.min(opts.limit ?? 100, 1000);
  const where: string[] = [];
  const args: any[] = [];
  if (opts.actor_kind) { where.push('actor_kind = ?'); args.push(opts.actor_kind); }
  if (opts.actor_id) { where.push('actor_id = ?'); args.push(opts.actor_id); }
  if (opts.action) { where.push('action = ?'); args.push(opts.action); }
  const sql = `SELECT * FROM audit_log${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ts DESC LIMIT ?`;
  args.push(limit);
  return db.prepare(sql).all(...args) as AuditEntry[];
}
