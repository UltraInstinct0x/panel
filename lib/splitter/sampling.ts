// WS-N: client-side sampling helper. NOT server-enforced. Plugin authors
// (WS-S) import this to decide whether to forward a trace at all.
//
// rules:
//   - always ship: error-flagged traces, traces with skill-diff hunks,
//     traces with novelty > threshold (default 0.7)
//   - else sample at 5%
//
// novelty: 1 - jaccard(token_set, rolling_lru_union)
//   rolling LRU is per-agent_id, capacity 200 traces.

export interface SamplingDecision {
  ship: boolean;
  reason: 'error' | 'skill_diff' | 'novelty' | 'baseline_sample' | 'baseline_skip';
  novelty: number;
}

export interface TraceLike {
  agent_id?: string;
  blob: any;
  error_flag?: boolean;
}

interface LruEntry {
  agent_id: string;
  tokens: Set<string>;
}

export class TraceLRU {
  private map = new Map<string, LruEntry[]>();
  constructor(public capacity = 200) {}
  push(agent_id: string, tokens: Set<string>): void {
    const arr = this.map.get(agent_id) ?? [];
    arr.push({ agent_id, tokens });
    while (arr.length > this.capacity) arr.shift();
    this.map.set(agent_id, arr);
  }
  union(agent_id: string): Set<string> {
    const arr = this.map.get(agent_id) ?? [];
    const u = new Set<string>();
    for (const e of arr) for (const t of e.tokens) u.add(t);
    return u;
  }
  size(agent_id: string): number {
    return (this.map.get(agent_id) ?? []).length;
  }
}

export function tokenize(blob: any): Set<string> {
  const text = typeof blob === 'string' ? blob : JSON.stringify(blob);
  const toks = text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);
  return new Set(toks);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 1 : inter / uni;
}

export interface DecideOpts {
  lru?: TraceLRU;
  baselineRate?: number; // 0..1, default 0.05
  noveltyThreshold?: number; // default 0.7
  rng?: () => number;
  hasSkillDiff?: (blob: any) => boolean;
}

function defaultHasSkillDiff(blob: any): boolean {
  const s = typeof blob === 'string' ? blob : JSON.stringify(blob);
  return /(^|\n)@@[^\n]*@@/.test(s) || /```diff\n/.test(s);
}

export function decideForward(trace: TraceLike, opts: DecideOpts = {}): SamplingDecision {
  const lru = opts.lru ?? sharedLRU;
  const rate = opts.baselineRate ?? 0.05;
  const noveltyT = opts.noveltyThreshold ?? 0.7;
  const rng = opts.rng ?? Math.random;
  const hasDiff = (opts.hasSkillDiff ?? defaultHasSkillDiff)(trace.blob);

  const tokens = tokenize(trace.blob);
  const agent = trace.agent_id || 'default';
  const union = lru.union(agent);
  const novelty = lru.size(agent) === 0 ? 1 : 1 - jaccard(tokens, union);

  // record-then-decide so subsequent traces see this one in LRU
  lru.push(agent, tokens);

  if (trace.error_flag) return { ship: true, reason: 'error', novelty };
  if (hasDiff) return { ship: true, reason: 'skill_diff', novelty };
  if (novelty > noveltyT) return { ship: true, reason: 'novelty', novelty };
  if (rng() < rate) return { ship: true, reason: 'baseline_sample', novelty };
  return { ship: false, reason: 'baseline_skip', novelty };
}

export const sharedLRU = new TraceLRU(200);
