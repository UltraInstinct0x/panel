#!/usr/bin/env bash
# panel sqlite backup. runs hourly via systemd-user timer.
# uses sqlite3 .backup (online, no locks beyond brief checkpoint).
set -euo pipefail

DB_PATH="${PANEL_DB_PATH:-$HOME/panel/data/panel.db}"
BACKUP_DIR="${PANEL_BACKUP_DIR:-$HOME/panel/data/backups}"
RETENTION_DAYS="${PANEL_BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "panel-backup: db not found at $DB_PATH" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/panel-$STAMP.db"

# online backup via sqlite3 — safe against concurrent writes.
sqlite3 "$DB_PATH" ".backup '$OUT'"

# integrity check on the copy
if ! sqlite3 "$OUT" "PRAGMA integrity_check;" | grep -q '^ok$'; then
  echo "panel-backup: integrity check FAILED on $OUT" >&2
  exit 2
fi

# update latest symlink
ln -sfn "$(basename "$OUT")" "$BACKUP_DIR/latest.db"

# prune older than retention
find "$BACKUP_DIR" -maxdepth 1 -name 'panel-*.db' -type f -mtime "+$RETENTION_DAYS" -delete

echo "panel-backup: ok $OUT ($(du -h "$OUT" | cut -f1))"
