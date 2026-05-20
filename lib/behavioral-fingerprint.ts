// WS-P: behavioral fingerprint — server-side derivation from passive client payload.
//
// the widget collects (passively, no input prompts) over the first ~2.5s:
//   - mouse coordinate samples (timestamped)
//   - scroll deltas (timestamped)
//   - focus/blur counts
//   - dwell time on the pill region
//   - keyboard event count (NOT contents — counts only)
//
// we derive a trust score 0..1. high trust = "this session looks human-shaped
// without us ever showing them a challenge". used by tier-ladder to grant C0.
//
// not anti-bot magic. signal floor. paired with risk-score (ip/velocity) for
// the actual escalation decision.

export interface RawFingerprint {
  mouse_samples?: Array<{ t: number; x: number; y: number }>;
  scroll_samples?: Array<{ t: number; dy: number }>;
  focus_events?: number;
  blur_events?: number;
  key_events?: number;
  dwell_ms?: number;
  pointer_type?: 'mouse' | 'touch' | 'pen' | 'unknown';
  visibility_changes?: number;
}

export interface DerivedFingerprint {
  trust: number;            // 0..1
  has_mouse: boolean;
  has_focus: boolean;
  has_scroll: boolean;
  dwell_ms: number;
  // diagnostics — surfaced for debugging / dashboard
  components: {
    mouse_entropy: number;       // 0..1, normalized shannon-ish over direction bins
    mouse_speed_ok: number;      // 0..1, 1 if avg speed in [0.05, 5] px/ms
    scroll_variance: number;     // 0..1, normalized variance of dy
    dwell_score: number;         // 0..1, ramp 0→1 over [250ms, 2500ms]
    focus_signal: number;        // 0..1, 1 if any focus event
    pointer_native: number;      // 0..1, 1 if pointer_type is mouse/touch/pen
  };
}

export function deriveFingerprint(raw: RawFingerprint | undefined | null): DerivedFingerprint {
  const r: RawFingerprint = raw || {};
  const mouseSamples = Array.isArray(r.mouse_samples) ? r.mouse_samples : [];
  const scrollSamples = Array.isArray(r.scroll_samples) ? r.scroll_samples : [];
  const dwell = clamp01abs(r.dwell_ms ?? 0);

  const mouse_entropy = computeMouseEntropy(mouseSamples);
  const mouse_speed_ok = computeMouseSpeedOk(mouseSamples);
  const scroll_variance = computeScrollVariance(scrollSamples);
  const dwell_score = rampDwell(dwell);
  const focus_signal = (r.focus_events ?? 0) > 0 ? 1 : 0;
  const pointer_native = r.pointer_type && r.pointer_type !== 'unknown' ? 1 : 0;

  // weighted sum — caps at 1.0
  // mouse entropy is the dominant signal, dwell is the floor.
  const trust = clamp01(
    0.30 * mouse_entropy +
    0.15 * mouse_speed_ok +
    0.15 * scroll_variance +
    0.20 * dwell_score +
    0.10 * focus_signal +
    0.10 * pointer_native
  );

  return {
    trust,
    has_mouse: mouseSamples.length > 2,
    has_focus: focus_signal > 0,
    has_scroll: scrollSamples.length > 0,
    dwell_ms: dwell,
    components: {
      mouse_entropy,
      mouse_speed_ok,
      scroll_variance,
      dwell_score,
      focus_signal,
      pointer_native,
    },
  };
}

// shannon entropy over 8 direction bins, normalized to 0..1.
// a flat (perfectly even) distribution → 1. all-one-direction → 0.
function computeMouseEntropy(samples: Array<{ t: number; x: number; y: number }>): number {
  if (samples.length < 4) return 0;
  const bins = new Array(8).fill(0);
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    if (dx === 0 && dy === 0) continue;
    const angle = Math.atan2(dy, dx); // -π..π
    const bin = Math.min(7, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 8));
    bins[bin]++;
    total++;
  }
  if (total === 0) return 0;
  let H = 0;
  for (const c of bins) {
    if (c === 0) continue;
    const p = c / total;
    H -= p * Math.log2(p);
  }
  // max entropy for 8 bins is log2(8) = 3
  return clamp01(H / 3);
}

function computeMouseSpeedOk(samples: Array<{ t: number; x: number; y: number }>): number {
  if (samples.length < 2) return 0;
  let totalDist = 0;
  let totalDt = 0;
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    const dt = Math.max(1, samples[i].t - samples[i - 1].t);
    totalDist += Math.hypot(dx, dy);
    totalDt += dt;
  }
  if (totalDt === 0) return 0;
  const avg = totalDist / totalDt;
  return avg >= 0.05 && avg <= 5 ? 1 : 0;
}

function computeScrollVariance(samples: Array<{ t: number; dy: number }>): number {
  if (samples.length < 2) return 0;
  const dys = samples.map(s => s.dy);
  const mean = dys.reduce((a, b) => a + b, 0) / dys.length;
  const variance = dys.reduce((a, b) => a + (b - mean) ** 2, 0) / dys.length;
  // normalize against a soft cap of 10000 (px²) — typical scroll deltas
  return clamp01(Math.sqrt(variance) / 100);
}

function rampDwell(ms: number): number {
  if (ms <= 250) return 0;
  if (ms >= 2500) return 1;
  return (ms - 250) / (2500 - 250);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function clamp01abs(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  return x;
}
