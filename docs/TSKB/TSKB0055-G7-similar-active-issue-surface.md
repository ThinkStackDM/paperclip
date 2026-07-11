# TSKB0055 G7: Similar active issues surfaced during issue creation

Updated: 2026-07-10

## Context

Issue creation now has a built-in dedup gate for similar active work so operators can see likely duplicates before they submit another active task.

## Mechanism

- `GET /api/companies/:companyId/issues/similar` returns `similarCandidates` for a proposed title.
- `POST /api/companies/:companyId/issues` also returns `similarCandidates` in the create response.
- The new issue dialog preloads similar active issues from the preview route and blocks the first submit when candidates exist.
- Proceeding requires an explicit second submit with `acknowledgedSimilarIssueIds`.
- The create response includes `ignoredSimilarCandidateCount` so the UI and activity log can show that creation continued after reviewing similar active work.
- Activity rows for `issue.created` call out when the issue was created after reviewing similar active tasks.

## Scope

- Only active issues are considered candidates.
- Matching is title-based and intended as an operator dedup prompt, not a hard uniqueness constraint.
