#!/usr/bin/env bash
# Foreground entrypoint for the default Paperclip Postgres service.
# launchd owns this script, and this script execs postgres so the DB lifecycle is
# independent of source-server reloads.
set -euo pipefail

ROOT="${PAPERCLIP_SOURCE_ROOT:-$HOME/paperclip}"
PGDATA="${PAPERCLIP_POSTGRES_DATA_DIR:-$HOME/.paperclip/instances/default/db}"
PGPORT="${PAPERCLIP_POSTGRES_PORT:-54329}"
PGBIN_DIR="${PAPERCLIP_EMBEDDED_POSTGRES_BIN_DIR:-$ROOT/node_modules/.pnpm/@embedded-postgres+darwin-arm64@18.1.0-beta.16/node_modules/@embedded-postgres/darwin-arm64/native/bin}"
LOG_DIR="${PAPERCLIP_POSTGRES_LOG_DIR:-$ROOT/.devlogs}"
POSTGRES="$PGBIN_DIR/postgres"
INITDB="$PGBIN_DIR/initdb"
PGPIDFILE="$PGDATA/postmaster.pid"

log() { echo "[paperclip-postgres $(date '+%H:%M:%S')] $*" >&2; }

if [ ! -x "$POSTGRES" ] || [ ! -x "$INITDB" ]; then
  log "missing embedded-postgres binaries in $PGBIN_DIR"
  exit 1
fi

mkdir -p "$PGDATA" "$LOG_DIR"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  pwfile="$(mktemp "${TMPDIR:-/tmp}/paperclip-postgres-pw.XXXXXX")"
  trap 'rm -f "$pwfile"' EXIT
  printf '%s\n' "paperclip" > "$pwfile"
  log "initializing postgres data dir $PGDATA"
  "$INITDB" -D "$PGDATA" --username=paperclip --pwfile="$pwfile" --encoding=UTF8 --locale=C --lc-messages=C
  rm -f "$pwfile"
  trap - EXIT
fi

if [ -f "$PGPIDFILE" ]; then
  pg_pid="$(head -1 "$PGPIDFILE" 2>/dev/null | tr -dc '0-9')"
  if [ -n "$pg_pid" ] && kill -0 "$pg_pid" 2>/dev/null; then
    log "postmaster already running at pid $pg_pid; waiting to take over after it exits"
    while kill -0 "$pg_pid" 2>/dev/null; do
      sleep 2
    done
  fi
  pg_pid2="$(head -1 "$PGPIDFILE" 2>/dev/null | tr -dc '0-9')"
  if [ -z "$pg_pid2" ] || ! kill -0 "$pg_pid2" 2>/dev/null; then
    rm -f "$PGPIDFILE"
  fi
fi

log "starting postgres on port $PGPORT with data dir $PGDATA"
exec "$POSTGRES" -D "$PGDATA" -p "$PGPORT" -c "shared_buffers=${PAPERCLIP_PG_SHARED_BUFFERS:-512MB}"
