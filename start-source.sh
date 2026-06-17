#!/usr/bin/env bash
# Start the SOURCE Paperclip instance from ~/paperclip (NOT the published
# `paperclipai` npm package). Use this after a reboot/crash instead of
# `paperclipai run` — the published package serves stock UI/code and ignores
# all of your local edits, sprint windows, prefixes and the portfolio dashboard.
set -euo pipefail
ROOT="$HOME/paperclip"
cd "$ROOT"

# Adapters spawn CLIs (codex, claude, grok, hermes, agy, gemini) by name, so the
# server needs the full login-shell PATH (codex is in the Codex.app bundle,
# claude/grok/hermes/agy in ~/.local|.grok/bin). Inherit it explicitly in case
# this is run from a minimal environment.
LOGIN_PATH="$(/bin/zsh -lic 'printf %s "$PATH"' 2>/dev/null)"
[ -n "$LOGIN_PATH" ] && export PATH="$LOGIN_PATH"

# DB-SPOF (TSMC-10411): point at the standalone Postgres supervisor
# (ie.thinkstack.paperclip-postgres) by default so a manual launch never falls
# back to in-process embedded-postgres mode on the shared data dir. The launchd
# service-mode launcher (launchd-start.sh) sets the same default.
export DATABASE_URL="${DATABASE_URL:-postgres://paperclip:paperclip@127.0.0.1:54329/paperclip}"

echo "[start-source] stopping any published 'paperclipai run' instance..."
pkill -f "paperclipai run" 2>/dev/null || true
pkill -f "scripts/dev-runner.ts" 2>/dev/null || true
pkill -f "tsx/dist/cli.mjs watch.*src/index.ts" 2>/dev/null || true

# Free port 3100 if a stale listener lingers (escalate to -9).
for sig in TERM KILL; do
  PID=$(lsof -tiTCP:3100 -sTCP:LISTEN 2>/dev/null || true)
  [ -z "$PID" ] && break
  echo "[start-source] freeing port 3100 (kill -$sig $PID)"
  kill -"$sig" $PID 2>/dev/null || true
  sleep 2
done

mkdir -p "$ROOT/.devlogs"
LOG="$ROOT/.devlogs/dev-$(date +%Y%m%d-%H%M%S).log"
echo "[start-source] launching source dev server (log: $LOG)"
PAPERCLIP_UI_DEV_MIDDLEWARE=true nohup pnpm dev > "$LOG" 2>&1 &
echo "[start-source] supervisor pid $!"

echo -n "[start-source] waiting for http://127.0.0.1:3100 "
for i in $(seq 1 30); do
  if curl -s --max-time 4 http://127.0.0.1:3100/api/companies -o /dev/null; then
    echo " UP"
    echo "[start-source] ready. Hard-refresh your browser (Cmd+Shift+R) to drop any stale assets."
    exit 0
  fi
  echo -n "."; sleep 4
done
echo " (not up yet — check $LOG)"
exit 1
