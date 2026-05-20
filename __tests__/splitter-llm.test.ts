// WS-N: LLM fallback test with mocked openrouter.
// run: pnpm exec tsx __tests__/splitter-llm.test.ts
import { llmSplitProseCandidates } from '../lib/splitter/llm';
import type { Candidate } from '../lib/splitter/structural';

let failed = 0;
function assert(c: any, m: string) { if (!c) { console.error('FAIL', m); failed++; } else console.log('ok  ', m); }

async function main() {
  process.env.OPENROUTER_API_KEY = 'test_key';

  // mock fetcher returning two claims
  const mock: typeof fetch = (async (_url: any, _opts: any) => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify([
            { claim: 'http/2 multiplexes streams over a single tcp connection', span: 'multiplexes streams' },
            { claim: 'hpack is the header compression scheme used by http/2', span: 'hpack' },
          ]),
        },
      }],
    }),
  })) as any;

  const handoff: Candidate = {
    type: 'prose_handoff',
    payload: {},
    parent_span_path: 'messages[1].prose',
    source_token_range: [0, 200],
    prose: 'http/2 multiplexes streams over a single tcp connection by chopping requests and responses into frames. hpack is the header compression scheme used by http/2.',
  };
  const r = await llmSplitProseCandidates([handoff], { fetcher: mock });
  assert(r.llm_count >= 2, `llm emits ≥2 claims (got ${r.llm_count})`);
  assert(r.emitted.every(c => c.type === 'hallucination_flag'), 'all emitted are hallucination_flag');
  assert(r.skipped_count === 0, 'no skipped on success');

  // failure path: fetcher throws
  const bad: typeof fetch = (async () => { throw new Error('network down'); }) as any;
  const r2 = await llmSplitProseCandidates([handoff], { fetcher: bad });
  assert(r2.llm_count === 0, 'llm emits 0 on error');
  assert(r2.skipped_count === 1, 'skipped_count incremented on failure');
  assert(r2.emitted.length === 0, 'no fake units on failure');

  // bad JSON path
  const bad2: typeof fetch = (async () => ({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
  })) as any;
  const r3 = await llmSplitProseCandidates([handoff], { fetcher: bad2 });
  assert(r3.skipped_count === 1, 'skipped on bad json');

  // non-200 path
  const bad3: typeof fetch = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
  const r4 = await llmSplitProseCandidates([handoff], { fetcher: bad3 });
  assert(r4.skipped_count === 1, 'skipped on 500');

  if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
  console.log('\nall green');
}
main().catch(e => { console.error(e); process.exit(1); });
