// WS-P: tier ladder.
// pickTier(policy, fingerprint, riskScore) -> 'C0' | 'C1' | 'C2' | 'C3'
//
// semantics (spec §tier semantics):
//   C0 invisible-auto-check  → score < t_c0
//   C1 single-judgment       → t_c0 <= score < t_c1
//   C2 public-mix            → t_c1 <= score < t_c2
//   C3 multi-turn expert     → score >= t_c2
//
// the "score" we threshold against is a *combined* risk score derived from
// (1 - behavioralFingerprint.trust) + riskScore, clamped [0,1].
// behavioral floor: if fingerprint says "no signal at all" (zero-mouse, zero-focus),
// we never grant C0 — minimum C1. that's the D14 invariant: invisible-effort still
// requires *some* human-shaped passive signal.

export type Tier = 'C0' | 'C1' | 'C2' | 'C3';

export interface TierPolicy {
  // upper-bounds: score < t_c0 → C0, etc.
  t_c0_max: number;
  t_c1_max: number;
  t_c2_max: number;
  // floors / toggles
  min_trust: number;       // fingerprint.trust must be >= this for C0
  auto_c0: boolean;        // master switch — operator may force-disable invisible mode
  escalate_on_fail: boolean;
}

export const DEFAULT_POLICY: TierPolicy = {
  t_c0_max: 0.30,
  t_c1_max: 0.60,
  t_c2_max: 0.85,
  min_trust: 0.50,
  auto_c0: true,
  escalate_on_fail: true,
};

export interface FingerprintTrust {
  // 0..1 — higher = more human-shaped passive signal collected
  trust: number;
  // hard signals — if all zero, we know we got nothing
  has_mouse: boolean;
  has_focus: boolean;
  has_scroll: boolean;
  dwell_ms: number;
}

export function pickTier(
  policy: TierPolicy,
  fp: FingerprintTrust,
  riskScore: number, // 0..1, external risk (ip/velocity/etc), default 0
): Tier {
  const r = clamp01(riskScore);
  const t = clamp01(fp.trust);
  // combined risk: take the WORST of (inverse-trust, external-risk).
  // rationale: high external risk (ip rep, velocity) should trump a
  // human-looking fingerprint — a bot that learned to wiggle the mouse is
  // exactly the case we'd see. soft weighting (0.85 cap on each side) keeps
  // a single signal from being dispositive.
  const score = clamp01(Math.max(0.85 * (1 - t), 0.95 * r));

  // hard floor: no passive signal at all → never C0
  const zeroSignal = !fp.has_mouse && !fp.has_focus && !fp.has_scroll && fp.dwell_ms < 250;

  if (score < policy.t_c0_max && policy.auto_c0 && t >= policy.min_trust && !zeroSignal) return 'C0';
  if (score < policy.t_c1_max) return 'C1';
  if (score < policy.t_c2_max) return 'C2';
  return 'C3';
}

// helper: bump a tier up one rung (escalation on fail)
export function escalate(t: Tier): Tier {
  if (t === 'C0') return 'C1';
  if (t === 'C1') return 'C2';
  return 'C3';
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
