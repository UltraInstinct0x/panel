// WS-P: tier risk-score signals. crude v0, weighted sum.
// inputs: ip, ua, velocity-per-fingerprint, session age.
// output: 0..1 risk. higher = more likely bot/abuse.
//
// not the meat of the system — fingerprint-trust is. this is the *external*
// signal that bumps a clean-looking session into C1 when it shouldn't be C0.

import type { NextRequest } from 'next/server';

const recent: Map<string, number[]> = (globalThis as any).__panel_risk_recent__ ?? new Map();
(globalThis as any).__panel_risk_recent__ = recent;

const WINDOW_MS = 60_000;
const HIGH_VEL = 30; // requests/min per fingerprint
const MED_VEL = 10;

export interface RiskInput {
  ip?: string | null;
  ua?: string | null;
  fingerprint_id?: string | null;
  session_age_ms?: number;
}

export function computeRisk(inp: RiskInput): { score: number; reasons: string[] } {
  const now = Date.now();
  const reasons: string[] = [];
  let score = 0;

  // velocity
  const fp = inp.fingerprint_id || inp.ip || 'unknown';
  const arr = recent.get(fp) || [];
  const fresh = arr.filter(t => now - t < WINDOW_MS);
  fresh.push(now);
  recent.set(fp, fresh);
  if (fresh.length >= HIGH_VEL) { score += 0.5; reasons.push('velocity_high'); }
  else if (fresh.length >= MED_VEL) { score += 0.2; reasons.push('velocity_med'); }

  // ua heuristics
  const ua = (inp.ua || '').toLowerCase();
  if (!ua) { score += 0.2; reasons.push('no_ua'); }
  else if (/(headless|phantom|puppeteer|playwright|selenium|bot|curl|wget|python-requests)/.test(ua)) {
    score += 0.4; reasons.push('ua_bot_marker');
  }

  // session age
  if ((inp.session_age_ms ?? 0) < 100) { score += 0.1; reasons.push('zero_session'); }

  if (score > 1) score = 1;
  return { score, reasons };
}

export function riskFromReq(req: NextRequest, fingerprintId?: string | null, sessionAgeMs?: number): { score: number; reasons: string[] } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ua = req.headers.get('user-agent');
  return computeRisk({ ip, ua, fingerprint_id: fingerprintId, session_age_ms: sessionAgeMs });
}
