#!/bin/bash
# One-shot driver for the agentic Gemini skill-eval (cv-review/book-chapter/content × flash/flash-low).
# Waits for the TSBC power pause to clear (respects the operator's instance-upgrade pause), then runs
# the eval role-by-role, serial. Caps the wait so it never blocks forever. Measurement-only; honors the
# same .tsbc-power.json gate the bench scripts use (1 worker at LOW).
set -u
cd /Users/glad0s/paperclip/benchmark
LOG="$1"
MAX_WAIT_TRIES=40   # 40 * 90s = 60 min cap
SLEEP_SECS=90

paused() {
  python3 - <<'PY'
import json,sys
try:
    print("1" if json.load(open(".tsbc-power.json")).get("paused") else "0")
except Exception:
    print("1")  # mid-write / unreadable -> treat as paused, retry
PY
}

{
  echo "=== AGENTIC GEMINI SKILL-EVAL (driver) — $(date) ==="
  tries=0
  while [ "$(paused)" = "1" ]; do
    tries=$((tries+1))
    if [ "$tries" -gt "$MAX_WAIT_TRIES" ]; then
      echo "BLOCKED: TSBC still paused after $((MAX_WAIT_TRIES*SLEEP_SECS/60)) min — giving up cleanly."
      echo "reason: $(python3 -c 'import json;print(json.load(open(".tsbc-power.json")).get("reason"))' 2>/dev/null)"
      echo "=== DRIVER EXIT (blocked) $(date) ==="
      exit 7
    fi
    echo "[$(date +%H:%M:%S)] TSBC paused (try $tries/$MAX_WAIT_TRIES) — reason: $(python3 -c 'import json;print(json.load(open(".tsbc-power.json")).get("reason"))' 2>/dev/null); sleeping ${SLEEP_SECS}s"
    sleep "$SLEEP_SECS"
  done
  echo "[$(date +%H:%M:%S)] TSBC un-paused — starting eval."

  for role in cv-review book-chapter content; do
    echo; echo ">>>>>> ROLE: $role  $(date +%H:%M:%S) <<<<<<"
    python3 variants_agentic.py --roles "$role" \
       --models gemini-flash,gemini-flash-low \
       --max-tasks-per-role 5 \
       --cells current:none,current:all 2>&1
    rc=$?
    echo ">>>>>> ROLE $role DONE rc=$rc  $(date +%H:%M:%S) <<<<<<"
    # if TSBC got re-paused mid-eval, stop and report rather than spin through no-op roles
    if [ "$(paused)" = "1" ]; then
      echo "NOTE: TSBC re-paused after role=$role — stopping; completed roles are recorded."
      break
    fi
  done
  echo "=== ALL DONE $(date) ==="
} >> "$LOG" 2>&1
