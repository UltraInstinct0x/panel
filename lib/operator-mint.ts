// WS-U: operator self-serve — applications + key minting + secret hashing.
//
// design:
//   - applications: anyone can POST one (rate-limited at route layer).
//   - mint: admin approves → mints site_key + ingest_secret (one-time displayed).
//   - ingest secret is stored as scrypt hash; raw never persisted.
//   - env-var secrets (PANEL_INGEST_SECRET_<KEY>) keep working as a higher-
//     priority fallback for first-party keys (back-compat with existing setup).
import * as crypto from 'crypto';
import { db } from './db';

export interface OperatorApplication {
  id: string;
  name: string;
  email: string;
  org: string | null;
  intended_use: string;
  requested_tier: string;
  scrubber_required: 0 | 1;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
  minted_site_key: string | null;
  rejection_reason: string | null;
  meta_json: string | null;
}

const APPLICATION_RATE_LIMIT_PER_DAY = 3;

// ---------- application intake ----------

export interface ApplyInput {
  name: string;
  email: string;
  org?: string | null;
  intended_use: string;
  requested_tier?: string;
  scrubber_required?: boolean;
  client_ip?: string | null;
}

export function createApplication(input: ApplyInput): { ok: true; id: string } | { ok: false; reason: string } {
  const name = (input.name || '').trim().slice(0, 120);
  const email = (input.email || '').trim().toLowerCase().slice(0, 240);
  const org = input.org ? input.org.trim().slice(0, 120) : null;
  const intended_use = (input.intended_use || '').trim().slice(0, 2000);
  const requested_tier = (input.requested_tier || 'free').slice(0, 40);
  const scrubber_required = input.scrubber_required === false ? 0 : 1;

  if (!name) return { ok: false, reason: 'name_required' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, reason: 'email_invalid' };
  if (intended_use.length < 20) return { ok: false, reason: 'intended_use_too_short' };

  // soft rate-limit: 3 pending apps per email per 24h
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const row = db.prepare(
    'SELECT COUNT(*) AS n FROM operator_applications WHERE email = ? AND created_at >= ?'
  ).get(email, since) as { n: number };
  if (row.n >= APPLICATION_RATE_LIMIT_PER_DAY) {
    return { ok: false, reason: 'rate_limited' };
  }

  const id = `app_${crypto.randomBytes(8).toString('hex')}`;
  db.prepare(
    `INSERT INTO operator_applications
     (id, name, email, org, intended_use, requested_tier, scrubber_required, status, created_at, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    name,
    email,
    org,
    intended_use,
    requested_tier,
    scrubber_required,
    Date.now(),
    input.client_ip ? JSON.stringify({ client_ip: input.client_ip }) : null
  );
  return { ok: true, id };
}

export function listApplications(status?: 'pending' | 'approved' | 'rejected' | 'all'): OperatorApplication[] {
  const s = status || 'pending';
  const rows = s === 'all'
    ? db.prepare('SELECT * FROM operator_applications ORDER BY created_at DESC LIMIT 500').all()
    : db.prepare('SELECT * FROM operator_applications WHERE status = ? ORDER BY created_at DESC LIMIT 500').all(s);
  return rows as OperatorApplication[];
}

export function getApplication(id: string): OperatorApplication | null {
  const row = db.prepare('SELECT * FROM operator_applications WHERE id = ?').get(id);
  return (row as OperatorApplication) ?? null;
}

// ---------- approval / mint ----------

export interface MintedOperator {
  site_key: string;
  ingest_secret: string; // raw; shown ONCE
  scrubber_required: boolean;
}

export function approveApplication(args: {
  application_id: string;
  admin_key: string;
  label_override?: string;
}): { ok: true; minted: MintedOperator; application_id: string } | { ok: false; reason: string } {
  const app = getApplication(args.application_id);
  if (!app) return { ok: false, reason: 'not_found' };
  if (app.status !== 'pending') return { ok: false, reason: 'not_pending' };

  const minted = mintSiteKey({
    label: args.label_override || `${app.org || app.name} <${app.email}>`,
    owner_email: app.email,
    scrubber_required: !!app.scrubber_required,
  });

  db.prepare(
    `UPDATE operator_applications
     SET status = 'approved', decided_at = ?, decided_by = ?, minted_site_key = ?
     WHERE id = ?`
  ).run(Date.now(), args.admin_key.slice(0, 12), minted.site_key, app.id);

  return { ok: true, minted, application_id: app.id };
}

export function rejectApplication(args: {
  application_id: string;
  admin_key: string;
  reason: string;
}): { ok: true } | { ok: false; reason: string } {
  const app = getApplication(args.application_id);
  if (!app) return { ok: false, reason: 'not_found' };
  if (app.status !== 'pending') return { ok: false, reason: 'not_pending' };
  db.prepare(
    `UPDATE operator_applications
     SET status = 'rejected', decided_at = ?, decided_by = ?, rejection_reason = ?
     WHERE id = ?`
  ).run(Date.now(), args.admin_key.slice(0, 12), args.reason.slice(0, 500), app.id);
  return { ok: true };
}

// ---------- key mint (also usable directly by admins) ----------

export function mintSiteKey(args: {
  label: string;
  owner_email?: string | null;
  scrubber_required?: boolean;
}): MintedOperator {
  const site_key = `pk_live_${crypto.randomBytes(12).toString('base64url')}`;
  const ingest_secret = `is_${crypto.randomBytes(24).toString('base64url')}`;
  const hash = hashIngestSecret(ingest_secret);
  const scrubber_required = args.scrubber_required === false ? 0 : 1;
  db.prepare(
    `INSERT INTO site_keys
       (site_key, scrubber_required, label, created_at, ingest_secret_hash, owner_email, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).run(
    site_key,
    scrubber_required,
    args.label.slice(0, 240),
    Date.now(),
    hash,
    args.owner_email ?? null
  );
  return { site_key, ingest_secret, scrubber_required: !!scrubber_required };
}

export function rotateIngestSecret(siteKey: string): { ingest_secret: string } | null {
  const row = db.prepare('SELECT 1 FROM site_keys WHERE site_key = ?').get(siteKey);
  if (!row) return null;
  const ingest_secret = `is_${crypto.randomBytes(24).toString('base64url')}`;
  const hash = hashIngestSecret(ingest_secret);
  db.prepare('UPDATE site_keys SET ingest_secret_hash = ? WHERE site_key = ?').run(hash, siteKey);
  return { ingest_secret };
}

// ---------- secret hashing / verification ----------
//
// format: scrypt$N=16384,r=8,p=1$<saltB64>$<hashB64>
// scrypt cost is intentionally modest — ingest is on the hot path; this hash
// gets verified on every trace POST. 16384 is ~5ms; if we ever feel it in
// production we can move to bcrypt + an in-memory verified-secrets LRU.

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, SCRYPT_KEYLEN = 32, SALT_LEN = 16;

export function hashIngestSecret(secret: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyIngestSecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  try {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
    const params = Object.fromEntries(parts[1].split(',').map(kv => kv.split('=')));
    const N = parseInt(params.N), r = parseInt(params.r), p = parseInt(params.p);
    const salt = Buffer.from(parts[2], 'base64');
    const expected = Buffer.from(parts[3], 'base64');
    const derived = crypto.scryptSync(secret, salt, expected.length, { N, r, p });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function getIngestSecretHash(siteKey: string): string | null {
  const row = db.prepare('SELECT ingest_secret_hash FROM site_keys WHERE site_key = ?').get(siteKey) as { ingest_secret_hash: string | null } | undefined;
  return row?.ingest_secret_hash ?? null;
}
