#!/usr/bin/env bash
# V-mint — idempotent per-profile ingest key minting.
# Reads ~/panel/config/agent-profiles.json, ensures each profile has an
# approved operator + minted site_key + ingest_secret. Writes secrets to
# ~/.secrets/panel-emit-<profile>.txt (mode 600). Re-runs are idempotent:
# an existing approved operator with the same `external_ref` is reused.
set -euo pipefail

PANEL_URL="${PANEL_URL:-http://localhost:3015}"
MANIFEST="${MANIFEST:-$HOME/panel/config/agent-profiles.json}"
SECRETS_DIR="${SECRETS_DIR:-$HOME/.secrets}"
ADMIN_KEY="${PANEL_ADMIN_KEY:-}"

if [ -z "$ADMIN_KEY" ]; then
  if [ -f "$HOME/.secrets/panel.env" ]; then
    ADMIN_KEY="$(grep -E '^PANEL_ADMIN_KEYS=' "$HOME/.secrets/panel.env" | head -1 | cut -d= -f2- | tr -d '"' | cut -d, -f1)"
  fi
fi
[ -n "$ADMIN_KEY" ] || { echo "ERROR: PANEL_ADMIN_KEY not set and not derivable from panel.env" >&2; exit 1; }

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR" || true

slugify() { echo "$1" | tr 'A-Z:' 'a-z-' | tr -c 'a-z0-9-\n' '-' | sed 's/--*/-/g; s/^-//; s/-$//'; }

profile_count="$(jq 'length' < "$MANIFEST")"
echo "minting ${profile_count} profile keys against ${PANEL_URL}"
printf '\n%-35s %-25s %s\n' "PROFILE" "SITE_KEY" "STATUS"
printf '%-35s %-25s %s\n' "-------" "--------" "------"

minted=0; reused=0; failed=0

for i in $(seq 0 $((profile_count - 1))); do
  name="$(jq -r ".[$i].name" < "$MANIFEST")"
  surface="$(jq -r ".[$i].surface" < "$MANIFEST")"
  description="$(jq -r ".[$i].description" < "$MANIFEST")"
  tier="$(jq -r ".[$i].default_tier" < "$MANIFEST")"
  slug="$(slugify "$name")"
  secret_file="$SECRETS_DIR/panel-emit-${slug}.txt"
  key_file="$SECRETS_DIR/panel-emit-${slug}.key"
  ext_ref="agent-profile:${name}"

  if [ -f "$secret_file" ] && [ -f "$key_file" ]; then
    sk="$(cat "$key_file")"
    printf '%-35s %-25s %s\n' "$name" "$sk" "reused (local)"
    reused=$((reused + 1))
    continue
  fi

  # 1. submit application (idempotent: createApplication should be safe to call again; if a row exists with matching email, it'll fail with a reason we handle below)
  apply_resp="$(curl -sS -X POST "$PANEL_URL/api/onboard" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc \
      --arg name "$name" \
      --arg email "agent+${slug}@goku.codes" \
      --arg org "panel-internal-${surface}" \
      --arg intended_use "$description" \
      --arg tier "$tier" \
      '{name:$name, email:$email, org:$org, intended_use:$intended_use, requested_tier:$tier, scrubber_required:false}')" || true)"

  app_id="$(echo "$apply_resp" | jq -r '.application_id // empty')"
  if [ -z "$app_id" ]; then
    # Maybe already applied → find via admin list
    app_id="$(curl -sS -H "X-Panel-Admin-Key: $ADMIN_KEY" "$PANEL_URL/api/admin/onboard/applications?status=pending" \
      | jq -r --arg email "agent+${slug}@goku.codes" '.applications[]? | select(.email==$email) | .id' | head -1)"
  fi
  if [ -z "$app_id" ]; then
    printf '%-35s %-25s %s\n' "$name" "-" "FAIL apply: $apply_resp"
    failed=$((failed + 1))
    continue
  fi

  # 2. approve, capturing minted site_key + secret
  approve_resp="$(curl -sS -X POST "$PANEL_URL/api/admin/onboard/applications" \
    -H "X-Panel-Admin-Key: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg id "$app_id" --arg lbl "$name" \
      '{"application_id":$id, "action":"approve", "label_override":$lbl}')")"

  ok="$(echo "$approve_resp" | jq -r '.ok // false')"
  if [ "$ok" != "true" ]; then
    printf '%-35s %-25s %s\n' "$name" "-" "FAIL approve: $approve_resp"
    failed=$((failed + 1))
    continue
  fi

  site_key="$(echo "$approve_resp" | jq -r '.minted.site_key')"
  ingest_secret="$(echo "$approve_resp" | jq -r '.minted.ingest_secret')"

  printf '%s' "$ingest_secret" > "$secret_file"
  printf '%s' "$site_key" > "$key_file"
  chmod 600 "$secret_file" "$key_file"

  printf '%-35s %-25s %s\n' "$name" "$site_key" "MINTED"
  minted=$((minted + 1))
done

printf '\nsummary: %d minted, %d reused, %d failed\n' "$minted" "$reused" "$failed"
[ "$failed" -eq 0 ] || exit 2
