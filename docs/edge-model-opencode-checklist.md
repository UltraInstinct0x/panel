# Opencode execution checklist: panel edge model (≤10MB)

Use this checklist to execute the edge-model rollout with planning/build/review agents.

---

## A) Planning checklist (must complete before coding)

- [ ] Confirm files touched:
  - [ ] widget runtime path (`public/v1.js` or split modules)
  - [ ] challenge init/resolve handlers
  - [ ] server fusion/policy layer in `lib/`
  - [ ] telemetry/logging schema
- [ ] Define `client_features_v1` schema (aggregates only)
- [ ] Define payload and response contract updates
- [ ] Define fallback policy (`rules_only`) and thresholds
- [ ] Define benchmark harness and pass/fail gates

Deliverable: `implementation-plan.md` with file-level diffs and sequence.

---

## B) Build checklist (implementation)

### Client
- [ ] Add feature extraction module (short-window aggregates)
- [ ] Add model loader/inference in worker (WASM path first)
- [ ] Add runtime capability detection + health flags
- [ ] Add fallback to `rules_only` if unsupported/slow
- [ ] Ensure model artifact budget stays ≤10MB compressed

### Server
- [ ] Extend resolve/verify path to ingest model payload
- [ ] Add fusion logic with existing server signals
- [ ] Emit structured verdict + confidence + reason codes
- [ ] Keep existing auth/challenge invariants intact

### Observability
- [ ] Log `model_version`, `feature_version`, `runtime`
- [ ] Log confidence band and selected reason codes
- [ ] Add counters for fallback rate and model errors

### Safety
- [ ] Hard timeout on inference path
- [ ] Never block verification on model init failure
- [ ] Preserve current UX under degraded mode

---

## C) Test checklist

### Functional
- [ ] Existing verification flow unchanged when model disabled
- [ ] Model-enabled path returns structured fields
- [ ] Fallback path triggers correctly on unsupported runtime
- [ ] No cross-widget state bleed regressions

### Performance
- [ ] p95 init and infer within budget on desktop
- [ ] p95 init and infer within budget on mid-tier mobile profile
- [ ] Main-thread jank not introduced

### Quality
- [ ] Compare model+fusion vs rules-only baseline
- [ ] Report lift/precision/false-positive deltas
- [ ] Confirm no major conversion-regression indicators

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
