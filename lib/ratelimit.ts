// in-process token-bucket, periodically persisted to sqlite for crash recovery.
// two scopes: per-IP and per-site-key, each with its own bucket key.
import { loadBucket, saveBucket, gcBuckets } from './db';

interface Bucket { tokens: number; updated_at: number; dirty: boolean; }

// per-IP: 60/min => refill rate 1/sec, cap 60
// per-key: 600/min => 10/sec, cap 600
const RATES = {
  ip:  { cap: 60,  refill_per_ms: 60 / 60000 },
  key: { cap: 600, refill_per_ms: 600 / 60000 },
};

const buckets = new Map<string, Bucket>();

function getOrLoad(key: string, cap: number): Bucket {
  let b = buckets.get(key);
  if (b) return b;
  const persisted = loadBucket(key);
  if (persisted) {
    b = { tokens: Math.min(cap, persisted.tokens), updated_at: persisted.updated_at, dirty: false };
  } else {
    b = { tokens: cap, updated_at: Date.now(), dirty: false };
  }
  buckets.set(key, b);
  return b;
}

function refill(b: Bucket, refill_per_ms: number, cap: number, now: number) {
  const elapsed = now - b.updated_at;
  if (elapsed <= 0) return;
  b.tokens = Math.min(cap, b.tokens + elapsed * refill_per_ms);
  b.updated_at = now;
}

export interface RLResult {
  ok: boolean;
  retry_after_s: number;
  remaining: number;
  limit: number;
  scope: 'ip' | 'key';
}

export function consume(scope: 'ip' | 'key', id: string): RLResult {
  const cfg = RATES[scope];
  const key = `rl:${scope}:${id}`;
  const b = getOrLoad(key, cfg.cap);
  const now = Date.now();
  refill(b, cfg.refill_per_ms, cfg.cap, now);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    b.dirty = true;
    return { ok: true, retry_after_s: 0, remaining: Math.floor(b.tokens), limit: cfg.cap, scope };
  }
  const deficit = 1 - b.tokens;
  const retry_ms = Math.ceil(deficit / cfg.refill_per_ms);
  return { ok: false, retry_after_s: Math.max(1, Math.ceil(retry_ms / 1000)), remaining: 0, limit: cfg.cap, scope };
}

// flush dirty buckets every 5s
let _flusherStarted = false;
export function startFlusher() {
  if (_flusherStarted) return;
  _flusherStarted = true;
  setInterval(() => {
    for (const [k, b] of buckets) {
      if (b.dirty) { try { saveBucket(k, b.tokens, b.updated_at); b.dirty = false; } catch {} }
    }
  }, 5000).unref();
  // hourly GC of stale buckets + jti
  setInterval(() => {
    try { gcBuckets(); } catch {}
    try { (require('./db') as typeof import('./db')).gcJti(); } catch {}
  }, 3600_000).unref();
}

// check both scopes; first one to fail short-circuits.
export function checkBoth(ip: string, siteKey: string | null): RLResult {
  startFlusher();
  const ipR = consume('ip', ip);
  if (!ipR.ok) return ipR;
  if (siteKey) {
    const kR = consume('key', siteKey);
    if (!kR.ok) return kR;
    return kR;
  }
  return ipR;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

export function rateLimitHeaders(r: RLResult): Record<string, string> {
  const h: Record<string, string> = {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(Math.max(0, r.remaining)),
    'X-RateLimit-Scope': r.scope,
  };
  if (!r.ok) h['Retry-After'] = String(r.retry_after_s);
  return h;
}
