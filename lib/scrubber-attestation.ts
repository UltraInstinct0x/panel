// WS-M: verify scrubber-proxy attestation JWT (HS256).
// payload: { jti, iat, exp, input_hash, output_hash, mode, engine_version }
// caller MUST also check output_hash matches sha256(actual_payload_body).
import crypto from 'crypto';

export interface ScrubberAttestation {
  jti: string;
  iat: number;
  exp: number;
  input_hash: string;
  output_hash: string;
  mode: string;
  engine_version: string;
}

export type VerifyError =
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'stale'
  | 'hash_mismatch'
  | 'no_secret';

export type VerifyResult =
  | { ok: true; payload: ScrubberAttestation }
  | { ok: false; error: VerifyError };

const MAX_AGE_SECONDS = 300;

function b64uDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export function verifyAttestation(token: string | null | undefined, opts: { expectedOutputHash?: string; secret?: string; nowSec?: number } = {}): VerifyResult {
  const secret = opts.secret ?? process.env.SCRUBBER_JWT_SECRET ?? '';
  if (!secret) return { ok: false, error: 'no_secret' };
  if (!token) return { ok: false, error: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'malformed' };
  const [h, p, s] = parts;
  let header: any, payload: ScrubberAttestation;
  try {
    header = JSON.parse(b64uDecode(h).toString('utf8'));
    payload = JSON.parse(b64uDecode(p).toString('utf8')) as ScrubberAttestation;
  } catch { return { ok: false, error: 'malformed' }; }
  if (header?.alg !== 'HS256') return { ok: false, error: 'malformed' };
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const got = b64uDecode(s);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    return { ok: false, error: 'bad_signature' };
  }
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { ok: false, error: 'expired' };
  if (payload.iat < now - MAX_AGE_SECONDS) return { ok: false, error: 'stale' };
  if (opts.expectedOutputHash && opts.expectedOutputHash !== payload.output_hash) {
    return { ok: false, error: 'hash_mismatch' };
  }
  return { ok: true, payload };
}

export function sha256Hex(s: string | Buffer): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
