// WS-P unit tests: tier-ladder + behavioral-fingerprint.
// pure-node, no framework. usage: tsx __tests__/tier-ladder.test.ts
//
// asserts:
//   1. clean fingerprint + zero risk → C0
//   2. clean fingerprint + high risk → C1 or C2
//   3. zero-signal fingerprint → never C0 (floor)
//   4. min_trust gate respected
//   5. auto_c0=false → never C0
//   6. escalate() bumps one rung
//   7. fingerprint derivation: mouse entropy is high for varied paths, low for straight lines
//   8. dwell ramp respects [250ms, 2500ms]

import { pickTier, DEFAULT_POLICY, escalate } from '../lib/tier-ladder';
import { deriveFingerprint } from '../lib/behavioral-fingerprint';

let passed = 0, failed = 0;
function eq(name: string, a: any, b: any) {
  if (a === b) { passed++; console.log('  ok ', name); }
  else { failed++; console.log('  FAIL', name, '— expected', b, 'got', a); }
}
function near(name: string, a: number, b: number, eps = 0.05) {
  if (Math.abs(a - b) < eps) { passed++; console.log('  ok ', name); }
  else { failed++; console.log('  FAIL', name, '— expected ~', b, 'got', a); }
}

console.log('tier-ladder:');
const cleanFp = { trust: 0.9, has_mouse: true, has_focus: true, has_scroll: true, dwell_ms: 2500 };
const zeroFp = { trust: 0.0, has_mouse: false, has_focus: false, has_scroll: false, dwell_ms: 0 };

eq('clean + 0 risk → C0', pickTier(DEFAULT_POLICY, cleanFp, 0), 'C0');
eq('clean + 0.5 risk → C1 or C2', ['C1','C2'].includes(pickTier(DEFAULT_POLICY, cleanFp, 0.5)), true);
eq('clean + 1.0 risk → C3', pickTier(DEFAULT_POLICY, cleanFp, 1.0), 'C3');
eq('zero-signal → never C0', pickTier(DEFAULT_POLICY, zeroFp, 0) !== 'C0', true);
eq('min_trust gate', pickTier({ ...DEFAULT_POLICY, min_trust: 0.95 }, cleanFp, 0) !== 'C0', true);
eq('auto_c0=false → never C0', pickTier({ ...DEFAULT_POLICY, auto_c0: false }, cleanFp, 0) !== 'C0', true);
eq('escalate C0→C1', escalate('C0'), 'C1');
eq('escalate C1→C2', escalate('C1'), 'C2');
eq('escalate C2→C3', escalate('C2'), 'C3');
eq('escalate C3→C3 (capped)', escalate('C3'), 'C3');

console.log('behavioral-fingerprint:');
const variedMouse = Array.from({ length: 20 }, (_, i) => ({
  t: 1000 + i * 50,
  x: 100 + Math.cos(i * 0.7) * 80 + Math.random() * 10,
  y: 100 + Math.sin(i * 0.7) * 80 + Math.random() * 10,
}));
const straightMouse = Array.from({ length: 20 }, (_, i) => ({ t: 1000 + i * 50, x: 100 + i * 5, y: 100 }));

const fpVaried = deriveFingerprint({
  mouse_samples: variedMouse,
  scroll_samples: [{ t: 1, dy: 10 }, { t: 2, dy: 100 }, { t: 3, dy: 250 }],
  focus_events: 1, pointer_type: 'mouse', dwell_ms: 2500,
});
const fpStraight = deriveFingerprint({ mouse_samples: straightMouse, dwell_ms: 100, pointer_type: 'unknown' });
const fpZero = deriveFingerprint({});

eq('varied mouse entropy > straight', fpVaried.components.mouse_entropy > fpStraight.components.mouse_entropy, true);
eq('zero fp trust = 0', fpZero.trust, 0);
eq('varied trust > 0.5', fpVaried.trust > 0.5, true);
eq('has_mouse on varied', fpVaried.has_mouse, true);
eq('has_focus on varied', fpVaried.has_focus, true);
near('dwell ramp at 1375ms', deriveFingerprint({ dwell_ms: 1375 }).components.dwell_score, 0.5, 0.05);
eq('dwell ramp at 2500+ = 1', deriveFingerprint({ dwell_ms: 5000 }).components.dwell_score, 1);
eq('dwell ramp at 100 = 0', deriveFingerprint({ dwell_ms: 100 }).components.dwell_score, 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
