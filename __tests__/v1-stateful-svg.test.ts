import * as fs from 'fs';
import * as vm from 'vm';

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
  if (!str.includes(substr)) throw new Error(`${msg} (missing "${substr}")`);
}

function assertNotIncludes(str: string, substr: string, msg: string) {
  if (str.includes(substr)) throw new Error(`${msg} (unexpected "${substr}")`);
}

// extract pure render helpers from v1.js by source slicing and evaluate them
// in an isolated vm context. this exercises actual function output rather than
// grepping the source.
function extractFn(name: string): string {
  const re = new RegExp(`\\n {2,4}(?:var ${name} = |function ${name}\\b)`);
  const m = v1Source.match(re);
  if (!m) throw new Error(`could not locate function ${name}`);
  const start = m.index!;
  // walk braces from first '{' after the match to find the matching close
  let i = v1Source.indexOf('{', start);
  if (i < 0) throw new Error(`no opening brace for ${name}`);
  let depth = 0;
  let inStr: string | null = null;
  let prev = '';
  for (; i < v1Source.length; i++) {
    const c = v1Source[i];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === "'" || c === '"') {
      inStr = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        return v1Source.slice(start, i + 1);
      }
    }
    prev = c;
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

// also pull the stateColorMap var declaration
function extractVar(name: string): string {
  const re = new RegExp(`\\n  var ${name} = \\{`);
  const m = v1Source.match(re);
  if (!m) throw new Error(`could not locate var ${name}`);
  const start = m.index!;
  let i = v1Source.indexOf('{', start);
  let depth = 0;
  let inStr: string | null = null;
  let prev = '';
  for (; i < v1Source.length; i++) {
    const c = v1Source[i];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === "'" || c === '"') {
      inStr = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        // consume trailing ';' if present
        let end = i + 1;
        if (v1Source[end] === ';') end++;
        return v1Source.slice(start, end);
      }
    }
    prev = c;
  }
  throw new Error(`unbalanced braces extracting var ${name}`);
}

const bundle = [
  extractVar('stateColorMap'),
  extractVar('GEOMETRY_SCALES'),
  extractFn('buildStateGeometry'),
  extractFn('renderPillIconSVG'),
  extractFn('renderFaviconSVG'),
  extractFn('renderStatefulSVG'),
  // resolveTrustState lives inside the renderPill closure; re-derive from source.
  extractFn('resolveTrustState'),
  `
  module.exports = {
    stateColorMap: stateColorMap,
    GEOMETRY_SCALES: GEOMETRY_SCALES,
    buildStateGeometry: buildStateGeometry,
    renderPillIconSVG: renderPillIconSVG,
    renderFaviconSVG: renderFaviconSVG,
    renderStatefulSVG: renderStatefulSVG,
    resolveTrustState: resolveTrustState,
  };
  `,
].join('\n');

const sandbox: any = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(bundle, sandbox);
const api = sandbox.module.exports;

console.log('v1-stateful-svg behavioral tests:');

// === resolveTrustState (bug 1: numeric trust mapping) ===
test('resolveTrustState prefers explicit string tier', () => {
  assert(api.resolveTrustState('high', 0.1) === 'high', 'string tier wins');
  assert(api.resolveTrustState('blocked', 0.99) === 'blocked', 'string tier wins over numeric');
  assert(api.resolveTrustState('standard', undefined) === 'standard', 'string tier without numeric');
  assert(api.resolveTrustState('low', null) === 'low', 'string tier with null numeric');
});

test('resolveTrustState maps numeric trust via thresholds', () => {
  assert(api.resolveTrustState(undefined, 0.9) === 'high', '0.9 → high');
  assert(api.resolveTrustState(undefined, 0.75) === 'high', '0.75 → high (boundary)');
  assert(api.resolveTrustState(undefined, 0.6) === 'standard', '0.6 → standard');
  assert(api.resolveTrustState(undefined, 0.5) === 'standard', '0.5 → standard (boundary)');
  assert(api.resolveTrustState(undefined, 0.3) === 'low', '0.3 → low');
  assert(api.resolveTrustState(undefined, 0.2) === 'low', '0.2 → low (boundary)');
  assert(api.resolveTrustState(undefined, 0.1) === 'blocked', '0.1 → blocked');
  assert(api.resolveTrustState(undefined, 0) === 'blocked', '0 → blocked');
});

test('resolveTrustState rejects bogus string tier and falls back to numeric', () => {
  assert(api.resolveTrustState('bogus', 0.9) === 'high', 'invalid tier falls through to numeric');
  assert(api.resolveTrustState('', 0.1) === 'blocked', 'empty string falls through to numeric');
});

test('resolveTrustState handles missing trust input safely', () => {
  assert(api.resolveTrustState(undefined, undefined) === 'standard', 'no inputs → standard fallback');
  assert(api.resolveTrustState(null, NaN) === 'standard', 'NaN → standard fallback');
});

// === renderPillIconSVG behavioral checks ===
test('renderPillIconSVG returns distinct SVG per state', () => {
  const states = ['initial', 'standard', 'high', 'low', 'blocked'];
  const outputs = states.map((s) => api.renderPillIconSVG(s));
  outputs.forEach((svg, i) => {
    assert(typeof svg === 'string' && svg.length > 0, `${states[i]} returns non-empty`);
    assert(svg.startsWith('<svg'), `${states[i]} starts with <svg`);
    assertIncludes(svg, 'viewBox="0 0 32 32"', `${states[i]} uses 32x32 viewBox`);
    assertIncludes(svg, 'width="20" height="20"', `${states[i]} renders at 20px`);
  });
  // every pair of states should differ
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      assert(outputs[i] !== outputs[j], `${states[i]} and ${states[j]} must differ`);
    }
  }
});

