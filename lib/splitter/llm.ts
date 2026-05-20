// WS-N: LLM fallback. Only consumes prose_handoff candidates from structural
// pass. Splits prose into atomic factual claims that a human can rate in <10s.
//
// model: openrouter sonnet by default, override via SPLITTER_LLM_MODEL env.
// token cap: 8k input / 2k output per call.
// failure: log + skip, never inject fake units.

import type { Candidate } from './structural';
import { approxTokens } from './structural';

const DEFAULT_MODEL = process.env.SPLITTER_LLM_MODEL || 'anthropic/claude-sonnet-4.5';
const MAX_INPUT_TOKENS = 8000;
const MAX_OUTPUT_TOKENS = 2000;

export interface LlmClaim {
  claim: string;
  span?: string;
}

export interface LlmResult {
  claims: LlmClaim[];
  llm_count: number;
  skipped_count: number;
}

// fetcher injection point for tests.
export type Fetcher = typeof fetch;

const PROMPT = `split this passage into atomic factual claims that a human could rate as supported/not-supported in <10s each.
return ONLY a JSON array of {claim, span} objects, where span is a verbatim short quote from the passage. no prose, no markdown, no preamble.
if the passage has no checkable claims, return [].

passage:
"""
{PASSAGE}
"""`;

async function callOpenrouter(prose: string, fetcher: Fetcher): Promise<LlmClaim[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const truncated = prose.split(/\s+/).slice(0, MAX_INPUT_TOKENS).join(' ');
  const body = {
    model: DEFAULT_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0,
    messages: [{ role: 'user', content: PROMPT.replace('{PASSAGE}', truncated) }],
  };
  try {
    const res = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'x-title': 'panel-splitter',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ evt: 'splitter_llm_http_err', status: res.status }));
      return null;
    }
    const j: any = await res.json();
    const text: string = j?.choices?.[0]?.message?.content ?? '';
    // strip code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return null;
    return arr
      .map((c: any) => ({ claim: String(c?.claim ?? '').trim(), span: c?.span ? String(c.span) : undefined }))
      .filter(c => c.claim.length > 0);
  } catch (err: any) {
    console.warn(JSON.stringify({ evt: 'splitter_llm_err', err: String(err?.message || err) }));
    return null;
  }
}

// process a list of prose_handoff candidates → emit hallucination_flag-style
// candidates. mutates nothing; returns new array.
export async function llmSplitProseCandidates(
  candidates: Candidate[],
  opts: { fetcher?: Fetcher } = {},
): Promise<{ emitted: Candidate[]; llm_count: number; skipped_count: number }> {
  const fetcher = opts.fetcher ?? (globalThis.fetch as Fetcher);
  const emitted: Candidate[] = [];
  let llm_count = 0;
  let skipped_count = 0;
  for (const c of candidates) {
    if (c.type !== 'prose_handoff' || !c.prose) continue;
    if (approxTokens(c.prose) > MAX_INPUT_TOKENS) {
      skipped_count++;
      continue;
    }
    const claims = await callOpenrouter(c.prose, fetcher);
    if (!claims) {
      skipped_count++;
      continue;
    }
    claims.forEach((cl, i) => {
      emitted.push({
        type: 'hallucination_flag',
        payload: {
          claim: cl.claim,
          source_span: cl.span ?? null,
          question: 'is this claim supported?',
          choices: [
            { label: 'A', text: 'supported' },
            { label: 'B', text: 'not supported' },
            { label: 'C', text: 'not enough info' },
          ],
        },
        parent_span_path: `${c.parent_span_path}.llm_claim[${i}]`,
        source_token_range: c.source_token_range,
      });
      llm_count++;
    });
  }
  return { emitted, llm_count, skipped_count };
}
