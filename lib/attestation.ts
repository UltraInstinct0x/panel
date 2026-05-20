// signed-envelope attestation. HMAC-SHA256 over a compact JSON payload.
// format: pnl_v1.<base64url(payload)>.<base64url(sig)>
import crypto from 'crypto';

const SECRET = process.env.PANEL_SIGNING_SECRET || 'dev-insecure-secret-change-me';

export interface AttestationPayload {
  v: 1;
  iat: number;             // issued at, ms epoch
  exp: number;             // expires at, ms epoch (default +10min)
  jti: string;             // judgment id
  uid: string;             // unit id
  rid: string;             // rater id (opaque)
  pool: string;
  site_key: string;
  rater: { trust: number; behavioral_score: number };
  judgment_summary: { agreed_with_pool: boolean | null; latency_ms: number; honeypot_failed: boolean };
  scrubber_attestation: {
    service: string; rules_version: string; redactions: string[]; passed: boolean;
  };
}

function b64u(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64uDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export function issue(payload: Omit<AttestationPayload, 'v' | 'iat' | 'exp'> & { exp_ms?: number }): string {
  const iat = Date.now();
  const exp = iat + (payload.exp_ms ?? 10 * 60 * 1000);
  const { exp_ms: _ignore, ...rest } = payload as any;
  const full: AttestationPayload = { v: 1, iat, exp, ...rest };
  const json = JSON.stringify(full);
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest();
  return `pnl_v1.${b64u(json)}.${b64u(sig)}`;
}

export function verify(token: string): { ok: true; payload: AttestationPayload } | { ok: false; error: string } {
  try {
    if (!token || !token.startsWith('pnl_v1.')) return { ok: false, error: 'bad_prefix' };
    const [, pB64, sB64] = token.split('.');
    if (!pB64 || !sB64) return { ok: false, error: 'malformed' };
    const json = b64uDecode(pB64).toString('utf8');
    const expected = crypto.createHmac('sha256', SECRET).update(json).digest();
    const got = b64uDecode(sB64);
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
      return { ok: false, error: 'bad_signature' };
    }
    const payload = JSON.parse(json) as AttestationPayload;
    if (payload.exp < Date.now()) return { ok: false, error: 'expired' };
    return { ok: true, payload };
  } catch (e: any) {
    return { ok: false, error: 'parse_error' };
  }
}

// behavioral score: crude 0..1 from the summary signals.
export function scoreBehavioral(b?: {
  mouse_path_summary?: { sample_count: number; total_distance_px: number; avg_speed_px_ms: number; direction_changes: number };
  dwell_ms?: number; focus_events?: number;
}): number {
  if (!b) return 0;
  let s = 0;
  if (b.mouse_path_summary) {
    const m = b.mouse_path_summary;
    if (m.sample_count > 8) s += 0.25;
    if (m.direction_changes > 2) s += 0.25;
    if (m.avg_speed_px_ms > 0.05 && m.avg_speed_px_ms < 5) s += 0.2;
  }
  if ((b.dwell_ms ?? 0) >= 2500) s += 0.2;
  if ((b.focus_events ?? 0) > 0) s += 0.1;
  return Math.min(1, s);
}
