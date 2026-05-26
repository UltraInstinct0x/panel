import { ok, strictEqual } from 'node:assert';

const { checkWorkerSupport, checkWasmSupport, selectRuntime } = require('../public/edge/runtime.js');
const { invokeWithTimeout, buildFallbackPayload, INFERENCE_TIMEOUT_MS } = require('../public/edge/worker.js');
const { extractFeatures } = require('../public/edge/features.js');

const caps = { worker: checkWorkerSupport(), wasm: checkWasmSupport(), webgpu: false };
strictEqual(typeof caps.worker, 'boolean', 'worker support returns boolean');
strictEqual(typeof caps.wasm, 'boolean', 'wasm support returns boolean');

const runtime = selectRuntime(caps);
strictEqual(runtime, 'rules_only', 'phase 2 always selects rules_only runtime');

const fallback = buildFallbackPayload('test_reason');
strictEqual(fallback.runtime, 'rules_only', 'fallback payload has rules_only runtime');
strictEqual(fallback.model_error, true, 'fallback payload marks model_error true');
ok(fallback.reason_codes.includes('test_reason'), 'fallback includes reason code');

const emptyFeatures = extractFeatures(null);
strictEqual(emptyFeatures.feature_version, 'v1', 'empty features have v1 version');
ok(emptyFeatures.pointer_dynamics, 'empty features include pointer_dynamics aggregate');
ok(emptyFeatures.automation_indicators, 'empty features include automation_indicators');

const mockFp = {
  mouse_samples: [
    { t: 100, x: 10, y: 10 },
    { t: 200, x: 50, y: 30 },
    { t: 300, x: 80, y: 60 },
  ],
  scroll_samples: [{ t: 150, dy: 10 }],
  focus_events: 2,
  blur_events: 1,
  key_events: 5,
  visibility_changes: 0,
  pointer_type: 'mouse',
  dwell_ms: 1500,
};

const features = extractFeatures(mockFp);
strictEqual(features.feature_version, 'v1', 'features have v1 version');
strictEqual(features.pointer_dynamics.count, 3, 'pointer_dynamics count matches samples');
ok(features.pointer_dynamics.mean_speed >= 0, 'mean_speed is non-negative');
strictEqual(features.timing_entropy.dwell_ms, 1500, 'timing_entropy captures dwell_ms');
strictEqual(features.focus_visibility.focus_events, 2, 'focus_visibility captures focus_events');
strictEqual(typeof features.automation_indicators.webdriver, 'boolean', 'automation_indicators.webdriver is boolean');

async function testTimeout() {
  const result = await invokeWithTimeout(features, { timeoutMs: 50 });
  strictEqual(result.runtime, 'rules_only', 'phase 2 scaffold returns rules_only');
  ok(result.reason_codes.includes('edge_model_scaffold'), 'result includes scaffold reason');
}

async function testImmediate() {
  const result = await invokeWithTimeout(features, { timeoutMs: 100 });
  strictEqual(result.runtime, 'rules_only', 'immediate result returns rules_only');
  strictEqual(result.model_error, false, 'phase 2 scaffold has no model error');
}

async function run() {
  await testTimeout();
  await testImmediate();
}

run()
  .then(() => console.log('edge-runtime-fallback.test: ok'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
