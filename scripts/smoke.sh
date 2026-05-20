#!/usr/bin/env bash
# smoke test — exercises core acceptance criteria. assumes panel.goku.codes is live.
set -euo pipefail

BASE="${PANEL_BASE:-https://panel.goku.codes}"
KEY="${PANEL_KEY:-pk_demo_a}"
RID="smoke_$(date +%s)"

ok() { printf "  \033[32mok\033[0m %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

echo "== routes =="
for p in / /demo/gate /widget /dashboard /operator /embed; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$p")
  [[ "$code" == "200" ]] && ok "$p $code" || fail "$p got $code"
done

echo "== site-key gate =="
code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/units/next?rater_id=$RID&pool=public")
[[ "$code" == "401" ]] && ok "missing site-key → 401" || fail "expected 401, got $code"

echo "== pool separation =="
pool=$(curl -sS -H "X-Panel-Site-Key: $KEY" "$BASE/api/units/next?rater_id=$RID&pool=public" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pool"))')
[[ "$pool" == "public" ]] && ok "public pool returned" || fail "expected public, got $pool"

echo "== technical pool denied to anon =="
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "X-Panel-Site-Key: $KEY" "$BASE/api/units/next?rater_id=$RID&pool=technical")
[[ "$code" == "403" ]] && ok "anon → technical → 403" || fail "expected 403, got $code"

echo "== engagement window =="
unit_id=$(curl -sS -H "X-Panel-Site-Key: $KEY" "$BASE/api/units/next?rater_id=$RID&pool=public" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
resp=$(curl -sS -X POST "$BASE/api/judgments" \
  -H "Content-Type: application/json" -H "X-Panel-Site-Key: $KEY" \
  -d "{\"unit_id\":\"$unit_id\",\"rater_id\":\"$RID\",\"choice\":\"yes\",\"latency_ms\":500}" -w '\n%{http_code}')
code=$(printf '%s' "$resp" | tail -1)
body=$(printf '%s' "$resp" | sed '$d')
[[ "$code" == "429" ]] && ok "fast submit → 429" || fail "expected 429, got $code"
echo "$body" | grep -q 'too_fast' && ok "error: too_fast" || fail "no too_fast"

echo "== valid submit (with engagement) =="
sleep 3
resp=$(curl -sS -X POST "$BASE/api/judgments" \
  -H "Content-Type: application/json" -H "X-Panel-Site-Key: $KEY" \
  -d "{\"unit_id\":\"$unit_id\",\"rater_id\":\"$RID\",\"choice\":\"yes\",\"latency_ms\":3000,\"behavioral\":{\"mouse_path_summary\":{\"sample_count\":42,\"total_distance_px\":1234,\"avg_speed_px_ms\":0.4,\"direction_changes\":7},\"dwell_ms\":3000,\"focus_events\":1}}")
echo "$resp" | grep -q '"ok":true' && ok "submit ok" || fail "submit failed: $resp"
token=$(printf '%s' "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
echo "  token: $token"

echo "== attestation verify =="
v=$(curl -sS -X POST "$BASE/api/verify" -H "Content-Type: application/json" -d "{\"token\":\"$token\"}")
echo "$v" | grep -q '"ok":true' && ok "verify ok" || fail "verify failed: $v"

echo "== verify tamper =="
bad=$(curl -sS -X POST "$BASE/api/verify" -H "Content-Type: application/json" -d "{\"token\":\"${token}AA\"}")
echo "$bad" | grep -q '"ok":false' && ok "tampered → ok:false" || fail "tampered passed!"

echo "== stats =="
curl -sS "$BASE/api/stats" | python3 -m json.tool | head -20

echo
echo "all checks passed."
