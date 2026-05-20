// WS-N: structural splitter unit tests over 8 fixtures.
// run: pnpm exec tsx __tests__/splitter-structural.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { splitStructural, reMerge } from '../lib/splitter/structural';

const fixturesDir = path.join(__dirname, 'fixtures', 'traces');
const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json')).sort();

let failed = 0;
function assert(cond: any, msg: string) {
  if (!cond) { console.error('FAIL', msg); failed++; } else { console.log('ok  ', msg); }
}

if (files.length < 8) {
  console.error(`FAIL: expected ≥8 fixtures, found ${files.length}`);
  process.exit(1);
}

let totalStructural = 0;
let totalProseHandoff = 0;

for (const f of files) {
  const blob = JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'));
  const exp = blob._expected || {};
  const res = reMerge(splitStructural(blob.blob));
  const emitted = res.candidates.filter(c => c.type !== 'prose_handoff');
  const handoffs = res.candidates.filter(c => c.type === 'prose_handoff');
  totalStructural += emitted.length;
  totalProseHandoff += handoffs.length;

  if (exp.min_units != null) {
    assert(emitted.length >= exp.min_units, `${f}: ≥${exp.min_units} structural units (got ${emitted.length})`);
  }
  if (Array.isArray(exp.types_include)) {
    const types = new Set(emitted.map(c => c.type));
    for (const t of exp.types_include) {
      assert(types.has(t), `${f}: includes type ${t}`);
    }
  }
  if (exp.has_prose_handoff) {
    assert(handoffs.length > 0, `${f}: has prose_handoff`);
  }
  // every candidate has parent_span_path
  for (const c of res.candidates) {
    assert(typeof c.parent_span_path === 'string' && c.parent_span_path.length > 0, `${f}: parent_span_path set for ${c.type}`);
  }
}

// coverage: structural-only ≥80%, llm ≤20% of total emission across suite.
const total = totalStructural + totalProseHandoff;
const structuralRatio = total === 0 ? 1 : totalStructural / total;
assert(structuralRatio >= 0.8, `structural coverage ≥80% (got ${(structuralRatio * 100).toFixed(1)}%)`);

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nall green');
