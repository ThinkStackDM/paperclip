#!/usr/bin/env bash
# =============================================================================
# adhoc-sprint.sh — put ONE company into an ad-hoc sprint until <end-time>.
#
# Codifies the manual TSM sprint of 2026-06-21 into a repeatable runbook. It:
#   1. snapshots the company's current activity_window
#   2. extends the window to cover [now .. end]  -> defers session purge to the
#      sprint end (the window only "closes" when we revert)
#   3. drops a sprint-override flag so claude-window-flip keeps the claude
#      CEO + CTO ACTIVE for the whole sprint (no mid-sprint park / swap-over)
#   4. immediately resumes the claude CEO + CTO (so the sprint starts NOW, not
#      on the next hourly flip tick)
#   5. issues a sprint directive to the CEO and wakes CEO + CTO
#   6. schedules a one-shot launchd auto-revert at <end-time> that restores the
#      window, removes the flag, re-runs the flip (re-park), and self-removes
#
# Usage:
#   adhoc-sprint.sh <company> <end-time> [start-time] [--codex-only] [--dry-run]
#     <company>     name | issue-prefix | company-id   (case-insensitive)
#     <end-time>    HH:MM (Europe/Dublin) | midnight | noon | HH
#     [start-time]  HH:MM | now (default)   — a future time schedules the start
#     --codex-only  keep the CEO on its codex sister only (don't wake claude CEO);
#                   use when the Claude sub is tight. Claude CTO still sprints.
#     --dry-run     print the full plan and change NOTHING
#
# Examples:
#   adhoc-sprint.sh "ThinkStack Media" midnight
#   adhoc-sprint.sh TSM 23:30 18:00          # start 18:00, end 23:30
#   adhoc-sprint.sh DP 02:00 now --codex-only
#   adhoc-sprint.sh TSB 04:00 --dry-run
#
# Reverts/cancels: scripts/adhoc-sprint-revert.sh <cid> [--now]
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
PSQL=(/opt/homebrew/bin/psql -h127.0.0.1 -p54329 -U paperclip -d paperclip -tA)
PY="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
mkdir -p "$STATE" "$REPO/.devlogs"

ts() { date '+%F %T'; }
log() { echo "$(ts) $*" | tee -a "$LOG"; }
die() { echo "$(ts) ERROR: $*" | tee -a "$LOG" >&2; exit 1; }
pq() { PGPASSWORD=paperclip "${PSQL[@]}" -c "$1"; }
# board <METHOD> <path> [json]  -> prints body, sets $BOARD_CODE to the HTTP status
board() {
  local out; out="$("$BOARD" "$@" 2>&1)"; BOARD_CODE="$(printf '%s' "$out" | sed -n 's/.*\[HTTP \([0-9]*\)\].*/\1/p' | tail -1)"
  printf '%s' "$out" | sed 's/\[HTTP [0-9]*\]//'
}

# --- args -------------------------------------------------------------------
CODEX_ONLY=0; DRY=0; POS=()
for a in "$@"; do case "$a" in
  --codex-only) CODEX_ONLY=1;; --dry-run) DRY=1;; *) POS+=("$a");;
esac; done
[ "${#POS[@]}" -ge 2 ] || die "usage: adhoc-sprint.sh <company> <end-time> [start-time] [--codex-only] [--dry-run]"
COMPANY_ARG="${POS[0]}"; END_ARG="${POS[1]}"; START_ARG="${POS[2]:-now}"
PFX=""; [ $DRY -eq 1 ] && PFX="DRY would: "

