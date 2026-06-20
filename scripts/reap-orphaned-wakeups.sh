#!/usr/bin/env bash
#
# reap-orphaned-wakeups.sh — cancel agent_wakeup_requests whose linked issue is
# already done/cancelled (orphaned cruft the live recovery loop never clears).
#
# Background: reapStaleQueuedRuns reaps heartbeat_runs but NOT agent_wakeup_requests,
# so wakeups deferred/queued against an issue that later resolves accumulate forever.
# This drains them using the SAME terminal-status convention the recovery service uses
# when it clears a wakeup on a terminal run (status='cancelled', finished_at, updated_at).
#
# DRY-RUN by default (read-only). Pass --apply to actually cancel.
#
# Scope (orphaned == safe to cancel):
#   - status in (queued, deferred_issue_execution)
#   - linked issue (payload->>'issueId' | 'taskId') has status in (done, cancelled)
# Deliberately LEFT alone: wakeups whose issue is still open (blocked/todo/etc.) and
# wakeups with no linked issue — those may be legitimately waiting.
#
# Usage:
#   scripts/reap-orphaned-wakeups.sh            # dry-run: show what would be cancelled
#   scripts/reap-orphaned-wakeups.sh --apply    # cancel them (transactional)
#
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54329}"
PGUSER="${PGUSER:-paperclip}"
PGDATABASE="${PGDATABASE:-paperclip}"
export PGPASSWORD="${PGPASSWORD:-paperclip}"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1)

ORPHAN_PREDICATE="aw.status IN ('queued','deferred_issue_execution')
  AND EXISTS (
    SELECT 1 FROM issues i
    WHERE i.id::text = COALESCE(aw.payload->>'issueId', aw.payload->>'taskId')
      AND i.status IN ('done','cancelled')
  )"

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

echo "== orphaned wakeups (linked issue done/cancelled) =="
"${PSQL[@]}" -tA -c "
  SELECT i.status AS issue_status, aw.status AS wake_status, count(*)
  FROM agent_wakeup_requests aw
  JOIN issues i ON i.id::text = COALESCE(aw.payload->>'issueId', aw.payload->>'taskId')
  WHERE $ORPHAN_PREDICATE
  GROUP BY 1,2 ORDER BY 3 DESC;"

TOTAL=$("${PSQL[@]}" -tA -c "SELECT count(*) FROM agent_wakeup_requests aw WHERE $ORPHAN_PREDICATE;")
echo "total orphaned: ${TOTAL}"

if [[ "$APPLY" -ne 1 ]]; then
  echo
  echo "DRY-RUN — nothing changed. Re-run with --apply to cancel the ${TOTAL} above."
  exit 0
fi

echo
echo "Applying (transactional)..."
"${PSQL[@]}" -tA -c "
  BEGIN;
  UPDATE agent_wakeup_requests aw
  SET status='cancelled', finished_at=now(), updated_at=now()
  WHERE $ORPHAN_PREDICATE;
  SELECT 'remaining_stale='||count(*) FROM agent_wakeup_requests WHERE status IN ('queued','deferred_issue_execution');
  COMMIT;"
echo "done."
