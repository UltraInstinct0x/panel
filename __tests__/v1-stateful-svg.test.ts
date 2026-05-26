import * as fs from 'fs';

const v1Source = fs.readFileSync('./public/v1.js', 'utf-8');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e: any) {
    failed++;
    console.log('  ✗', name, '—', e.message);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertIncludes(str: string, substr: string, msg: string) {
  if (!str.includes(substr)) throw new Error(`${msg} (expected "${substr}" in "${str.slice(0, 100)}...")`);
}

console.log('v1-stateful-svg tests:');

test('renderPillIconSVG function exists and handles all states', () => {
  assertIncludes(v1Source, 'function renderPillIconSVG(state)', 'renderPillIconSVG function should exist');
  assertIncludes(v1Source, "state === 'initial'", 'Should handle initial state');
  assertIncludes(v1Source, "state === 'standard'", 'Should handle standard state');
  assertIncludes(v1Source, "state === 'high'", 'Should handle high state');
  assertIncludes(v1Source, "state === 'low'", 'Should handle low state');
  assertIncludes(v1Source, "state === 'blocked'", 'Should handle blocked state');
});

test('renderPillIconSVG(initial) generates dormant dot geometry', () => {
  const initialMatch = v1Source.match(/state === 'initial'[\s\S]{0,100}circle[\s\S]{0,100}r="1"/);
  assert(initialMatch !== null, 'Initial state should have small dot (r=1)');
});

test('renderPillIconSVG(standard) generates rotating diamond geometry', () => {
  const standardMatch = v1Source.match(/state === 'standard'[\s\S]{0,150}rect[\s\S]{0,100}rotate\(15/);
  assert(standardMatch !== null, 'Standard state should have rotated rect (15deg)');
});

test('renderPillIconSVG(high) generates solid center dot (green)', () => {
  const highMatch = v1Source.match(/state === 'high'[\s\S]{0,100}circle[\s\S]{0,100}r="2"/);
  assert(highMatch !== null, 'High state should have solid center dot (r=2)');
  assertIncludes(v1Source, '#4ade80', 'High state should use green accent');
});

test('renderPillIconSVG(low) generates bifurcated core (two dots, orange)', () => {
  const lowMatch = v1Source.match(/state === 'low'[\s\S]{0,200}circle[\s\S]+?circle/);
  assert(lowMatch !== null, 'Low state should have two circles (bifurcated core)');
  assertIncludes(v1Source, '#f59e0b', 'Low state should use orange accent');
});

test('renderPillIconSVG(blocked) contains fractured outer boundary', () => {
  assert(v1Source.includes('blocked'), 'Source should contain blocked state');
  assert(v1Source.includes('#28282c'), 'Blocked state should use dark accent');
});

test('renderFaviconSVG generates valid SVG with container rect', () => {
  assert(v1Source.includes('renderFaviconSVG'), 'Function should exist');
  assert(v1Source.includes('rx="5"'), 'Favicon should have rounded container');
});

test('renderStatefulSVG generates full primary SVG with brand text', () => {
  assert(v1Source.includes('renderStatefulSVG'), 'Function should exist');
  assert(v1Source.includes('panel</text>'), 'Should include brand text');
  assert(v1Source.includes('560 140'), 'Should have correct viewBox dimensions');
});

test('stateColorMap contains all 5 states', () => {
  assert(v1Source.includes('initial:'), 'stateColorMap should have initial');
  assert(v1Source.includes('standard:'), 'stateColorMap should have standard');
  assert(v1Source.includes('high:'), 'stateColorMap should have high');
  assert(v1Source.includes('low:'), 'stateColorMap should have low');
  assert(v1Source.includes('blocked:'), 'stateColorMap should have blocked');
});

test('updatePillIcon helper exists and updates data-trust-state', () => {
  assert(v1Source.includes('updatePillIcon'), 'updatePillIcon function should exist');
  assert(v1Source.includes('data-trust-state'), 'Should set data-trust-state attribute');
});

test('CSS contains trust state rules for high/low/blocked', () => {
  assert(v1Source.includes('data-trust-state="high"'), 'CSS should have high trust state rules');
  assert(v1Source.includes('data-trust-state="low"'), 'CSS should have low trust state rules');
  assert(v1Source.includes('data-trust-state="blocked"'), 'CSS should have blocked trust state rules');
});

test('playC0Animation updates icon to standard then high', () => {
  assert(v1Source.includes('playC0Animation'), 'playC0Animation should exist');
  const match = v1Source.match(/function playC0Animation[\s\S]{0,500}updatePillIcon/);
  assert(match !== null, 'playC0Animation should call updatePillIcon');
});

test('fireSolved maps trust level to trust state', () => {
  assert(v1Source.includes('fireSolved'), 'fireSolved should exist');
  const firesMatch = v1Source.match(/function fireSolved[\s\S]{0,800}trustState/);
  assert(firesMatch !== null, 'fireSolved should compute trustState from trust level');
});

test('Color correctness: initial=cyan, standard=cyan, high=green, low=orange, blocked=dark', () => {
  assertIncludes(v1Source, '#67e8f9', 'Cyan color for initial/standard');
  assertIncludes(v1Source, '#4ade80', 'Green color for high trust');
  assertIncludes(v1Source, '#f59e0b', 'Orange color for low trust');
  assertIncludes(v1Source, '#28282c', 'Dark color for blocked');
});

test('SVG scales: 20px pill icon, 16/32/64px favicon, 560x140 full', () => {
  assertIncludes(v1Source, 'width="20" height="20"', 'Pill icon should be 20px');
  assertIncludes(v1Source, 'viewBox="0 0 32 32"', 'Pill icon viewBox 32x32');
  assertIncludes(v1Source, 'viewBox="0 0 560 140"', 'Primary SVG viewBox 560x140');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