# --- normalise a HH:MM time token -> echoes "HH MM" ------------------------
parse_hm() {
  local t; t="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  case "$t" in midnight) echo "0 0"; return;; noon|midday) echo "12 0"; return;; esac
  local hh mm
  if [[ "$t" == *:* ]]; then hh="${t%%:*}"; mm="${t##*:}"; else hh="$t"; mm=0; fi
  hh=$((10#${hh:-x} + 0)) 2>/dev/null || die "bad time: $1"
  mm=$((10#${mm:-0} + 0)) 2>/dev/null || die "bad time: $1"
  { [ "$hh" -ge 0 ] && [ "$hh" -le 23 ] && [ "$mm" -ge 0 ] && [ "$mm" -le 59 ]; } || die "time out of range: $1"
  echo "$hh $mm"
}
read -r END_HH END_MM <<<"$(parse_hm "$END_ARG")"
END_LABEL="$(printf '%02d:%02d' "$END_HH" "$END_MM")"

# --- resolve company (read) -------------------------------------------------
SQL_ARG="$(printf "%s" "$COMPANY_ARG" | sed "s/'/''/g")"
ROW="$(pq "SELECT id||E'\t'||name||E'\t'||issue_prefix||E'\t'||COALESCE(activity_window::text,'null')
  FROM companies WHERE status<>'archived' AND (
    lower(name)=lower('$SQL_ARG') OR lower(issue_prefix)=lower('$SQL_ARG')
    OR id::text='$SQL_ARG' OR lower(name) LIKE lower('%$SQL_ARG%'))
  ORDER BY (lower(name)=lower('$SQL_ARG')) DESC LIMIT 1;")"
[ -n "$ROW" ] || die "no company matches '$COMPANY_ARG'"
IFS=$'\t' read -r CID NAME PREFIX WIN <<<"$ROW"

# --- already sprinting? -----------------------------------------------------
STATEF="$STATE/$CID.json"
[ -f "$STATEF" ] && die "$NAME already has an ad-hoc sprint in flight ($STATEF). End it first: adhoc-sprint-revert.sh $CID --now"

# --- deferred start? --------------------------------------------------------
NOW_H="$(TZ=Europe/Dublin date +%-H)"; NOW_M="$(TZ=Europe/Dublin date +%-M)"
if [ "$START_ARG" != "now" ]; then
  read -r S_HH S_MM <<<"$(parse_hm "$START_ARG")"
  if [ $((S_HH*60+S_MM)) -gt $((NOW_H*60+NOW_M)) ]; then
    SL="com.thinkstack.adhoc-sprint-start.$CID"
    if [ $DRY -eq 1 ]; then
      echo "${PFX}schedule launchd $SL to START sprint at $(printf '%02d:%02d' "$S_HH" "$S_MM") (ends $END_LABEL); then exit"
      exit 0
    fi
    cat > "$LADIR/$SL.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$SL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SCRIPTS/adhoc-sprint.sh</string><string>$CID</string><string>${END_HH}:${END_MM}</string><string>now</string>$([ $CODEX_ONLY -eq 1 ] && echo '<string>--codex-only</string>')</array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$S_HH</integer><key>Minute</key><integer>$S_MM</integer></dict>
  <key>EnvironmentVariables</key><dict><key>HOME</key><string>$HOME</string></dict>
  <key>StandardOutPath</key><string>$LOG</string><key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PL
    launchctl unload "$LADIR/$SL.plist" 2>/dev/null; launchctl load "$LADIR/$SL.plist"
    log "SCHEDULED start of $NAME sprint at $(printf '%02d:%02d' "$S_HH" "$S_MM") (ends $END_LABEL). Exiting."
    exit 0
  fi
fi

# --- compute sprint window --------------------------------------------------
W_START="$NOW_H"
if [ "$END_MM" -gt 0 ]; then W_END=$(( (END_HH + 1) % 24 )); else W_END="$END_HH"; fi
CLAUDE_CEO=$([ $CODEX_ONLY -eq 1 ] && echo false || echo true)

# --- resolve CEO/CTO agents (read) -----------------------------------------
AGENTS="$(pq "SELECT role||E'\t'||adapter_type||E'\t'||status||E'\t'||name||E'\t'||id
  FROM agents WHERE company_id='$CID' AND role IN ('ceo','cto') AND status<>'terminated'
    AND adapter_type IN ('claude_local','codex_local');")"
CEO_CODEX=; CEO_CLAUDE=; CEO_CLAUDE_ST=; CTO_CLAUDE=; CTO_CLAUDE_ST=; CTO_CODEX=
CEO_CODEX_N=; CEO_CLAUDE_N=; CTO_CLAUDE_N=; CTO_CODEX_N=
while IFS=$'\t' read -r role adapter status name aid; do
  [ -n "$aid" ] || continue
  case "$role/$adapter" in
    ceo/codex_local) [[ "$name" == *-Codex ]] && { CEO_CODEX="$aid"; CEO_CODEX_N="$name"; };;
    ceo/claude_local) [[ "$name" != *-Codex && "$name" != *-Hermes && "$name" != *-Grok ]] && { CEO_CLAUDE="$aid"; CEO_CLAUDE_ST="$status"; CEO_CLAUDE_N="$name"; };;
    cto/codex_local) [[ "$name" == *-Codex ]] && { CTO_CODEX="$aid"; CTO_CODEX_N="$name"; };;
    cto/claude_local) [[ "$name" != *-Codex && "$name" != *-Hermes && "$name" != *-Grok ]] && { CTO_CLAUDE="$aid"; CTO_CLAUDE_ST="$status"; CTO_CLAUDE_N="$name"; };;
  esac
