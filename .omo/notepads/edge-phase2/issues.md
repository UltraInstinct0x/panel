# Edge Phase 2 Issues & Gotchas

## Known Constraints
- No actual model artifact in this phase (placeholder only)
- Worker communication overhead must be accounted for in timeout budget
- Feature extraction must be lightweight to not block UI
- Cross-origin worker loading may require CORS headers

## Testing Challenges
- Worker testing requires special setup (jsdom doesn't support workers)
- Timeout testing needs fake timers
- Feature extraction needs realistic interaction data

## Compliance Notes
- Feature extraction must not export raw telemetry
- Only aggregates and derived features sent to server
- No long raw replay by default
