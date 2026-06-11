---
name: silent-run-review
description: Fast triage checklist for system-generated run-health review issues. Use whenever the wake issue title starts with "Review silent active run for" (stale active-run watchdog) or "Review productivity for" (productivity review). Classifies the run in ~5 minutes — limit/auth failure, hung process, benign long-runner, or routine noise — and closes the review issue with the right disposition. Not for whole-tree stall forensics; that is the diagnose-why-work-stopped skill.
---

# Silent Run Review

Paperclip's recovery service files `Review silent active run for <Agent>` when an active run stops producing output, and `Review productivity for <ISSUE-ID>` when a source issue shows unusual progression (no-comment run streaks, long active duration, high churn). These are bounded triage tasks, not investigations. The contract behind them is `doc/execution-semantics.md` §11 "Silent Active-Run Watchdog" (silence levels, watchdog decisions, source-aware folding) — read it if any step below is ambiguous.

Both issue types arrive with the evidence already collected in the description (run id, silence age, last-output timestamp, source issue link, latest runs/comments, thresholds). Read that first; only fetch more when the description is insufficient.

## 5-minute classification tree

Work down; stop at the first match.

**1. Source issue already terminal?** If the linked source issue is `done`/`cancelled` with durable same-run evidence after the silence point, this is a stale run handle, not a work problem. Close the review (`done`, or `cancelled` if it self-resolved) noting the fold: run id, terminal source status, evidence timestamp. Best-effort kill of any leftover process; if cleanup fails, record that on the review before closing — do not reopen the source issue.

**2. Session-limit / auth / quota failure?** Check the run's last output and adapter error string for limit signatures (`You've hit your (session|weekly|daily|5-hour|usage) limit`) or adapter auth/model errors (401/403, `invalid_request_error` on model selection). If found → switch to the **fallback-lane-ops** skill: confirm the takeover/swap-back path is armed for this primary, then close this review with the classification, the error string, and a link to the fallback action taken. Do not leave the review open "until the limit resets".

**3. Hung process — dead or alive?** For a run with a real process handle, check whether the pid is alive (workspace runtime controls or `ps -p <pid>`).
   - **Pid dead** but run still `running`: the run handle is stranded. Note the evidence, let/ask the recovery path re-dispatch the source issue (move it back to `todo` with a next action if you own it), close the review.
   - **Pid alive but silent**: decide harm vs. patience. If it may be mutating external state or is clearly wedged (silent well past the critical threshold with no side-effect evidence), kill it, move the source issue back to `todo` with a precise next action, close the review. If in doubt and the source issue is blocked on this evaluation, prefer recovery over indefinite waiting — the watchdog blocked the source issue precisely so someone decides.

**4. Benign long-runner?** Builds, big test suites, long agent sessions that are genuinely working. Record an explicit watchdog decision rather than just commenting:
   - `continue` — current evidence is acceptable; does not touch the run; re-arms the watchdog after a 30-minute default window.
   - `snooze` — known time-bounded quiet period; suppresses further scan-created review work until the chosen quiet-until time. Prefer this for known long jobs so the watchdog does not re-file.
   Only the board or the assigned owner of the evaluation issue can record decisions. Then close the review as productive, stating the expected completion signal.

**5. Routine noise during a halt/pause window?** If the run belongs to an agent or routine that is deliberately paused/halted (maintenance, emergency stop, limit window already being handled), cancel the review with the standard comment: `routine watchdog noise during <halt context> — no action needed, see <controlling issue>`.

For productivity reviews specifically, the manager decision menu is in the issue body: close as productive / continue with a snooze window / request decomposition, reroute, block with an unblock owner, or stop/cancel the source work if it is inefficient. Pick one explicitly.

## Required evidence in your closing comment

- Run id (and pid, if a process was involved)
- Last-output timestamp and silence duration at triage time
- Adapter error string verbatim when classification was limit/auth
- The classification (1–5 above) and the action taken on the source issue

## Disposition rules

- **Never leave the review issue itself `in_progress`** at heartbeat end. It is a triage task: `done` (triaged, action recorded), `cancelled` (noise/self-resolved), or — rarely — `blocked` with a named owner when the unblock genuinely belongs to someone else (e.g. only the board can unpause an agent).
- Do not silently delete or hide review issues; they are the watchdog audit trail.
- One review per run is the invariant — if you find duplicates, keep the canonical one and cancel the rest with a link to the keeper.
- Critical-level reviews may have **blocked the source issue** on the evaluation. Closing the review must also restore the source issue's path: clear the blocker and leave the source in a healthy state (`todo` with a next action, an active run, or a real waiting path).

## When to escalate instead

Use the **diagnose-why-work-stopped** skill ONLY when a whole tree is stalled — multiple issues with no live path, recovery loops re-waking the same issues, or the review issue is the visible tip of a structural stop. A single silent run with a clear cause never needs tree forensics.
