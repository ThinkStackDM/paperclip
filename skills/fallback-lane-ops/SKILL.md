---
name: fallback-lane-ops
description: Operate model-fallback "sister" lanes when a primary agent is unavailable. Use when a primary agent hits Claude session/weekly/usage limits, an adapter returns auth or quota errors, a sister agent is in an error state, or the task asks for a takeover, swap-back, controlled ramp, or adapterConfig/model repair on a fallback lane. Covers detection signatures, the takeover and swap-back protocols, ramp rules for recovering lanes, and the registry and state-file schemas that make swap-back possible.
---

# Fallback Lane Ops

Primary agents run on one adapter (usually `claude_local`). When that adapter is rate-limited or down, work moves to pre-hired "sister" agents on other adapters, then moves back after the reset window. Everything here is registry-driven and auditable — issue comments are the audit trail for every live move.

## Detection signatures

- **Usage limits** in run logs: `You've hit your (session|weekly|daily|5-hour|usage) limit`, with a reset time parsed from "Your limit will reset at <ISO>" or "try again at <clock time>". When no reset time is parseable, assume: session/usage → 6 h, weekly → 7 days.
- **Adapter auth/model errors**: e.g. Codex CLI under ChatGPT auth rejecting `*-codex` model variants and plain `gpt-5.3` with `400 invalid_request_error: "<model> model is not supported when using Codex with a ChatGPT account"` — a config problem, not a quota problem (see Model repair below).
- **Adapter-failure storm**: repeated `adapter_failed` on the same sister lane in one review window means the fallback target itself is unhealthy. Treat this as containment work, not as a reason to keep draining more issues into that lane.
- **Sister in error state**: paused, disabled, archived, suspended, error, or ramp-blocked. Fallback tooling skips these as targets by default.

## Registry and state schemas

