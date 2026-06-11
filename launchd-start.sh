#!/usr/bin/env bash
# launchd entrypoint for the SOURCE Paperclip server. Unlike start-source.sh
# (manual use: backgrounds + returns), this stays in the FOREGROUND via `exec`
# so launchd owns the long-running server process and KeepAlive works. A script
# that backgrounds the server and exits would make launchd reap the whole group.
set -uo pipefail
export PATH="/Users/glad0s/.nvm/versions/node/v20.20.2/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PAPERCLIP_UI_DEV_MIDDLEWARE=true
ROOT="$HOME/paperclip"
cd "$ROOT"

# Stop any published-package instance and free the port before we take over.
pkill -f "paperclipai run" 2>/dev/null || true
for sig in TERM KILL; do
  PID=$(lsof -tiTCP:3100 -sTCP:LISTEN 2>/dev/null || true)
  [ -z "$PID" ] && break
  kill -"$sig" $PID 2>/dev/null || true
  sleep 2
done

# Foreground: launchd manages this process directly (KeepAlive restarts it).
exec pnpm dev