test('renderPillIconSVG(high) carries green accent', () => {
  const svg = api.renderPillIconSVG('high');
  assertIncludes(svg, '#4ade80', 'green color present');
});

test('renderPillIconSVG(low) carries orange accent', () => {
  const svg = api.renderPillIconSVG('low');
  assertIncludes(svg, '#f59e0b', 'orange color present');
});

test('renderPillIconSVG(blocked) renders fractured diamond paths (4 paths)', () => {
  const svg = api.renderPillIconSVG('blocked');
  const pathCount = (svg.match(/<path /g) || []).length;
  assert(pathCount >= 4, `blocked needs >=4 path fragments, got ${pathCount}`);
});

test('renderPillIconSVG(initial) uses cyan, no green or orange', () => {
  const svg = api.renderPillIconSVG('initial');
  assertIncludes(svg, '#67e8f9', 'cyan present');
  assertNotIncludes(svg, '#4ade80', 'initial must not bleed green');
  assertNotIncludes(svg, '#f59e0b', 'initial must not bleed orange');
});

// === renderFaviconSVG ===
test('renderFaviconSVG returns SVG with rounded container per state', () => {
  ['initial', 'standard', 'high', 'low', 'blocked'].forEach((s) => {
    const svg = api.renderFaviconSVG(s);
    assert(svg.startsWith('<svg'), `${s} favicon is SVG`);
    assertIncludes(svg, 'viewBox="0 0 32 32"', `${s} favicon viewBox`);
    assertIncludes(svg, 'rx="5"', `${s} favicon rounded container`);
  });
});

// === renderStatefulSVG ===
test('renderStatefulSVG returns full lockup with brand text per state', () => {
  ['initial', 'standard', 'high', 'low', 'blocked'].forEach((s) => {
    const svg = api.renderStatefulSVG(s);
    assert(svg.startsWith('<svg'), `${s} lockup is SVG`);
    assertIncludes(svg, 'viewBox="0 0 560 140"', `${s} lockup uses 560x140 viewBox`);
    assertIncludes(svg, 'panel</text>', `${s} lockup includes brand text`);
    assertIncludes(svg, 'INVISIBLE CAPTCHA', `${s} lockup includes tagline`);
  });
});

test('renderStatefulSVG output differs per state (geometry truly varies)', () => {
  const states = ['initial', 'standard', 'high', 'low', 'blocked'];
  const outputs = states.map((s) => api.renderStatefulSVG(s));
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      assert(outputs[i] !== outputs[j], `lockup ${states[i]} and ${states[j]} must differ`);
    }
  }
});

// === bug 2: shared geometry helper produces identical state-branching at both scales ===
test('buildStateGeometry returns expected shape per scale', () => {
  ['small', 'large'].forEach((scale) => {
    ['initial', 'standard', 'high', 'low', 'blocked'].forEach((state) => {
      const g = api.buildStateGeometry(state, scale);
      assert(typeof g.outerFrame === 'string', `${scale}/${state} outerFrame is string`);
      assert(typeof g.core === 'string', `${scale}/${state} core is string`);
      assert(typeof g.outerColor === 'string', `${scale}/${state} outerColor is string`);
      assert(typeof g.accentColor === 'string', `${scale}/${state} accentColor is string`);
      assert(typeof g.baseOpacity === 'string' || typeof g.baseOpacity === 'number', `${scale}/${state} baseOpacity is set`);
    });
  });
});

test('buildStateGeometry blocked uses translucent white outer at both scales', () => {
  ['small', 'large'].forEach((scale) => {
    const g = api.buildStateGeometry('blocked', scale);
    assertIncludes(g.outerColor, 'rgba(255, 255, 255, 0.2)', `${scale}/blocked translucent outer`);
  });
});

// === bug 3: GLYPH_SVG initial alignment ===
test('GLYPH_SVG-equivalent (renderPillIconSVG("initial")) matches currentTrustState default', () => {
  // currentTrustState defaults to 'initial'; the static GLYPH_SVG must therefore
  // render the same string renderPillIconSVG('initial') produces.
  const initial = api.renderPillIconSVG('initial');
  // sanity: an 'initial' render should be visibly distinct from 'standard'
  assert(initial !== api.renderPillIconSVG('standard'), 'initial differs from standard');
  // and v1.js must actually assign that to GLYPH_SVG
  assertIncludes(v1Source, "var GLYPH_SVG = renderPillIconSVG('initial')", 'GLYPH_SVG bound to initial state');
});

// === stateColorMap completeness ===
test('stateColorMap has all 5 states with accent + opacity', () => {
  ['initial', 'standard', 'high', 'low', 'blocked'].forEach((s) => {
    const entry = api.stateColorMap[s];
    assert(entry, `stateColorMap.${s} exists`);
    assert(typeof entry.accentColor === 'string', `${s} has accentColor`);
    assert(typeof entry.baseOpacity === 'string' || typeof entry.baseOpacity === 'number', `${s} has baseOpacity`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
