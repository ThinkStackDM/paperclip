#!/usr/bin/env bash
#
# paperclip-backlog-sanity.sh - read-only fleet hygiene audit.
#
# Checks the three Paperclip backlog states that most often strand work:
#   1. todo/backlog issues with active blockers
#   2. non-terminal issues with no owner
#   3. non-terminal issues assigned to paused agents
#
# Usage:
#   scripts/paperclip-backlog-sanity.sh
#   scripts/paperclip-backlog-sanity.sh --fail-on-findings
#
# Scope defaults to the current portfolio prefixes. Override with:
#   PAPERCLIP_SANITY_PREFIXES=TSMC,TSBC scripts/paperclip-backlog-sanity.sh

set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54329}"
PGUSER="${PGUSER:-paperclip}"
PGDATABASE="${PGDATABASE:-paperclip}"
export PGPASSWORD="${PGPASSWORD:-paperclip}"

PREFIXES="${PAPERCLIP_SANITY_PREFIXES:-TSMC,TSC,TSM,TSB,TSR,DP,TSK,TSBC}"
FAIL_ON_FINDINGS=0

if [[ ! "$PREFIXES" =~ ^[A-Z0-9_,]+$ ]]; then
  echo "PAPERCLIP_SANITY_PREFIXES may only contain uppercase letters, numbers, commas, and underscores." >&2
  exit 64
fi

if [[ "${1:-}" == "--fail-on-findings" ]]; then
  FAIL_ON_FINDINGS=1
elif [[ -n "${1:-}" ]]; then
  echo "Unknown argument: $1" >&2
  exit 64
fi

PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -P pager=off)

COMMON_CTE="
WITH open_issues AS (
  SELECT i.*, c.issue_prefix
  FROM issues i
  JOIN companies c ON c.id = i.company_id
  WHERE i.status NOT IN ('done', 'cancelled')
    AND c.issue_prefix = ANY (string_to_array('$PREFIXES', ',')::text[])
),
active_blocked AS (
  SELECT DISTINCT child.id
  FROM open_issues child
  JOIN issue_relations r ON r.related_issue_id = child.id AND r.type = 'blocks'
  JOIN issues blocker ON blocker.id = r.issue_id
  WHERE blocker.status NOT IN ('done', 'cancelled')
)
"

echo "== Paperclip backlog sanity =="
echo "prefixes: $PREFIXES"
echo

"${PSQL[@]}" -c "$COMMON_CTE
SELECT
  issue_prefix,
  count(*) FILTER (
    WHERE status IN ('todo', 'backlog') AND id IN (SELECT id FROM active_blocked)
  ) AS todo_backlog_with_active_blockers,
  count(*) FILTER (
    WHERE assignee_agent_id IS NULL AND assignee_user_id IS NULL
  ) AS no_owner,
  count(*) FILTER (
    WHERE assignee_agent_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM agents a
        WHERE a.id = open_issues.assignee_agent_id
          AND a.status = 'paused'
      )
  ) AS paused_assignee,
  count(*) AS open_count
FROM open_issues
GROUP BY issue_prefix
ORDER BY issue_prefix;"

echo
echo "== todo/backlog with active blockers =="
"${PSQL[@]}" -c "$COMMON_CTE
SELECT issue_prefix, identifier, status, title
FROM open_issues
WHERE status IN ('todo', 'backlog')
  AND id IN (SELECT id FROM active_blocked)
ORDER BY issue_prefix, identifier
LIMIT 100;"

echo
echo "== no owner =="
"${PSQL[@]}" -c "$COMMON_CTE
SELECT issue_prefix, identifier, status, title
FROM open_issues
WHERE assignee_agent_id IS NULL
  AND assignee_user_id IS NULL
ORDER BY issue_prefix, identifier
LIMIT 100;"

echo
echo "== paused assignee =="
"${PSQL[@]}" -c "$COMMON_CTE
SELECT
  open_issues.issue_prefix,
  open_issues.identifier,
  open_issues.status,
  agents.name AS paused_agent,
  open_issues.title
FROM open_issues
JOIN agents ON agents.id = open_issues.assignee_agent_id
WHERE agents.status = 'paused'
ORDER BY open_issues.issue_prefix, open_issues.identifier
LIMIT 100;"

TOTAL_FINDINGS="$("${PSQL[@]}" -tA -c "$COMMON_CTE
SELECT
  (
    SELECT count(*)
    FROM open_issues
    WHERE status IN ('todo', 'backlog')
      AND id IN (SELECT id FROM active_blocked)
  )
  + (
    SELECT count(*)
    FROM open_issues
    WHERE assignee_agent_id IS NULL
      AND assignee_user_id IS NULL
  )
  + (
    SELECT count(*)
    FROM open_issues
    JOIN agents ON agents.id = open_issues.assignee_agent_id
    WHERE agents.status = 'paused'
  ) AS total_findings;")"

echo
echo "total findings: $TOTAL_FINDINGS"

if [[ "$FAIL_ON_FINDINGS" -eq 1 && "$TOTAL_FINDINGS" -ne 0 ]]; then
  exit 2
fi
