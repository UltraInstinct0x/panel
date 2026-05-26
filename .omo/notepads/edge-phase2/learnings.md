# Edge Phase 2 Learnings

## Scope
- Add worker runtime scaffolding and feature extraction only (no real model artifacts yet)
- Wire into public/v1.js with hard timeout fallback to rules_only
- Keep existing behavior stable when unsupported
- Add tests for fallback + schema
- Branch: clawd/edge-phase2-worker

## Key Constraints
- Model artifact budget: ≤10MB compressed (phase 3+)
- p95 init: <150ms desktop, <400ms mobile
- p95 inference: <20ms desktop, <60ms mobile
- Hard timeout on inference path
- Never block verification on model init failure

## Existing Scaffolding (PR20)
- `lib/edge-model-contract.ts`: EdgeModelClientPayload, EdgeModelIngest, StructuredVerdict types
- `public/v1.js`: EDGE_MODEL_DEFAULT scaffold with rules_only fallback
- Tests: `__tests__/edge-model-contract.test.ts`, `__tests__/challenge-resolve-edge-contract.test.ts`

## Feature Schema (v1)
- pointer dynamics: speed/variance/jerk aggregates
- timing entropy: click/keydown interval summaries
- focus/visibility behavior counts
- automation indicators: webdriver/headless/global artifacts
- runtime health: missing feature flags, capability bits

## Files to Create
- `public/edge/features.js` - feature extraction module
- `public/edge/runtime.js` - runtime capability detection
- `public/edge/worker.js` - worker boot + inference timeout guard

## Files to Modify
- `public/v1.js` - wire feature extraction + worker invocation
- `lib/edge-model-contract.ts` - schema hardening if needed
- Add tests: `__tests__/edge-runtime-fallback.test.ts`, `__tests__/edge-feature-schema.test.ts`

## Fallback Policy
- If model/runtime unavailable or too slow: rules_only fallback
- Hard timeout: immediate fallback to rules_only
- Unsupported runtime: graceful downgrade
- No main-thread jank
