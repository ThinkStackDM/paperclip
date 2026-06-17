#!/usr/bin/env bash
# Install and bootstrap the standalone Paperclip Postgres LaunchAgent.
set -euo pipefail

LABEL="${PAPERCLIP_POSTGRES_LAUNCHD_LABEL:-ie.thinkstack.paperclip-postgres}"
ROOT="${PAPERCLIP_SOURCE_ROOT:-$HOME/paperclip}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$ROOT/.devlogs"
START_SCRIPT="$ROOT/scripts/paperclip-postgres-start.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
chmod +x "$START_SCRIPT"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$START_SCRIPT</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/postgres-launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/postgres-launchd.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/glad0s/.nvm/versions/node/v20.20.2/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PAPERCLIP_SOURCE_ROOT</key>
    <string>$ROOT</string>
  </dict>
</dict>
</plist>
PLIST

uid="$(id -u)"
launchctl bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$uid" "$PLIST"
launchctl enable "gui/$uid/$LABEL"
launchctl kickstart -k "gui/$uid/$LABEL"

echo "Installed $LABEL at $PLIST"
