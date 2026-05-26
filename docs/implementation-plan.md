# edge model implementation plan (post-pr20)

## status snapshot

- ✅ pr20 shipped **contract scaffolding** (payload shape, structured verdict, fallback metadata, tests)
- ✅ merged to `main`
- ❌ no worker inference runtime yet
- ❌ no model artifact packaging yet
- ❌ no perf harness / canary rollout yet

---

## what pr20 provides now

1. client sends `edge_model` scaffold in resolve path (`public/v1.js`)
2. server ingests edge payload and emits structured `verdict` metadata
3. stats/logging captures runtime/version/fallback/error fields
4. deterministic `rules_only` fallback path exists
5. contract tests cover fallback behavior and resolve response shape

this means the protocol surface is live and stable enough to build real client inference without breaking server contracts.

---

## next implementation phases

## phase 2 — real client feature extraction + worker runtime

### files to add
- `public/edge/features.js`
- `public/edge/runtime.js`
- `public/edge/worker.js`

### files to modify
- `public/v1.js`
- `app/api/challenge/resolve/route.ts` (only if extra payload fields required)
- `lib/edge-model-contract.ts` (schema hardening)

### tasks
1. implement `client_features_v1` aggregate extractor (no raw replay export)
2. add worker boot + capability detection (wasm first; webgpu optional)
3. add inference timeout guard (hard cutoff => immediate rules_only)
4. emit health flags (`runtime`, `model_error`, `reason_codes`)
5. keep current behavior identical under unsupported runtime

### acceptance
- unsupported/slow runtime always downgrades safely
- no main-thread jank introduced
- existing flow unchanged when model path disabled

---

## phase 3 — model artifact + budget enforcement

### files to add
- `public/edge/models/<version>/...`
- `scripts/check-edge-model-budget.ts`

### tasks
1. add quantized model artifact
2. enforce compressed size gate `<= 10MB`
3. version model via `model_version`

### acceptance
- ci fails if model bundle exceeds budget
- model version appears in resolve logs/telemetry

---

## phase 4 — server fusion upgrade

### files to modify
- `app/api/challenge/resolve/route.ts`
- `app/api/verify/route.ts`
- `lib/operator-stats.ts`

### tasks
1. blend local score with server trust/fingerprint/session outcomes
2. map to trust tiers with stable policy thresholds
3. expand reason code coverage for explainability

### acceptance
- structured verdict fields remain backward compatible
- anti-reroll/session invariants preserved

---

## phase 5 — perf/quality/compliance gates

### files to add
- `scripts/bench-edge-runtime.ts`
- `docs/edge-model-benchmark-report.md`
- `docs/edge-model-compliance-notes.md`

### tasks
1. run p50/p95 desktop+mobile init/infer benchmarks
2. compare model+fusion vs rules-only baseline (lift/fp deltas)
3. verify retention/minimization controls + region knobs

### acceptance gates
- artifact <=10mb compressed
- p95 init/infer within adr bounds
- fallback reliability proven
- no critical ux regressions
- compliance controls documented

---

## rollout plan

1. feature flag remains off by default
2. canary 1% -> 5% -> 20% traffic
3. monitor fallback/error/confidence distributions
4. rollback trigger: latency or false-positive threshold breach

---

## immediate next PR (recommended)

**scope:** phase 2 only (worker + feature extraction + timeout fallback), no policy rewrite.

**target files:**
- add `public/edge/features.js`
- add `public/edge/runtime.js`
- add `public/edge/worker.js`
- patch `public/v1.js`
- add tests:
  - `__tests__/edge-runtime-fallback.test.ts`
  - `__tests__/edge-feature-schema.test.ts`

this keeps blast radius small and makes phase 3+ measurable.