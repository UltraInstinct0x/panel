import { ok, strictEqual, deepStrictEqual } from 'node:assert';

const { extractFeatures } = require('../public/edge/features.js');

function validateFeatureSchema(features: any) {
  ok(features, 'features object exists');
  strictEqual(typeof features, 'object', 'features is object');
  
  strictEqual(typeof features.feature_version, 'string', 'feature_version is string');
  strictEqual(features.feature_version, 'v1', 'feature_version is v1');
  
  ok(features.pointer_dynamics, 'pointer_dynamics exists');
  strictEqual(typeof features.pointer_dynamics, 'object', 'pointer_dynamics is object');
  strictEqual(typeof features.pointer_dynamics.count, 'number', 'pointer_dynamics.count is number');
  strictEqual(typeof features.pointer_dynamics.mean_speed, 'number', 'pointer_dynamics.mean_speed is number');
  strictEqual(typeof features.pointer_dynamics.variance_speed, 'number', 'pointer_dynamics.variance_speed is number');
  strictEqual(typeof features.pointer_dynamics.mean_jerk, 'number', 'pointer_dynamics.mean_jerk is number');
  
  ok(features.timing_entropy, 'timing_entropy exists');
  strictEqual(typeof features.timing_entropy, 'object', 'timing_entropy is object');
  strictEqual(typeof features.timing_entropy.dwell_ms, 'number', 'timing_entropy.dwell_ms is number');
  strictEqual(typeof features.timing_entropy.key_events, 'number', 'timing_entropy.key_events is number');
  strictEqual(typeof features.timing_entropy.mouse_count, 'number', 'timing_entropy.mouse_count is number');
  strictEqual(typeof features.timing_entropy.interval_coef_variation, 'number', 'timing_entropy.interval_coef_variation is number');
  
  ok(features.focus_visibility, 'focus_visibility exists');
  strictEqual(typeof features.focus_visibility, 'object', 'focus_visibility is object');
  strictEqual(typeof features.focus_visibility.focus_events, 'number', 'focus_visibility.focus_events is number');
  strictEqual(typeof features.focus_visibility.blur_events, 'number', 'focus_visibility.blur_events is number');
  strictEqual(typeof features.focus_visibility.visibility_changes, 'number', 'focus_visibility.visibility_changes is number');
  strictEqual(typeof features.focus_visibility.pointer_type, 'string', 'focus_visibility.pointer_type is string');
  
  ok(features.automation_indicators, 'automation_indicators exists');
  strictEqual(typeof features.automation_indicators, 'object', 'automation_indicators is object');
  strictEqual(typeof features.automation_indicators.webdriver, 'boolean', 'automation_indicators.webdriver is boolean');
  strictEqual(typeof features.automation_indicators.headless, 'boolean', 'automation_indicators.headless is boolean');
  strictEqual(typeof features.automation_indicators.phantom, 'boolean', 'automation_indicators.phantom is boolean');
  strictEqual(typeof features.automation_indicators.selenium, 'boolean', 'automation_indicators.selenium is boolean');
  strictEqual(typeof features.automation_indicators.puppeteer, 'boolean', 'automation_indicators.puppeteer is boolean');
  strictEqual(typeof features.automation_indicators.playwright, 'boolean', 'automation_indicators.playwright is boolean');
  strictEqual(typeof features.automation_indicators.cdp, 'boolean', 'automation_indicators.cdp is boolean');
  
  ok(features.runtime_health, 'runtime_health exists');
  strictEqual(typeof features.runtime_health, 'object', 'runtime_health is object');
  strictEqual(typeof features.runtime_health.has_mouse_samples, 'boolean', 'runtime_health.has_mouse_samples is boolean');
  strictEqual(typeof features.runtime_health.has_scroll_samples, 'boolean', 'runtime_health.has_scroll_samples is boolean');
  strictEqual(typeof features.runtime_health.has_pointer_type, 'boolean', 'runtime_health.has_pointer_type is boolean');
  strictEqual(typeof features.runtime_health.dwell_ms_valid, 'boolean', 'runtime_health.dwell_ms_valid is boolean');
}

function assertNoRawReplay(features: any) {
  ok(!features.mouse_samples, 'no raw mouse_samples in features');
  ok(!features.scroll_samples, 'no raw scroll_samples in features');
  ok(!features.raw_events, 'no raw_events in features');
  ok(!features.replay, 'no replay data in features');
  ok(!features.telemetry, 'no raw telemetry in features');
}

const emptyFeatures = extractFeatures(null);
validateFeatureSchema(emptyFeatures);
assertNoRawReplay(emptyFeatures);
strictEqual(emptyFeatures.pointer_dynamics.count, 0, 'empty features have zero pointer count');

const minimalFp = {
  mouse_samples: [],
  scroll_samples: [],
  focus_events: 0,
  blur_events: 0,
  key_events: 0,
  visibility_changes: 0,
  pointer_type: 'unknown',
  dwell_ms: 0,
};
const minimalFeatures = extractFeatures(minimalFp);
validateFeatureSchema(minimalFeatures);
assertNoRawReplay(minimalFeatures);

const richFp = {
  mouse_samples: [
    { t: 100, x: 10, y: 10 },
    { t: 200, x: 50, y: 30 },
    { t: 300, x: 80, y: 60 },
    { t: 400, x: 120, y: 90 },
    { t: 500, x: 150, y: 110 },
  ],
  scroll_samples: [
    { t: 150, dy: 10 },
    { t: 350, dy: 30 },
  ],
  focus_events: 3,
  blur_events: 2,
  key_events: 12,
  visibility_changes: 1,
  pointer_type: 'mouse',
  dwell_ms: 2500,
};
const richFeatures = extractFeatures(richFp);
validateFeatureSchema(richFeatures);
assertNoRawReplay(richFeatures);
strictEqual(richFeatures.pointer_dynamics.count, 5, 'rich features capture correct sample count');
ok(richFeatures.pointer_dynamics.mean_speed > 0, 'rich features compute non-zero mean speed');
ok(richFeatures.pointer_dynamics.variance_speed >= 0, 'rich features compute variance');
strictEqual(richFeatures.timing_entropy.dwell_ms, 2500, 'rich features preserve dwell_ms');
strictEqual(richFeatures.focus_visibility.pointer_type, 'mouse', 'rich features preserve pointer_type');

const invalidFp = { garbage: 'data', nested: { also: 'invalid' } };
const invalidFeatures = extractFeatures(invalidFp as any);
validateFeatureSchema(invalidFeatures);
assertNoRawReplay(invalidFeatures);

console.log('edge-feature-schema.test: ok');