done <<<"$AGENTS"
ASSIGNEE="${CEO_CODEX:-$CEO_CLAUDE}"; ASSIGNEE_N="${CEO_CODEX_N:-$CEO_CLAUDE_N}"

# --- plan summary -----------------------------------------------------------
echo "──────────────────────────────────────────────────────────────"
echo " Ad-hoc sprint plan${DRY:+ (DRY RUN — no changes)}"
echo "   company    : $NAME ($PREFIX)  $CID"
echo "   ends       : $END_LABEL Europe/Dublin   (auto-revert armed)"
echo "   window     : $([ "$WIN" = null ] && echo "always-on (unchanged)" || echo "${WIN} -> ${W_START}-${W_END}")"
echo "   claude CEO : $([ "$CLAUDE_CEO" = true ] && echo "ACTIVE (${CEO_CLAUDE_N:-none})" || echo "parked (codex-only)")  | claude CTO: ACTIVE (${CTO_CLAUDE_N:-none})"
echo "   directive  : -> ${ASSIGNEE_N:-<unassigned>}"
echo "   wake       : ${ASSIGNEE_N:-—} ${CTO_CLAUDE_N:+, $CTO_CLAUDE_N} ${CTO_CODEX_N:+, $CTO_CODEX_N}"
echo "──────────────────────────────────────────────────────────────"
if [ $DRY -eq 1 ]; then echo "DRY RUN complete — nothing changed."; exit 0; fi

# ====================== MUTATIONS BELOW THIS LINE ===========================
log "company: $NAME ($PREFIX) $CID  current window=$WIN"

REVERT_PLIST="com.thinkstack.adhoc-sprint-revert.$CID"
jq -n --arg cid "$CID" --arg name "$NAME" --arg prefix "$PREFIX" \
  --argjson endHH "$END_HH" --argjson endMM "$END_MM" \
  --argjson wStart "$W_START" --argjson wEnd "$W_END" \
  --argjson claudeCeo "$CLAUDE_CEO" --arg revertPlist "$REVERT_PLIST" \
  --argjson orig "$WIN" --arg startedAt "$(date -u +%FT%TZ)" \
  '{cid:$cid,name:$name,prefix:$prefix,endHH:$endHH,endMM:$endMM,windowStartHour:$wStart,windowEndHour:$wEnd,claudeCeo:$claudeCeo,revertPlist:$revertPlist,originalWindow:$orig,startedAt:$startedAt}' \
  > "$STATEF"
log "state -> $STATEF  (override: claudeCEO=$CLAUDE_CEO)"

# extend the activity window (skip for always-on / null-window companies)
if [ "$WIN" != "null" ]; then
  PURGE="$(echo "$WIN" | jq -r '.sessionPurgeOnClose // true')"
  WBODY="$(jq -n --argjson s "$W_START" --argjson e "$W_END" --argjson p "$PURGE" \
    '{window:{startHour:$s,endHour:$e,timezone:"Europe/Dublin",sessionPurgeOnClose:$p}}')"
  board PATCH "/companies/$CID/activity-window" "$WBODY" >/dev/null
  log "window extended -> ${W_START}-${W_END} (HTTP ${BOARD_CODE:-?})"
else
  log "window: company is always-on (null) — left unchanged"
fi

# resume the claude sprint lanes NOW (don't wait for the hourly flip)
if [ "$CLAUDE_CEO" = true ] && [ -n "$CEO_CLAUDE" ] && [ "$CEO_CLAUDE_ST" = paused ]; then
  board POST "/agents/$CEO_CLAUDE/resume" '{"reason":"ad-hoc sprint: claude CEO active"}' >/dev/null
  log "resumed claude CEO $CEO_CLAUDE_N (HTTP ${BOARD_CODE:-?})"
