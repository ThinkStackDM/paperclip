# Ad-hoc sprint runbook

Put **one company** into a temporary "sprint" — extend its activity window, keep its
Claude lanes hot, fire a directive, and have everything auto-revert at a set time —
with a single command or one button in the ThinkStack Controller.

Codifies the manual ThinkStack Media sprint of 2026-06-21 so future directives are
one parameterised call instead of a sequence of hand-run API/SQL/launchd steps.

---

## Quick start

**CLI** (`/Users/glad0s/paperclip/scripts/`):

```bash
./adhoc-sprint.sh "ThinkStack Media" midnight        # sprint now → 00:00
./adhoc-sprint.sh TSM 23:30 18:00                     # start 18:00, end 23:30
./adhoc-sprint.sh DP 02:00 now --codex-only           # don't wake the claude CEO
./adhoc-sprint.sh TSB 04:00 --dry-run                 # preview, change nothing
```

- `<company>`   name, issue-prefix, or company-id (case-insensitive, partial name OK)
- `<end-time>`  `HH:MM` (Europe/Dublin) · `midnight` · `noon` · `HH`
- `[start-time]` `HH:MM` or `now` (default). A **future** time schedules the start via launchd.
- `--codex-only` keep the CEO on its codex sister only (use when the Claude sub is tight). Claude CTO still sprints.
- `--dry-run`   print the full plan and touch nothing.

**Controller** → **Ad-hoc sprint** panel (http://localhost:4499): pick a company,
set End (and optional Start), tick *codex-only CEO* if needed, hit **Preview** then
**Start sprint**. Active sprints list below with an **End now** button.

**End a sprint early:** `./adhoc-sprint-revert.sh <cid> --now` or the **End now** button.

---

## What it does (and undoes)

| Step | Start (`adhoc-sprint.sh`) | Revert (auto at end / `adhoc-sprint-revert.sh`) |
|---|---|---|
| Activity window | extend to `[now .. end]` (rounds end **up** an hour if there are trailing minutes, so the window never closes — and so **session purge can't fire** — before the revert) | restore the snapshotted original window |
| Claude lanes | drop a sprint-override flag + immediately resume the claude CTO (and CEO unless `--codex-only`) | clear the flag |
| Swap-overs | `claude-window-flip` honours the flag → **no hourly park/swap** of the sprint lanes | flip re-runs → re-park the claude CEO per normal CTO-only policy |
| Directive | issue a `high` "Ad-hoc sprint" ticket to the CEO (codex sister if present) + wake CEO & CTO | — |
| Auto-revert | arm a one-shot launchd job at the end time | the job restores everything, reconciles the flip, then **self-removes** |

Always-on companies (null window, e.g. TSMC) skip the window steps — only the
override flag + directive apply, and revert just clears the flag.

---

## Files & state

- `scripts/adhoc-sprint.sh` — start (the runbook)
- `scripts/adhoc-sprint-revert.sh` — end/revert (generic, idempotent)
- `scripts/.adhoc-sprint/<cid>.json` — live sprint state (snapshot + params). **Presence = sprint active.** `claude-window-flip.py` reads this dir.
- `~/Library/LaunchAgents/com.thinkstack.adhoc-sprint-revert.<cid>.plist` — the auto-revert job (self-removes after firing)
- `~/Library/LaunchAgents/com.thinkstack.adhoc-sprint-start.<cid>.plist` — deferred-start job, if a future start was given (self-removes)
- `.devlogs/adhoc-sprint.log` — everything the start/revert/launchd runs print

Controller API: `GET /api/sprint/active`, `POST /api/sprint/start`
`{company,end,start?,codexOnly?,dryRun?}`, `POST /api/sprint/end` `{cid}`. Inputs are
regex-validated server-side and passed as `execFile` args (no shell).

---

## Notes & guardrails

- Times are **Europe/Dublin**; launchd fires in local time (the Mac runs Dublin), and missed-while-asleep jobs run on wake.
- Starting a second sprint for a company already sprinting is refused — end the first.
- Safe to re-run revert; if the state file is gone it just cleans up launchd.
- This runbook does **not** touch the codex sisters (the 24/7 ops lane) — session-limit-watch owns their pause/resume. It only moves the Claude sprint lane, exactly like the normal flip.
- The original manual TSM sprint (`media-window-revert.plist`, 00:05) predates this runbook and reverts itself tonight; future TSM sprints should use this runbook.
