#!/usr/bin/env bash
# =============================================================================
# adhoc-sprint-revert.sh <cid> [--now]
#
# Ends an ad-hoc sprint started by adhoc-sprint.sh. Reads the sprint state file,
# restores the company's original activity_window, removes the sprint-override
# flag, re-runs claude-window-flip (re-park the claude CEO per normal policy),
# and self-removes its own launchd job. Idempotent — safe to run twice / by hand.
#
# Called automatically by the per-sprint launchd revert job at the end time, or
# manually with --now to end a sprint early.
# =============================================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO=/Users/glad0s/paperclip
SCRIPTS="$REPO/scripts"
STATE="$SCRIPTS/.adhoc-sprint"
LADIR="$HOME/Library/LaunchAgents"
LOG="$REPO/.devlogs/adhoc-sprint.log"
FLIP="$SCRIPTS/claude-window-flip.py"
BOARD="$HOME/.claude/board-api.sh"
ts() { date '+%F %T'; }
log() { echo "$(ts) [revert] $*" | tee -a "$LOG"; }

CID="${1:?usage: adhoc-sprint-revert.sh <cid> [--now]}"
STATEF="$STATE/$CID.json"

if [ -f "$STATEF" ]; then
  NAME="$(jq -r '.name // .cid' "$STATEF")"
  ORIG="$(jq -c '.originalWindow' "$STATEF")"
  REVERT_PLIST="$(jq -r '.revertPlist // empty' "$STATEF")"
else
  NAME="$CID"; ORIG="null"; REVERT_PLIST="com.thinkstack.adhoc-sprint-revert.$CID"
  log "no state file for $CID — cleaning up only"
fi

# --- restore the original activity window (skip if it was always-on/null) ----
if [ "$ORIG" != "null" ] && [ -n "$ORIG" ]; then
  "$BOARD" PATCH "/companies/$CID/activity-window" "$(jq -nc --argjson w "$ORIG" '{window:$w}')" >>"$LOG" 2>&1
  log "$NAME window restored -> $ORIG"
else
  log "$NAME had no window snapshot (always-on) — nothing to restore"
fi

# --- drop the sprint-override flag so the flip re-parks the claude CEO -------
rm -f "$STATEF"
log "override flag cleared"

# --- reconcile the flip immediately ----------------------------------------
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 "$FLIP" --apply >>"$LOG" 2>&1 \
  || python3 "$FLIP" --apply >>"$LOG" 2>&1 || true
log "flip reconciled"

# --- self-remove the launchd revert job ------------------------------------
if [ -n "$REVERT_PLIST" ] && [ -f "$LADIR/$REVERT_PLIST.plist" ]; then
  launchctl unload "$LADIR/$REVERT_PLIST.plist" 2>/dev/null
  rm -f "$LADIR/$REVERT_PLIST.plist"
  log "removed launchd job $REVERT_PLIST"
fi
log "=== sprint ended for $NAME ==="
echo "OK: ad-hoc sprint ended for $NAME"

# refresh TSBC power mode immediately (ad-hoc sprints trigger TSBC low-power)
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 /Users/glad0s/paperclip/benchmark/tsbc-power.py >/dev/null 2>&1 || true
