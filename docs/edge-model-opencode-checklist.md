# Opencode execution checklist: panel edge model (≤10MB)

Use this checklist to execute the edge-model rollout with planning/build/review agents. Last updated: 2026-05-26 after PR #20 (contract), #21 (worker/runtime/features), #22 (stateful SVG).

**Current phase:** Phase 1 (contract/fallback) ✅ + Phase 2 (worker/runtime/features) ✅ completed. All runtime currently operates in `rules_only` fallback — no actual model loaded yet.

---

## A) Planning checklist (must complete before coding)

- [x] Confirm files touched:
  - [x] widget runtime path (`public/v1.js` or split modules)
  - [x] challenge init/resolve handlers
  - [x] server fusion/policy layer in `lib/`
  - [x] telemetry/logging schema
- [x] Define `client_features_v1` schema (aggregates only)
- [x] Define payload and response contract updates
- [x] Define fallback policy (`rules_only`) and thresholds
- [x] Define benchmark harness and pass/fail gates

Deliverable: `implementation-plan.md` with file-level diffs and sequence.

---

## B) Build checklist (implementation)

### Client
- [x] Add feature extraction module (short-window aggregates) — `public/edge/features.js`
- [ ] Add model loader/inference in worker (WASM path first) — **not yet**
- [x] Add runtime capability detection + health flags — `public/edge/runtime.js`
- [x] Add fallback to `rules_only` if unsupported/slow — `public/edge/worker.js`
- [ ] Ensure model artifact budget stays ≤10MB compressed — **no model loaded yet, still pure fallback**

### Server
- [x] Extend resolve/verify path to ingest model payload — `lib/edge-model-contract.ts` + `app/api/challenge/resolve/route.ts`
- [x] Add fusion logic with existing server signals — verdict builder in contract
- [x] Emit structured verdict + confidence + reason codes — trust tier, confidence, reason_codes
- [x] Keep existing auth/challenge invariants intact — verified via test suite

### Observability
- [x] Log `model_version`, `feature_version`, `runtime` — in payload contract
- [x] Log confidence band and selected reason codes
- [x] Add counters for fallback rate and model errors — `lib/operator-stats.ts`

### Safety
- [x] Hard timeout on inference path — `public/edge/worker.js` timeout contract
- [x] Never block verification on model init failure — `rules_only` fallback is always the default
- [x] Preserve current UX under degraded mode — verified, no regression

---

## C) Test checklist

### Functional
- [x] Existing verification flow unchanged when model disabled — tested, passes
- [x] Model-enabled path returns structured fields — contract tests pass
- [x] Fallback path triggers correctly on unsupported runtime — `edge-runtime-fallback.test.ts`
- [x] No cross-widget state bleed regressions — verified

### Performance
- [ ] p95 init and infer within budget on desktop — **no model loaded yet, benchmarks pending**
- [ ] p95 init and infer within budget on mid-tier mobile profile — **pending**
- [x] Main-thread jank not introduced — runs in worker

### Quality
- [ ] Compare model+fusion vs rules-only baseline — **no model yet**
- [ ] Report lift/precision/false-positive deltas — **pending**
- [ ] Confirm no major conversion-regression indicators — **pending

---

## D) Compliance checklist

- [ ] Purpose-limited field inventory documented
- [ ] Raw-vs-derived storage policy implemented
- [ ] Retention TTLs implemented and verified
- [ ] Region policy knobs documented
- [ ] Operator-facing disclosure text updated as needed

---

## E) Release checklist

- [ ] Feature flag defaults to off
- [ ] Canary rollout plan defined (traffic %, rollback trigger)
- [ ] Runtime telemetry dashboard prepared
- [ ] Rollback path tested
- [ ] Post-deploy verification script run

---

## F) Agent prompts (copy/paste)

### 1) planner agent
"Create a file-by-file implementation plan for adding a ≤10MB browser edge-risk model to panel widget flow. Include payload contracts, fallback behavior, benchmark plan, and rollout steps. Do not write code yet."

### 2) builder agent
"Implement client feature extraction + worker-based WASM inference with rules-only fallback. Wire payload into challenge resolve path and add structured verdict fields (trust tier, reason codes, model metadata). Add tests."

### 3) evaluator agent
"Benchmark and evaluate model path vs rules-only baseline. Report p50/p95 latency, fallback/error rates, and detection-lift metrics. Return pass/fail against acceptance gates."

---

## G) Acceptance gates (final go/no-go)

- [ ] Artifact budget ≤10MB compressed
- [ ] p95 latency gates met
- [ ] Fallback reliability proven
- [ ] Detection lift demonstrated
- [ ] No critical UX regressions
- [ ] Compliance controls in place

If any gate fails: do not promote; keep feature flag off and ship fixes first.
