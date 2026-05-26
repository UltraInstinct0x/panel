# ADR-0001: Edge model for panel widget (≤10MB)

- **Status:** Proposed (implementation-ready)
- **Date:** 2026-05-26
- **Owners:** panel core
- **Scope:** Browser widget (`public/v1.js`) + challenge/verify fusion path

---

## 1) Context

Panel currently runs captcha/verification flows and returns trust outcomes. We want stronger automation detection and agent-aware routing without adding heavy user friction or shipping large client artifacts.

Key constraints:
- Browser/edge-first inference
- Model artifact budget **≤10MB compressed**
- Mobile-safe latency
- Compliance posture based on minimization + purpose-limited processing

---

## 2) Decision

Adopt a **hybrid architecture**:

1. **Client-side tiny model** (WASM first, WebGPU optional) over compact behavioral/environment features.
2. **Server-side fusion** with network/session/history signals.
3. Return **structured verdict** (`human|agent_authorized|agent_unverified|bot`) + confidence + reason codes.

This is explicitly **not** a pure yes/no captcha response model.

---

## 3) Why this decision

- Keeps UX low-friction (most users never see high-friction challenge)
- Preserves operator control (policy uses confidence + reasons, not opaque bit)
- Supports compliance by minimizing raw telemetry export
- Fits modern browser performance envelopes with quantized tiny models

---

## 4) Constraints and SLOs

### Artifact budget
- Client model assets: **≤10MB compressed total**
- Target v1: model weights 1–4MB (quantized), remainder runtime overhead

### Performance
- p95 init: <150ms desktop, <400ms mid-tier mobile
- p95 inference: <20ms desktop, <60ms mobile
- Run in worker; avoid main-thread UI jank

### Availability/fallback
- If model/runtime unavailable or too slow: **rules-only fallback**
- Verification flow must not hard-fail due to model init issues

---

## 5) Architecture

### Client path
1. Collect short-window feature aggregates
2. Normalize + vectorize
3. Infer locally (WASM)
4. Send compact payload:
   - `local_score`
   - `local_class_probs`
   - `reason_codes`
   - `model_version`, `feature_version`, `runtime`

### Server path
1. Verify challenge/session integrity
2. Fuse local output + server signals (velocity, network, prior outcomes)
3. Apply per-operator policy
4. Emit verdict token + metadata for operator decisions

---

## 6) Feature schema (v1)

`client_features_v1` should include only aggregates (no long raw replay by default), e.g.:

- pointer dynamics: speed/variance/jerk aggregates
- timing entropy: click/keydown interval summaries
- focus/visibility behavior counts
- automation indicators: webdriver/headless/global artifacts
- runtime health: missing feature flags, capability bits

Include:
- `feature_version`
- `model_version`
- `runtime` (`wasm|webgpu|rules_only`)

---

## 7) Model strategy

Phased approach:
1. **Baseline:** rules + calibrated server classifier
2. **v1 client model:** tiny MLP over engineered features (quantized INT8)
3. Optional: temporal micro-model only if lift is proven

No heavyweight end-to-end model in browser for v1.

---

## 8) Data/compliance posture

Panel will process user data for security/abuse prevention. Guardrails:

- Purpose-limited processing (security/risk only)
- Minimize export (derived features + verdict metadata)
- Tiered retention windows by risk class
- No hidden ad-tech cross-site profiling behavior
- Region-aware policy modes (stricter defaults where needed)

---

## 9) API response contract (target)

```json
{
  "verdict": "human|agent_authorized|agent_unverified|bot",
  "confidence": 0.84,
  "trust_tier": "high|standard|low|blocked",
  "reason_codes": ["timing_uniformity_high", "webdriver_flag"],
  "model": {
    "client_model_version": "edge-risk-v1",
    "feature_version": "v1",
    "runtime": "wasm"
  }
}
```

---

## 10) Rollout plan

1. Dark-launch feature extraction + telemetry
2. Enable client inference for small traffic slice
3. Compare against rules-only baseline
4. Promote by measured lift + no UX regressions

---

## 11) Acceptance criteria

Must pass all:
1. ≤10MB compressed model artifact budget
2. SLOs met on target mobile and desktop profiles
3. No verification flow hard failures when model path unavailable
4. Measurable detection lift vs rules-only
5. Structured reason logging (`model_version`, `runtime`, `reason_codes`)
6. Retention + minimization controls implemented

---

## 12) Risks

- Adaptive evasion by bots → mitigate via rotating traps + server fusion
- Mobile performance variance → strict fallback thresholds
- False positives → confidence bands + step-up policy
- Compliance drift → schema governance + enforced retention

---

## 13) References

- TFJS quantization examples: https://github.com/tensorflow/tfjs-examples/blob/master/quantization/README.md
- TFJS converter quantization/sharding: https://github.com/tensorflow/tfjs/blob/master/tfjs-converter/README.md
- tfjs-tflite WASM runtime notes: https://www.npmjs.com/package/@tensorflow/tfjs-tflite
- TFJS size-optimized bundling: https://tensorflow.google.cn/js/tutorials/deployment/size_optimized_bundles
- Cloudflare Turnstile overview: https://developers.cloudflare.com/turnstile/
- Cloudflare Turnstile privacy addendum: https://www.cloudflare.com/en-gb/turnstile-privacy-policy/
- BotD browser-side detection precedent: https://github.com/fingerprintjs/BotD
