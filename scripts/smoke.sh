#!/usr/bin/env bash
# smoke test — exercises core acceptance criteria against PANEL_BASE.
# Auth model (post launch-blockers, PR #24):
#   1. POST /api/challenge/init with site_key + good behavioral fingerprint
#      → server picks tier (C0 with our fp), returns challenge_token + units
#   2. POST /api/challenge/resolve with challenge_token + fingerprint
#      → server returns { success: true, token } where `token` is the verify_token
#   3. POST /api/rater/session with { verify_token }
#      → server returns { session, expires_at } — `session` is a bearer
#   4. Subsequent calls use Authorization: Bearer <session>
#      + X-Panel-Site-Key header. rater_id in body is REJECTED (400).
set -euo pipefail

BASE="${PANEL_BASE:-https://panel.goku.codes}"
KEY="${PANEL_KEY:-pk_demo_ci}"

# Realistic UA — avoids `ua_bot_marker` (+0.4 risk) that curl's default triggers.
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

ok() { printf "  \033[32mok\033[0m %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; exit 1; }
jget() { python3 -c "import json,sys; v=json.load(sys.stdin)$1; print('' if v is None else v)"; }

# A "human-shaped" fingerprint payload — passes the C0 tier gate:
#   - 40 mouse samples with non-uniform x/y → mouse_entropy ≈ 1.0
#   - focus_events > 0
#   - dwell_ms ≥ 500 (well above the C0 floor of 500ms)
#   - pointer_type=mouse → pointer_native = 1
# Combined trust → ~0.85; combined score = max(0.85*(1-0.85), 0) ≈ 0.127
# which is < t_c0_max=0.30 and trust ≥ min_trust=0.50 → tier=C0.
FP_JSON=$(python3 -c '
import json
samples = [{"t": i*50, "x": 100+i*3+(i%5), "y": 200+(i%7)*2} for i in range(40)]
print(json.dumps({
  "mouse_samples": samples,
  "scroll_samples": [{"t": i*100, "y": i*5} for i in range(10)],
  "focus_events": 2,
  "dwell_ms": 3500,
  "pointer_type": "mouse",
}))')

echo "== routes =="
for p in / /demo/gate /widget /dashboard /operator /embed; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$p")
  [[ "$code" == "200" ]] && ok "$p $code" || fail "$p got $code"
done

echo "== site-key gate =="
code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/units/next?pool=public")
[[ "$code" == "401" ]] && ok "missing site-key → 401" || fail "expected 401, got $code"

echo "== challenge init =="
init=$(curl -sS -A "$UA" -X POST "$BASE/api/challenge/init" \
  -H "Content-Type: application/json" \
  -H "X-Panel-Site-Key: $KEY" \
  -d "{\"site_key\":\"$KEY\",\"pool\":\"public\",\"session_age_ms\":120000,\"fingerprint\":$FP_JSON}")
challenge_token=$(printf '%s' "$init" | jget "['challenge_token']")
tier=$(printf '%s' "$init" | jget "['tier']")
[[ -n "$challenge_token" ]] && ok "challenge_token issued (tier=$tier)" || fail "no challenge_token: $init"

echo "== challenge resolve =="
# C0 path needs only fingerprint. C1/C2/C3 also need `answers` matching the
# units' valid choice tokens. Build answers from `units[*].binary` keys (the
# resolve route only validates *structural* choice membership, not correctness).
ANSWERS=$(printf '%s' "$init" | python3 -c '
import json,sys
d=json.load(sys.stdin)
out=[]
for u in d.get("units",[]):
    valid=[]
    if isinstance(u.get("binary"),dict): valid+=list(u["binary"].keys())
    if isinstance(u.get("choices"),list): valid+=[str(c) for c in u["choices"]]
    if isinstance(u.get("options"),list): valid+=[str(o.get("id",o) if isinstance(o,dict) else o) for o in u["options"]]
    out.append({"unit_id":u["id"],"choice": valid[0] if valid else "yes","latency_ms":3000})
print(json.dumps(out))')
resolve=$(curl -sS -A "$UA" -X POST "$BASE/api/challenge/resolve" \
  -H "Content-Type: application/json" \
  -H "X-Panel-Site-Key: $KEY" \
  -d "{\"challenge_token\":\"$challenge_token\",\"fingerprint\":$FP_JSON,\"answers\":$ANSWERS}")
success=$(printf '%s' "$resolve" | jget "['success']")
verify_token=$(printf '%s' "$resolve" | jget "['token']")
[[ "$success" == "True" ]] && ok "challenge resolved (success=true)" || fail "resolve failed: $resolve"
[[ -n "$verify_token" ]] && ok "verify_token minted" || fail "no verify_token: $resolve"

echo "== rater session mint =="
sess=$(curl -sS -X POST "$BASE/api/rater/session" \
  -H "Content-Type: application/json" \
  -d "{\"verify_token\":\"$verify_token\"}")
RATER_BEARER=$(printf '%s' "$sess" | jget "['session']")
[[ -n "$RATER_BEARER" ]] && ok "rater session bearer minted" || fail "no session: $sess"

AUTH="Authorization: Bearer $RATER_BEARER"

echo "== unit fetch (with bearer) =="
unit=$(curl -sS -H "$AUTH" -H "X-Panel-Site-Key: $KEY" "$BASE/api/units/next?pool=public")
unit_id=$(printf '%s' "$unit" | jget "['id']")
pool=$(printf '%s' "$unit" | jget ".get('pool')")
[[ "$pool" == "public" ]] && ok "public pool returned" || fail "expected public, got pool=$pool body=$unit"
[[ -n "$unit_id" ]] && ok "unit_id=$unit_id" || fail "no unit_id"

echo "== judgments rejects body rater_id =="
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/judgments" \
  -H "Content-Type: application/json" -H "$AUTH" -H "X-Panel-Site-Key: $KEY" \
  -d "{\"unit_id\":\"$unit_id\",\"rater_id\":\"smoke\",\"choice\":\"yes\",\"latency_ms\":3000}")
[[ "$code" == "400" ]] && ok "body rater_id → 400 (deprecation gate)" || fail "expected 400, got $code"

echo "== fast submit → 429 =="
resp=$(curl -sS -X POST "$BASE/api/judgments" \
  -H "Content-Type: application/json" -H "$AUTH" -H "X-Panel-Site-Key: $KEY" \
  -d "{\"unit_id\":\"$unit_id\",\"choice\":\"yes\",\"latency_ms\":500}" -w '\n%{http_code}')
code=$(printf '%s' "$resp" | tail -1)
body=$(printf '%s' "$resp" | sed '$d')
[[ "$code" == "429" ]] && ok "fast submit → 429" || fail "expected 429, got $code body=$body"
echo "$body" | grep -q 'too_fast' && ok "error: too_fast" || fail "no too_fast in body"

echo "== valid submit (with engagement) =="
sleep 3
submit=$(curl -sS -X POST "$BASE/api/judgments" \
  -H "Content-Type: application/json" -H "$AUTH" -H "X-Panel-Site-Key: $KEY" \
  -d "{\"unit_id\":\"$unit_id\",\"choice\":\"yes\",\"latency_ms\":3000,\"behavioral\":{\"mouse_path_summary\":{\"sample_count\":42,\"total_distance_px\":1234,\"avg_speed_px_ms\":0.4,\"direction_changes\":7},\"dwell_ms\":3000,\"focus_events\":1}}")
echo "$submit" | grep -q '"ok":true' && ok "submit ok" || fail "submit failed: $submit"
token=$(printf '%s' "$submit" | jget "['token']")
[[ -n "$token" ]] && ok "attestation token issued" || fail "no token"

echo "== attestation verify =="
v=$(curl -sS -X POST "$BASE/api/verify" -H "Content-Type: application/json" -d "{\"token\":\"$token\"}")
echo "$v" | grep -q '"ok":true' && ok "verify ok" || fail "verify failed: $v"

echo "== verify tamper =="
bad=$(curl -sS -X POST "$BASE/api/verify" -H "Content-Type: application/json" -d "{\"token\":\"${token}AA\"}")
echo "$bad" | grep -q '"ok":false' && ok "tampered → ok:false" || fail "tampered passed!"

echo "== stats =="
curl -sS "$BASE/api/stats" | python3 -m json.tool | head -20 || true

echo
ok "smoke complete"
