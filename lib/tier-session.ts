// WS-P: tier session — tracks per-session attempts and enforces D19 anti-reroll.
//
// invariant: once a session is issued a challenge unit-set, a *failed* attempt
// re-renders the SAME set. attackers can't refresh-spam for an easier draw.
//
// storage: in-process (Map). short ttl (5min). this is a soft layer — the hard
// signature is the signed challenge_token (attestation jwt). session here is
// for retry-counter UX and re-rendering the same payload.
//
// NB: this does NOT replace existing anti-reroll done at /api/units/next (D19,
// commit 9ff8735). it stacks on top for the tier-ladder lifecycle.

export interface TierSession {
  id: string;               // challenge_token jti
  site_key: string;
  tier: 'C0' | 'C1' | 'C2' | 'C3';
  unit_ids: string[];       // the locked-in set
  attempts: number;         // increments on each /resolve call
  max_attempts: number;
  created_at: number;
  expires_at: number;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 10_000; // soft cap, prune oldest

declare global {
  // eslint-disable-next-line no-var
  var __panel_tier_sessions__: Map<string, TierSession> | undefined;
}
const store: Map<string, TierSession> =
  globalThis.__panel_tier_sessions__ ?? (globalThis.__panel_tier_sessions__ = new Map());

export function createSession(s: Omit<TierSession, 'attempts' | 'created_at' | 'expires_at' | 'max_attempts'> & { max_attempts?: number }): TierSession {
  pruneIfNeeded();
  const now = Date.now();
  const sess: TierSession = {
    ...s,
    attempts: 0,
    max_attempts: s.max_attempts ?? (s.tier === 'C3' ? 3 : s.tier === 'C2' ? 3 : 2),
    created_at: now,
    expires_at: now + TTL_MS,
  };
  store.set(sess.id, sess);
  return sess;
}

export function getSession(id: string): TierSession | undefined {
  const s = store.get(id);
  if (!s) return undefined;
  if (s.expires_at < Date.now()) { store.delete(id); return undefined; }
  return s;
}

export function bumpAttempt(id: string): TierSession | undefined {
  const s = getSession(id);
  if (!s) return undefined;
  s.attempts += 1;
  return s;
}

export function deleteSession(id: string): void { store.delete(id); }

function pruneIfNeeded(): void {
  if (store.size < MAX_SESSIONS) return;
  const now = Date.now();
  // first pass: expired
  for (const [k, v] of store.entries()) if (v.expires_at < now) store.delete(k);
  if (store.size < MAX_SESSIONS) return;
  // second pass: oldest 10%
  const sorted = [...store.entries()].sort((a, b) => a[1].created_at - b[1].created_at);
  const cut = Math.floor(MAX_SESSIONS * 0.1);
  for (let i = 0; i < cut && i < sorted.length; i++) store.delete(sorted[i][0]);
}

// for tests
export function __resetSessions(): void { store.clear(); }
