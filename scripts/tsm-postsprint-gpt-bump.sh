#!/usr/bin/env bash
# ONE-SHOT: after the TSM ad-hoc sprint reverts (~00:05), bump TSM's remaining
# gpt-5.5 codex agents (Coder-Codex, ContentStrategist-Codex, Showrunner) to
# gpt-5.4 — finishing the fleet-wide bump of 2026-06-21 (the other 17 were done
# live; these 3 were held to avoid perturbing the active sprint). Self-removes.
#
# Plain `--apply` catches exactly these 3: the script excludes the Agentic Bench
# company (Bench-gpt-5.5 stays), and they are the only other gpt-5.5 agents left.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd /Users/glad0s/paperclip/benchmark || exit 1
LOG=/Users/glad0s/paperclip/.devlogs/tsm-gpt-bump.log
PLIST="$HOME/Library/LaunchAgents/com.thinkstack.tsm-gpt-bump.plist"

# preserve the 17-agent rollback snapshot before upgrade_model.py overwrites it
[ -f rollback-gpt-5.5-to-gpt-5.4.json ] && cp rollback-gpt-5.5-to-gpt-5.4.json rollback-gpt-5.5-to-gpt-5.4.17agents.json
echo "=== TSM post-sprint gpt-5.5 -> gpt-5.4 bump $(date) ===" >> "$LOG"
python3 upgrade_model.py gpt-5.5 gpt-5.4 --apply >> "$LOG" 2>&1
echo "--- done $(date) ---" >> "$LOG"

launchctl unload "$PLIST" 2>/dev/null
rm -f "$PLIST"