fi
if [ -n "$CTO_CLAUDE" ] && [ "$CTO_CLAUDE_ST" = paused ]; then
  board POST "/agents/$CTO_CLAUDE/resume" '{"reason":"ad-hoc sprint: claude CTO active"}' >/dev/null
  log "resumed claude CTO $CTO_CLAUDE_N (HTTP ${BOARD_CODE:-?})"
fi

# issue the sprint directive to the CEO
TITLE="Ad-hoc sprint — push hard until ${END_LABEL} (Europe/Dublin)"
DESC="$(cat <<EOF
Ad-hoc sprint is ENABLED for $NAME until ${END_LABEL} Europe/Dublin.

Operating conditions for this window:
- Your activity window is extended to cover the whole sprint (no off-window run-gating, no session purge until the sprint ends).
- The claude CTO$([ "$CLAUDE_CEO" = true ] && echo " and claude CEO") lane(s) are active for the duration — extra horsepower is available, hour-boundary swap-overs are paused.
- Session limits are healthy. Use the session wisely and make the most of it.

What to do:
1. Plan the highest-value work that fits before ${END_LABEL} (e.g. videos/renders to produce, backlog to clear, decisions to unblock). Lay it out as concrete issues.
2. Delegate across the team and drive it to completion. Coordinate with your CTO.
3. Wrap up and hand off cleanly before ${END_LABEL}: land or checkpoint open work, no half-finished long-runners — when the window reverts, normal model swap-overs resume and off-window runs are deferred.
EOF
)"
IBODY="$(jq -n --arg t "$TITLE" --arg d "$DESC" --arg a "$ASSIGNEE" \
  '{title:$t,description:$d,priority:"high"} + (if $a=="" then {} else {assigneeAgentId:$a} end)')"
IOUT="$(board POST "/companies/$CID/issues" "$IBODY")"
IDENT="$(echo "$IOUT" | jq -r '.identifier // empty' 2>/dev/null)"
log "directive: ${IDENT:-FAILED} -> assignee ${ASSIGNEE_N:-none} (HTTP ${BOARD_CODE:-?})"
[ -n "$IDENT" ] && { jq --arg id "$IDENT" '. + {directive:$id}' "$STATEF" > "$STATEF.tmp" && mv "$STATEF.tmp" "$STATEF"; }

# wake CEO + CTO
for waid in "$ASSIGNEE" "$CTO_CLAUDE" "$CTO_CODEX"; do
  [ -n "$waid" ] || continue
  board POST "/agents/$waid/wakeup" '{"reason":"ad-hoc sprint kickoff"}' >/dev/null
  log "woke agent $waid (HTTP ${BOARD_CODE:-?})"
done

# schedule the auto-revert
cat > "$LADIR/$REVERT_PLIST.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$REVERT_PLIST</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SCRIPTS/adhoc-sprint-revert.sh</string><string>$CID</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$END_HH</integer><key>Minute</key><integer>$END_MM</integer></dict>
  <key>EnvironmentVariables</key><dict><key>HOME</key><string>$HOME</string></dict>
  <key>StandardOutPath</key><string>$LOG</string><key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PL
launchctl unload "$LADIR/$REVERT_PLIST.plist" 2>/dev/null; launchctl load "$LADIR/$REVERT_PLIST.plist"
log "auto-revert scheduled for ${END_LABEL} (launchd: $REVERT_PLIST)"

# reconcile the flip now so the override takes effect immediately
"$PY" "$FLIP" --apply >>"$LOG" 2>&1 || python3 "$FLIP" --apply >>"$LOG" 2>&1 || true

log "=== SPRINT LIVE: $NAME until ${END_LABEL} ==="
echo "OK: $NAME ($PREFIX) sprinting until ${END_LABEL}. Directive=${IDENT:-none}. Auto-revert armed."

# refresh TSBC power mode immediately (ad-hoc sprints trigger TSBC low-power)
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 /Users/glad0s/paperclip/benchmark/tsbc-power.py >/dev/null 2>&1 || true
