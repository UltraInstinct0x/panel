export type EdgeModelRuntime = 'wasm' | 'webgpu' | 'rules_only';

export interface EdgeModelClientPayload {
  local_score?: number;
  local_class_probs?: Record<string, number>;
  reason_codes?: string[];
  model_version?: string;
  feature_version?: string;
  runtime?: EdgeModelRuntime;
  model_error?: boolean;
}

export interface EdgeModelIngest {
  local_score: number | null;
  local_class_probs: Record<string, number>;
  reason_codes: string[];
  model_version: string;
  feature_version: string;
  runtime: EdgeModelRuntime;
  model_error: boolean;
  fallback: boolean;
}

export interface StructuredVerdict {
  verdict: 'human' | 'agent_authorized' | 'agent_unverified' | 'bot';
  confidence: number;
  trust_tier: 'high' | 'standard' | 'low' | 'blocked';
  reason_codes: string[];
  model: {
    client_model_version: string;
    feature_version: string;
    runtime: EdgeModelRuntime;
  };
}

const MAX_REASON_CODES = 12;

export function ingestEdgeModelPayload(raw: unknown): EdgeModelIngest {
  const p = (raw && typeof raw === 'object') ? raw as EdgeModelClientPayload : {};
  const runtime = p.runtime === 'wasm' || p.runtime === 'webgpu' || p.runtime === 'rules_only'
    ? p.runtime
    : 'rules_only';
  const reasons = Array.isArray(p.reason_codes)
    ? p.reason_codes.map(String).map(s => s.slice(0, 64)).filter(Boolean).slice(0, MAX_REASON_CODES)
    : [];
  const probs = (p.local_class_probs && typeof p.local_class_probs === 'object')
    ? Object.fromEntries(Object.entries(p.local_class_probs).filter(([, v]) => Number.isFinite(Number(v))).slice(0, 8))
    : {};
  const localScore = Number.isFinite(Number(p.local_score)) ? Number(p.local_score) : null;
  const modelError = p.model_error === true;
  const fallback = runtime === 'rules_only' || modelError;
  if (fallback && !reasons.includes('edge_model_contract_fallback')) reasons.push('edge_model_contract_fallback');

  return {
    local_score: localScore,
    local_class_probs: probs,
    reason_codes: reasons,
    model_version: String(p.model_version || 'edge-risk-v1-scaffold'),
    feature_version: String(p.feature_version || 'v1'),
    runtime,
    model_error: modelError,
    fallback,
  };
}

export function buildStructuredVerdict(args: {
  pass: boolean;
  trust: number;
  resolveReason?: string;
  edge: EdgeModelIngest;
}): StructuredVerdict {
  const confidence = clamp01(args.edge.local_score ?? args.trust);
  const trustTier: StructuredVerdict['trust_tier'] = !args.pass
    ? (confidence < 0.2 ? 'blocked' : 'low')
    : (confidence >= 0.75 ? 'high' : 'standard');
  const reasonCodes = [...args.edge.reason_codes];
  if (args.resolveReason) reasonCodes.push(args.resolveReason);

  return {
    verdict: args.pass ? 'human' : 'bot',
    confidence,
    trust_tier: trustTier,
    reason_codes: Array.from(new Set(reasonCodes)).slice(0, MAX_REASON_CODES),
    model: {
      client_model_version: args.edge.model_version,
      feature_version: args.edge.feature_version,
      runtime: args.edge.runtime,
    },
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
