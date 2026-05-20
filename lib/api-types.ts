// shared chart-data shapes consumed by /dashboard and /operator.
// keep this thin — recharts is happy with `{ x, y, ... }`-style rows.

export interface SeriesPoint {
  /** unix ms at start of bucket */
  t: number;
  /** ISO date YYYY-MM-DD (UTC) for the bucket */
  date: string;
  /** total judgments in bucket */
  judgments: number;
  /** judgments that agreed with gold */
  agreed: number;
  /** judgments that disagreed with gold (excludes null/gold-less) */
  disagreed: number;
  /** honeypot failures in bucket */
  honeypot_failed: number;
  /** % agreement (0..100) — null if no scored judgments in bucket */
  agreement_pct: number | null;
}

export interface TypeDistRow {
  /** UnitType string */
  type: string;
  /** count of units of this type in the pool */
  units: number;
  /** count of judgments cast against this type */
  judgments: number;
}

export interface RaterTrustBucket {
  /** lower edge of trust bucket (0..1, step 0.1) */
  trust_lo: number;
  /** label like "50–60%" */
  label: string;
  /** how many raters fall in this bucket */
  raters: number;
}

export interface StatsSeriesResponse {
  window_days: number;
  series: SeriesPoint[];
}

export interface StatsTypesResponse {
  total_units: number;
  total_judgments: number;
  by_type: TypeDistRow[];
}

export interface RaterAgreementPoint {
  /** judgment index, 1-based, oldest first within the window */
  i: number;
  /** rolling agreement over last N judgments (0..100) */
  rolling_pct: number;
  /** trust at the time this judgment landed (0..100) */
  trust_pct: number;
  /** unit type for the judgment */
  type: string | null;
}
