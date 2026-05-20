#!/usr/bin/env bash
# panel-review-check.sh — GitHub Action gate for skill-diff rater review.
#
# usage:
#   PANEL_URL=https://panel.goku.codes \
#   UNIT_ID=u_ing_abc... \
#   TIMEOUT=300 \
#   ./panel-review-check.sh
#
# exit codes (GitHub Action friendly):
#   0  approved — merge allowed
#   1  rejected — block merge
#   78 pending — neutral / non-blocking (re-run later)
set -euo pipefail

PANEL_URL="${PANEL_URL:-https://panel.goku.codes}"
UNIT_ID="${UNIT_ID:?UNIT_ID env required}"
TIMEOUT="${TIMEOUT:-0}"      # seconds; 0 = check once and exit
INTERVAL="${INTERVAL:-30}"   # poll interval seconds

start=$(date +%s)
attempt=0
while :; do
  attempt=$((attempt + 1))
  resp="$(curl -fsS "${PANEL_URL}/api/v1/skill-review/${UNIT_ID}" || true)"
  if [ -z "$resp" ]; then
    echo "panel-review: no response from ${PANEL_URL}/api/v1/skill-review/${UNIT_ID}" >&2
    exit 78
  fi

  status="$(printf '%s' "$resp" | jq -r '.status // "error"')"
  n="$(printf '%s' "$resp" | jq -r '.n // 0')"
  consensus="$(printf '%s' "$resp" | jq -r '.consensus // 0')"

  echo "panel-review[#${attempt}]: status=${status} n=${n} consensus=${consensus} unit=${UNIT_ID}"

  case "$status" in
    approved)
      echo "panel-review: ✅ approved (${consensus}, n=${n})"
      echo "panel-review: verdict ${PANEL_URL}/review/${UNIT_ID}"
      exit 0
      ;;
    rejected)
      echo "panel-review: ❌ rejected (${consensus}, n=${n})"
      echo "panel-review: verdict ${PANEL_URL}/review/${UNIT_ID}"
      exit 1
      ;;
    no_consensus)
      echo "panel-review: ⚠️  no consensus (n=${n}). blocking."
      echo "panel-review: verdict ${PANEL_URL}/review/${UNIT_ID}"
      exit 1
      ;;
    pending|error)
      now=$(date +%s)
      elapsed=$((now - start))
      if [ "$TIMEOUT" -eq 0 ] || [ "$elapsed" -ge "$TIMEOUT" ]; then
        echo "panel-review: ⏳ pending after ${elapsed}s (n=${n}/min). neutral exit."
        echo "panel-review: verdict ${PANEL_URL}/review/${UNIT_ID}"
        exit 78
      fi
      sleep "$INTERVAL"
      ;;
    *)
      echo "panel-review: unknown status=${status}" >&2
      echo "$resp" >&2
      exit 78
      ;;
  esac
done