- **Fallback registry** (`fallback-registry*.json` in the operating agent's instructions dir): `{ "<primaryAgentId>": ["<firstChoiceSisterId>", "<secondChoiceSisterId>", ...] }`. Legacy single-string values are still accepted. Adapter family priority when deriving chains from company inventory: `claude_local -> codex_local -> grok_local -> hermes_local`. Explicit registry entries win; safe inventory-derived same-lane targets are appended.
- **Per-primary state file** (written on takeover, consumed by swap-back): `~/.paperclip/instances/default/companies/<companyId>/fallback-state/<primaryId>.json`, recording `sisterAgentIds`, per-issue `movedIssueTargets`, and the limit `resetAt`. The session-limit watcher keeps its own state under `~/.paperclip/session-limit-watch-state/<companyId>/session-limit-watch/<primaryAgentId>.json`.
- Some companies also keep a human-readable `fallback-registry/registry.json` with `fallbacks[]` entries (`primaryAgentId`, `sisterAgentId`, adapter types, `triggerCondition`, `status`, source issues). Keep both in sync when you add a lane.

## Takeover protocol (primary limited → sister)

Automated path: the `fallback-monitor` routine (every 15 min, deliberately run on a non-Claude adapter so it survives the outage it mitigates) scans recent heartbeat-run logs for limit signatures on registered primaries, then for each hit:

1. Skips paused/disabled sisters; tries remaining sisters in registry priority order.
2. When `FEATURE_FALLBACK_REASSIGN=on`, the chosen sister should self-take over each issue through `POST /api/issues/:issueId/fallback-reassign` instead of a manual assignee patch. That route enforces the registered-sister check, writes the audit comment, releases the old checkout, and wakes the sister. If the issue is already on the sister, it returns `200` with `noop: true`.
3. Reassigns only issues whose primary is fallback-eligible and **skips any issue with an active queued/running run**.
4. Leaves a handover comment on every moved issue and writes the per-primary state file.
5. Patches its own execution issue to `done` with a summary.

Manual operator path (`scripts/session-limit-watch.py`) is the fallback only when the route is disabled, the lane is not registry-wired yet, or you are doing recovery/backfill around the normal self-healing path. Always escalate force in this order, never start broad:

1. Dry run: `--simulate-limit <primaryId> --simulate-reset-minutes 60 --max-issues 2` (expects JSON with `apply: false`, candidates under `moved`/`movedIssueTargets`; mutates nothing).
2. One-issue apply: add `--max-issues 1 --apply --yes`; verify the issue moved and got a handover comment.
3. Swap the test issue back (`--swap-back <primaryId> --max-issues 1 --apply --yes --force`) to prove the restore path.
4. Only then uncapped (`--max-issues 0`) or `--watch --interval-seconds 60` continuous mode.
5. `--reassign-all <primaryId>` drains a queue without a fresh limit event — dry-run first, respect the duplicate-storm preflight (10+ repeated title/body matches blocks apply; inspect with the duplicate-issue sweep, never cancel duplicates from the reassign path). Default apply skips `in_progress`/`in_review`/active runs; `--force` moves those too and leaves force evidence.

Context handoff: run `fallback-brief.py <issue>` for a low-token restart packet (identity, parent chain, scope snapshot, latest comments, suggested next action); paste key bullets plus one explicit next atomic action for the receiving sister. `--issue-comment --post-comment` posts it directly.

### Storm containment for repeated `adapter_failed`

If the target sister starts failing with `adapter_failed` repeatedly, stop broad fallback movement immediately:

1. Do not run uncapped `--reassign-all` or continuous watch against that sister until the lane passes repair.
2. Mark the sister unavailable for new intake (pause, ramp-block, or remove it from the active registry path, depending on company tooling).
3. Repair the lane configuration first: `model-switch.py show`, confirm the auth-compatible preset, then run one dry run and one single-issue apply/swap-back proof before restoring general traffic.
4. If stranded issues already moved to the bad sister, move them once to the next healthy target or the fallback CTO lane; do not loop them back into the same broken lane.

## Swap-back (after the reset window)

The `fallback-swap-back` routine reads the per-primary state files and, once `resetAt` has passed, reassigns the moved issues from the sister back to the primary (again skipping issues with active runs), then closes its execution issue with a summary. Manual equivalent: `session-limit-watch.py --swap-back <primaryId> --max-issues 0 --apply --yes --force`. Verify assignment landed back on the primary before closing anything.

## Ramp rules (recovering or newly-trusted lane)

A lane returning from an error state runs in **controlled ramp**:

- Cap at 3 or fewer live-capacity issues (`in_progress` + actively-reviewed `in_review`; parked `todo`/`backlog`/`blocked` count 0) until it completes **3 consecutive non-smoke backlog issues cleanly** — no repeated comments, no recursive child creation, no wrong-target work, no stale pause/continuation behavior, no adapter/session failure.
- Assign one bounded issue at a time; no batch, recursive, or routine fan-out during ramp.
- Any ramp failure: stop new assignments, route containment to the active fallback CTO lane, and pause the agent if the live adapter is unsafe.
- Fallback tooling must not auto-target ramp-blocked or sensitive lanes unless the operator explicitly passes the allow flags for that company/lane.

## Model / adapterConfig repair

- `model-switch.py show|list|set <preset|model-id>` edits the Codex config (`--config`, `$CODEX_CONFIG_PATH`, `$CODEX_HOME/config.toml`, `~/.codex/config.toml`, in that order); every `set` writes a timestamped backup.
- Verified-working presets under ChatGPT auth: `codex-default`/`general-default` → `gpt-5.5`, `codex-fast` → `gpt-5.4`. Do NOT reintroduce a `-codex` model preset while ChatGPT auth is active — it breaks every `codex_local` sister heartbeat.
- After a switch, post the handoff note: timestamp, from-model, to-model, reason.
- After any repeated `adapter_failed` burst, require the single-issue apply/swap-back proof again before resuming uncapped fallback traffic.

## Escalation

- Adapter quota/session/model/profile failures → the fallback CTO lane first, unless the failing agent IS the CTO lane.
- Unblocks needing agent creation, permission grants, or board action → the active CEO lane.
- Guardrails: never edit the database directly; never store broad tokens in files or comments; keep dry-run mode until one-issue apply and swap-back have both passed.

To hire a new sister lane, see [references/sister-lane-hiring.md](references/sister-lane-hiring.md).
