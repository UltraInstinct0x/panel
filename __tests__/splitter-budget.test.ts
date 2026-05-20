// WS-N: budget property test. for every fixture (after reMerge),
// emitted_units / source_tokens ≤ 1/200.
// run: pnpm exec tsx __tests__/splitter-budget.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { splitStructural, reMerge, approxTokens } from '../lib/splitter/structural';
import { decideForward, TraceLRU } from '../lib/splitter/sampling';

let failed = 0;
function assert(c: any, m: string) { if (!c) { console.error('FAIL', m); failed++; } else console.log('ok  ', m); }

const fixturesDir = path.join(__dirname, 'fixtures', 'traces');
const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json')).sort();

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'));
  const res = reMerge(splitStructural(data.blob));
  const emitted = res.candidates.filter(c => c.type !== 'prose_handoff').length;
  // budget: ≤1 unit per 200 source tokens, floor 5 for short traces.
  const cap = Math.max(5, Math.ceil(res.total_source_tokens / 200));
  assert(emitted <= cap, `${f}: ${emitted} units ≤ cap=${cap} (src_tokens=${res.total_source_tokens})`);
}

// property fuzz: generate random tool-call traces and verify budget.
function rndTrace(seed: number) {
  const n = 1 + (seed % 5);
  const msgs: any[] = [];
  for (let i = 0; i < n; i++) {
    msgs.push({
      role: 'assistant',
      content: 'lorem ipsum '.repeat(40 + (seed % 30)),
      tool_calls: Array.from({ length: 1 + (seed % 3) }, (_, j) => ({ name: 't' + j, arguments: {}, result: 'r' })),
    });
  }
  return { messages: msgs };
}
for (let s = 1; s <= 25; s++) {
  const blob = rndTrace(s);
  const res = reMerge(splitStructural(blob));
  const emitted = res.candidates.filter(c => c.type !== 'prose_handoff').length;
  const cap = Math.max(5, Math.ceil(res.total_source_tokens / 200));
  assert(emitted <= cap, `fuzz seed=${s}: ${emitted} ≤ ${cap}`);
}

// sampling helper: forwarding probabilities behave.
{
  const lru = new TraceLRU(200);
  // seed LRU with similar traces
  for (let i = 0; i < 10; i++) {
    lru.push('a', new Set(['foo', 'bar', 'baz', 'qux']));
  }
  let shipped = 0; const N = 1000;
  for (let i = 0; i < N; i++) {
    const d = decideForward({ agent_id: 'a', blob: 'foo bar baz qux' }, { lru, rng: Math.random });
    if (d.ship) shipped++;
  }
  // expected ~5% baseline; allow 2-10% band
  assert(shipped / N >= 0.02 && shipped / N <= 0.10, `baseline sampling ~5% (got ${(shipped / N * 100).toFixed(1)}%)`);
}
{
  const lru = new TraceLRU(200);
  const d = decideForward({ agent_id: 'a', blob: 'completely fresh content xyzzy', error_flag: false }, { lru });
  // first trace ever for agent → novelty=1 → ship via novelty
  assert(d.ship && d.reason === 'novelty', `novel trace forwarded (reason=${d.reason})`);
}
{
  const d = decideForward({ agent_id: 'b', blob: 'crash trace', error_flag: true }, {});
  assert(d.ship && d.reason === 'error', 'error-flagged always shipped');
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nall green');
