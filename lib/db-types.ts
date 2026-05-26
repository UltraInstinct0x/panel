// WS-T: hand-written Kysely table interfaces.
// schema mirrors lib/db.ts CREATE TABLE statements exactly.
// when adding a column: add it here + in db.ts schema + a migration.
// nullable cols use `T | null`. integers used as booleans stay `number` (0|1)
// because sqlite has no bool — pg dialect will need a `Generated<boolean>` shim
// at swap time (see DB Scale Ready Design.md §dialect-swap).

export interface UnitsTable {
  id: string;
  json: string;
  pool: string;          // 'public' | 'technical'
  is_honeypot: number;   // 0 | 1
  created_at: number;
  trace_id: string | null;
  parent_span_path: string | null;
}

export interface RatersTable {
  id: string;
  trust: number;
  judgments_count: number;
  agreed_count: number;
  earned_cents: number;
  bot_flag: number;
  created_at: number;
}

export interface JudgmentsTable {
  id: string;
  unit_id: string;
  rater_id: string;
  choice: string;
  latency_ms: number;
  confidence: number;
  created_at: number;
  agreed_with_gold: number | null;
  honeypot_failed: number;
  pool: string | null;
  site_key: string | null;
  behavioral_json: string | null;
  honeypot_id: string | null;
  honeypot_result: string | null;
}

export interface TracesTable {
  trace_id: string;
  operator_id: string | null;
  source_agent: string | null;
  raw_blob_hash: string | null;
  sanitized_at: number | null;
  ingested_at: number;
  scrubber_attestation_jti: string | null;
  blob_size: number;
  status: string;        // 'pending' | 'done' | 'error'
  result_json: string | null;
  blob_json: string | null;
}

export interface SiteKeysTable {
  site_key: string;
  scrubber_required: number;
  label: string | null;
  created_at: number;
  tier_policy: string | null;
}

export interface HoneypotsTable {
  honeypot_id: string;
  unit_type: string;
  payload: string;
  decoy_answer: string;
  true_answer: string;
}

export interface AuditLogTable {
  id: string;
  ts: number;
  actor_kind: string;
  actor_id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  meta_json: string | null;
}

export interface JtiConsumedTable {
  jti: string;
  consumed_at: number;
  exp: number;
}

export interface RateBucketsTable {
  key: string;
  tokens: number;
  updated_at: number;
}

export interface RaterLedgerTable {
  rater_id: string;
  judgments_total: number;
  converged_judgments_total: number;
  converged_agree_total: number;
  agreement_rate: number;
  calibration_events_total: number;
  calibration_brier_sum: number;
  calibration_score: number;
  last_seen: number;
}

export interface ChallengeEventsTable {
  jti: string;
  site_key: string;
  tier: string;
  pool: string | null;
  trust: number | null;
  risk: number | null;
  verdict: string | null;
  confidence: number | null;
  trust_tier: string | null;
  reason_codes_json: string | null;
  edge_runtime: string | null;
  edge_model_version: string | null;
  edge_feature_version: string | null;
  edge_fallback: number | null;
  edge_model_error: number | null;
  created_at: number;
  resolved_at: number | null;
  resolution: string | null;
}

// the master DB shape. add new tables here as they land.
export interface Database {
  units: UnitsTable;
  raters: RatersTable;
  judgments: JudgmentsTable;
  traces: TracesTable;
  site_keys: SiteKeysTable;
  honeypots: HoneypotsTable;
  audit_log: AuditLogTable;
  jti_consumed: JtiConsumedTable;
  rate_buckets: RateBucketsTable;
  rater_ledger: RaterLedgerTable;
  challenge_events: ChallengeEventsTable;
}
