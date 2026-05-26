# Edge Phase 2 Decisions

## Architecture
- Worker-based inference to avoid main-thread jank
- Feature extraction runs in main thread (lightweight aggregates)
- Worker handles model loading and inference with hard timeout
- Fallback to rules_only is deterministic and always safe

## Timeout Strategy
- Hard timeout on worker inference: 100ms (conservative for p95 <20ms target)
- If timeout triggers: immediately return rules_only payload
- No retry logic - single attempt per challenge

## Feature Extraction
- Aggregates only (no raw replay export)
- Collected during challenge interaction
- Normalized before sending to worker
- Schema versioned as `feature_version: 'v1'`

## Runtime Detection
- Check for Worker support
- Check for WASM support (via feature detection)
- Graceful fallback if unsupported
- Report runtime in payload: 'wasm' | 'webgpu' | 'rules_only'
