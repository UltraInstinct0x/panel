// WS-N: deterministic splitter. emits typed candidate units from a sanitized
// trace blob. one unit per: tool-call, diff-hunk, cited-claim, pairwise msg
// pair (different agents, same prompt), long prose ≥120 tokens (handoff
// marker for LLM fallback).
//
// blob shapes accepted (best-effort):
//   { messages: [{role, content, tool_calls?, agent_id?, prompt_ref?}] }
//   { events: [...] }   — flattened to messages
//   { trace: [...] }    — flattened to messages
//   raw string          — wrapped as single assistant message
//
// each candidate has:
//   { type, payload, parent_span_path, source_token_range, prose_for_llm? }
//
// prose handoff candidates have type='prose_handoff' — the llm.ts pass
// consumes them and the structural emit drops them from final output.

import type { UnitType } from '../store';

export interface Candidate {
  type: UnitType | 'prose_handoff';
  payload: Record<string, any>;
  parent_span_path: string;
  source_token_range: [number, number]; // [startTok, endTok] inclusive-exclusive
  prose?: string; // populated for prose_handoff
}

export interface SplitResult {
  candidates: Candidate[];
  total_source_tokens: number;
}

// rough token = whitespace-split word. good enough for budget heuristics.
export function approxTokens(s: string): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function safeJson(v: any): string {
  try {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const PROSE_HANDOFF_MIN_TOKENS = 120;

// detect diff hunks in a string body. unified-diff style: lines starting
// with `--- ` and `+++ ` followed by `@@ ... @@`, or just `@@` blocks.
const DIFF_HEADER_RE = /(?:^|\n)(?:diff --git[^\n]*\n)?(?:--- [^\n]+\n\+\+\+ [^\n]+\n)?(@@[^\n]*@@[^\n]*(?:\n(?:[-+ \\][^\n]*|@@[^\n]*@@[^\n]*))+)/g;

// cited-claim detector: a sentence that includes a markdown link [text](http...)
// OR a footnote-style citation like `[1]` near the end, OR an inline url after
// "according to", "per", "source:".
const CITED_CLAIM_RE = /([^.!?\n]{20,}?(?:\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+|\[\d+\]|\bsource:\s*\S+)[^.!?\n]{0,200}[.!?])/gi;

interface NormMsg {
  role: string;
  content: string;
  tool_calls?: any[];
  agent_id?: string;
  prompt_ref?: string;
  idx: number;
}

function normalizeMessages(blob: any): NormMsg[] {
  if (typeof blob === 'string') {
    return [{ role: 'assistant', content: blob, idx: 0 }];
  }
  const src: any[] = Array.isArray(blob?.messages)
    ? blob.messages
    : Array.isArray(blob?.events)
      ? blob.events
      : Array.isArray(blob?.trace)
        ? blob.trace
        : Array.isArray(blob)
          ? blob
          : [];
  return src.map((m, idx) => {
    const role = String(m?.role ?? m?.type ?? 'assistant');
    let content = '';
    if (typeof m?.content === 'string') content = m.content;
    else if (Array.isArray(m?.content)) {
      content = m.content
        .map((p: any) => (typeof p === 'string' ? p : p?.text ?? ''))
        .join('\n');
    } else if (typeof m?.text === 'string') content = m.text;
    else if (m?.content) content = JSON.stringify(m.content);
    return {
      role,
      content,
      tool_calls: m?.tool_calls || m?.toolCalls || undefined,
      agent_id: m?.agent_id || m?.agent || undefined,
      prompt_ref: m?.prompt_ref || m?.prompt_id || undefined,
      idx,
    };
  });
}

// produce source_token_range cursor: we walk msgs in order, summing tokens.
export function splitStructural(blob: any): SplitResult {
  const msgs = normalizeMessages(blob);
  const cands: Candidate[] = [];
  let cursor = 0;

  for (const m of msgs) {
    const msgTokens = approxTokens(m.content);
    const msgStart = cursor;
    const msgEnd = cursor + msgTokens;
    cursor = msgEnd;

    // 1) tool calls
    if (Array.isArray(m.tool_calls)) {
      m.tool_calls.forEach((tc: any, tci: number) => {
        const name = tc?.name || tc?.function?.name || tc?.tool || 'tool';
        const args = tc?.arguments ?? tc?.args ?? tc?.input ?? null;
        const result = tc?.result ?? tc?.output ?? null;
        const toolBlock = [
          `tool: ${name}`,
          `args: ${safeJson(args)}`,
          `result: ${safeJson(result)}`,
        ].join('\n');
        cands.push({
          type: 'step_validity',
          payload: {
            tool: name,
            args,
            result,
            passage: toolBlock,
            prompt_context: toolBlock,
            question: `did this tool call match the user's intent?`,
            binary: { yes: 'yes', no: 'no' },
          },
          parent_span_path: `messages[${m.idx}].tool_calls[${tci}]`,
          source_token_range: [msgStart, msgEnd],
        });
      });
    }

    // 2) diff hunks in content
    const diffs = extractDiffs(m.content);
    diffs.forEach((d, di) => {
      cands.push({
        type: 'skill_diff',
        payload: {
          diff: d.text,
          question: 'is the new version better, worse, or equivalent?',
          choices: [
            { label: 'A', text: 'old' },
            { label: 'B', text: 'new' },
            { label: 'C', text: 'equivalent' },
            { label: 'D', text: "can't tell" },
          ],
        },
        parent_span_path: `messages[${m.idx}].diff[${di}]`,
        source_token_range: [msgStart + d.tokenOffset, msgStart + d.tokenOffset + approxTokens(d.text)],
      });
    });

    // 3) cited claims in assistant prose
    if (m.role === 'assistant') {
      const claims = extractCitedClaims(m.content);
      claims.forEach((c, ci) => {
        cands.push({
          type: 'hallucination_flag',
          payload: {
            claim: c.text,
            question: 'is this claim supported by the cited source?',
            choices: [
              { label: 'A', text: 'supported' },
              { label: 'B', text: 'not supported' },
              { label: 'C', text: 'not enough info' },
            ],
          },
          parent_span_path: `messages[${m.idx}].claim[${ci}]`,
          source_token_range: [msgStart + c.tokenOffset, msgStart + c.tokenOffset + approxTokens(c.text)],
        });
      });
    }
  }

  // 4) pairwise across two runs: assistant messages with same prompt_ref but
  // different agent_id.
  const byPrompt = new Map<string, NormMsg[]>();
  for (const m of msgs) {
    if (m.role !== 'assistant' || !m.prompt_ref || !m.agent_id) continue;
    const arr = byPrompt.get(m.prompt_ref) ?? [];
    arr.push(m);
    byPrompt.set(m.prompt_ref, arr);
  }
  for (const [pref, arr] of byPrompt.entries()) {
    if (arr.length < 2) continue;
    const agents = new Set(arr.map(a => a.agent_id));
    if (agents.size < 2) continue;
    const [a, b] = arr;
    cands.push({
      type: 'pairwise_trace',
      payload: {
        prompt_ref: pref,
        question: 'which agent solved it better?',
        choices: [
          { label: 'A', text: a.content.slice(0, 500) },
          { label: 'B', text: b.content.slice(0, 500) },
        ],
      },
      parent_span_path: `pairwise[${pref}]`,
      source_token_range: [0, 0],
    });
  }

  // 5) long-prose handoff: assistant messages ≥120 tokens with NO structural
  // candidates already emitted for them.
  const coveredMsgIdx = new Set<number>();
  for (const c of cands) {
    const m = /messages\[(\d+)\]/.exec(c.parent_span_path);
    if (m) coveredMsgIdx.add(parseInt(m[1], 10));
  }
  let scursor = 0;
  for (const m of msgs) {
    const msgTokens = approxTokens(m.content);
    const start = scursor;
    const end = scursor + msgTokens;
    scursor = end;
    if (m.role !== 'assistant') continue;
    if (coveredMsgIdx.has(m.idx)) continue;
    if (msgTokens < PROSE_HANDOFF_MIN_TOKENS) continue;
    cands.push({
      type: 'prose_handoff',
      payload: {},
      parent_span_path: `messages[${m.idx}].prose`,
      source_token_range: [start, end],
      prose: m.content,
    });
  }

  return { candidates: cands, total_source_tokens: cursor };
}

function extractDiffs(s: string): { text: string; tokenOffset: number }[] {
  const out: { text: string; tokenOffset: number }[] = [];
  if (!s) return out;
  // walk code-fence ```diff blocks first
  const fenceRe = /```(?:diff|patch)?\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(s)) !== null) {
    if (/^[@+\-]/m.test(m[1])) {
      const tokenOffset = approxTokens(s.slice(0, m.index));
      out.push({ text: m[1].trim(), tokenOffset });
    }
  }
  // also bare diff headers
  DIFF_HEADER_RE.lastIndex = 0;
  while ((m = DIFF_HEADER_RE.exec(s)) !== null) {
    const txt = m[1];
    if (out.some(o => txt.includes(o.text.slice(0, 40)))) continue;
    const tokenOffset = approxTokens(s.slice(0, m.index));
    out.push({ text: txt, tokenOffset });
  }
  return out;
}

function extractCitedClaims(s: string): { text: string; tokenOffset: number }[] {
  const out: { text: string; tokenOffset: number }[] = [];
  if (!s) return out;
  CITED_CLAIM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITED_CLAIM_RE.exec(s)) !== null) {
    const tokenOffset = approxTokens(s.slice(0, m.index));
    out.push({ text: m[1].trim(), tokenOffset });
  }
  return out;
}

// re-merge pass: enforce ≤1 unit per 200 source tokens. first collapse
// adjacent same-type cands of same parent msg; if still over budget, group
// by type globally and keep only `cap` per type proportionally.
export function reMerge(res: SplitResult): SplitResult {
  // budget: ≤1 unit per 200 source tokens, with a floor of 5 for very short
  // traces (otherwise sub-200-token traces can never emit >1 unit even
  // when they legitimately contain multiple atomic events).
  const FLOOR = 5;
  const cap = Math.max(FLOOR, Math.ceil(res.total_source_tokens / 200));

  // pass 1: adjacent same-type same-msg collapse
  const merged: Candidate[] = [];
  for (const c of res.candidates) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.type === c.type &&
      sameMsgPrefix(last.parent_span_path, c.parent_span_path)
    ) {
      last.source_token_range = [
        Math.min(last.source_token_range[0], c.source_token_range[0]),
        Math.max(last.source_token_range[1], c.source_token_range[1]),
      ];
      (last.payload as any)._merged = ((last.payload as any)._merged ?? 1) + 1;
      continue;
    }
    merged.push({ ...c });
  }
  if (merged.length <= cap) return { candidates: merged, total_source_tokens: res.total_source_tokens };

  // pass 2: still over budget. exclude prose_handoff from the cap (they get
  // dropped or LLM-split downstream), then bucket the emit set into `cap`
  // groups across types and merge each bucket into one candidate (type taken
  // from the first member, payload._merged tallies the rest).
  const handoffs = merged.filter(c => c.type === 'prose_handoff');
  const emit = merged.filter(c => c.type !== 'prose_handoff');
  if (emit.length <= cap) {
    return { candidates: [...emit, ...handoffs], total_source_tokens: res.total_source_tokens };
  }
  const bucket = Math.ceil(emit.length / cap);
  const kept: Candidate[] = [];
  for (let i = 0; i < emit.length; i += bucket) {
    const slice = emit.slice(i, i + bucket);
    const head = { ...slice[0], payload: { ...slice[0].payload } };
    for (const c of slice.slice(1)) {
      head.source_token_range = [
        Math.min(head.source_token_range[0], c.source_token_range[0]),
        Math.max(head.source_token_range[1], c.source_token_range[1]),
      ];
      (head.payload as any)._merged = ((head.payload as any)._merged ?? 1) + 1;
      (head.payload as any)._merged_types = Array.from(new Set([
        ...((head.payload as any)._merged_types ?? [head.type as string]),
        c.type as string,
      ]));
    }
    kept.push(head);
  }
  return { candidates: [...kept, ...handoffs], total_source_tokens: res.total_source_tokens };
}

function sameMsgPrefix(a: string, b: string): boolean {
  const ma = /messages\[(\d+)\]/.exec(a);
  const mb = /messages\[(\d+)\]/.exec(b);
  return !!ma && !!mb && ma[1] === mb[1];
}
