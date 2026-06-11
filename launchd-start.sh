#!/usr/bin/env bash
# launchd entrypoint for the SOURCE Paperclip server. Unlike start-source.sh
# (manual use: backgrounds + returns), this stays in the FOREGROUND via `exec`
# so launchd owns the long-running server process and KeepAlive works. A script
# that backgrounds the server and exits would make launchd reap the whole group.
set -uo pipefail
# Adapters spawn CLIs (codex, claude, grok, hermes, agy, gemini) BY NAME, so the
# server needs the full login-shell PATH — codex lives in the Codex.app bundle and
# claude/grok/hermes/agy in ~/.local|.grok/bin, none of which are in a minimal PATH.
# Derive it from an interactive login shell so it tracks future installs; fall back
# to an explicit list of the known CLI dirs.
LOGIN_PATH="$(/bin/zsh -lic 'printf %s "$PATH"' 2>/dev/null)"
if [ -n "$LOGIN_PATH" ]; then
  export PATH="$LOGIN_PATH"
else
  export PATH="/Users/glad0s/.grok/bin:/Users/glad0s/.local/bin:/Users/glad0s/.nvm/versions/node/v20.20.2/bin:/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
fi
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
