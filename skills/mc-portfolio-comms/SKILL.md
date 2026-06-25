---
name: mc-portfolio-comms
description: Handle Mission Control ↔ OpCo coordination traffic. Use whenever the wake issue title starts with "Mission Control Inbound", "MC Inbound", or "MC Directive", or the wake/routine payload contains portfolio_directive, portfolio_input_request, directive_receipt_ack, handshake, or binding_probe. Covers classifying synthetic probes vs real directives, the directive receipt-ack protocol, dual-leg callback registration and bearer repair, daily/weekly summary traffic, and escalation when a channel goes dark.
---

# MC Portfolio Comms

Mission Control (MC) and operating companies (OpCos) talk over public routine-trigger webhooks (`/api/routine-triggers/public/<publicId>/fire`). Every inbound fire creates an execution issue on the receiving company's intake routine. Most fires are synthetic liveness traffic; a few are real directives. Your job is to classify fast, ack what needs acking, and never let probe noise pile up as blocked issues.

## Step 0 — Recover the payload

The `/fire` webhook does **not** render the directive body into the issue description. You MUST read the routine run's `triggerPayload`:

1. Read `issue.originRunId` from the issue object (`GET /api/issues/{issueId}`).
2. `GET /api/routines/{routineId}/runs/{originRunId}` → inspect `triggerPayload`.

If the run or payload cannot be fetched (transient error), still close the issue `done` rather than blocking — non-retrieval of a probe is not board-worthy.

## Gate: MC inbound origin check (triage entry)

**MC inbound only originates from a registered MC inbound routine.** If the origin routine is `None`, the wake source is a recovery-retry routine, a generic comment/assignment wake, or a non-MC schedule — it is NOT MC inbound and should not enter the MC inbound classifier path.

Recovery-retry wakes (origin `None`, recovery action present in the thread) should be treated as **ordinary stuck-issue triage**: read the latest substantive comment, find the named recovery owner / next action, execute or hand off accordingly.

Real MC inbound traffic carries an MC inbound routine origin **AND** a `portfolio_directive` / `portfolio_input_request` / `directive_receipt_ack` / `handshake` / `binding_probe` payload type — gate the MC inbound path on both.

## Step 1 — Classify the payload

| Payload signal | Class | Action |
| --- | --- | --- |
| `triggerPayload.type == "handshake"` | Synthetic liveness probe (~12/day) | Close silently as `done`. PATCH `{status:"done"}` with no comment, or the standard comment `liveness probe noise — silent-drop per handshake protocol`. Exit. No outbound, no delegation. |
| `type == "binding_probe"` or `_binding_probe == true` | MC callback binding probe (~every 15 min) | Same: cancel silently and exit. |
| `ask` absent / null / empty string | Empty or dropped body | Close `done`. If `requiresAck == true`, FIRST send a negative ack (see Step 2) — the negative ack is the body-drop detection signal MC needs. |
| `type == "directive_receipt_ack"` | Receipt-ack for a directive you (MC side) sent | Record/ack and close: the intake transform flips `ackReceived` in the ack ledger; the execution issue closes `done`. Never route these as work. |
| `type` in `{portfolio_directive, portfolio_input_request}` with a real `ask` | Real directive | Render the ask, send the receipt-ack (Step 2) if `requiresAck`, then route to the owner: triage the ask yourself if you are the addressed CEO/CTO, else create a child issue assigned to the right agent with acceptance criteria. |

**Never leave an MC-inbound fire as `blocked`.** Unhandled probe fires previously piled up as 235+ blocked issues (a duplicate-storm), and routine-run accounting treats `cancelled` probe executions as failed. Terminal disposition every time: `done` for noise, `done`/delegated for real work.

## Step 2 — Receipt-ack protocol (OpCo side)

For any directive where `run.triggerPayload.requiresAck == true`, POST a `directive_receipt_ack` to `triggerPayload.callback.url` **before** doing the substantive work, within `ackDeadlineMinutes` (default **10**). Fall back to the secondary callback URL when the primary returns 401/422/5xx.

```json
{
  "ref": "<echo triggerPayload.idempotencyKey>",
  "type": "directive_receipt_ack",
  "source": "<your-opco-slug>",
  "body_preview": "<first ~100 chars of the ask, or 'empty' if unreadable>",
  "processed_by": "CEO",
  "payload_received": true
}
```

Critical: if the body arrived empty or unreadable, STILL POST with `payload_received: false` and `body_preview: "empty"`. That negative ack is exactly what MC needs to detect a body-drop and retry.

## Step 2b — Ack accounting (MC side)

- `opco-dispatch.py` injects `requiresAck`/`ackDeadlineMinutes`/`ackCallback` on outbound `portfolio_directive` and `portfolio_input_request` payloads and writes a pending-ack record to the `ack-ledger/`.
- The `ack-sweep` routine alerts on overdue acks: it files a high-priority "No ack from {OpCo}" issue (assigned to routing triage, then CEO follow-up) and marks the ledger record `alerted` so it never double-alerts. Alerts are **suppressed** when the binding-liveness snapshot (fresher than 30 min) independently proves the channel live — a missing ack on a live channel is noise, not a blocker.
- The `ack-reconcile` routine (every 6 h) auto-closes `blocked` ack trackers whose channel is proven live; "live" means a true HTTP 2xx accept (a 409 `routine_inactive` does not count).

## Dual-leg callbacks and bearer repair

Each OpCo registers a primary + secondary callback leg; MC dispatch tries primary first and retries the secondary on 5xx, 401/403, 422 `binding_missing`, or network errors (404/400 are legitimate refusals — never silently fall back on those). Registration, the registry schema, and the bearer rotation/mismatch repair runbook live in [references/callback-registry.md](references/callback-registry.md).

## Daily / weekly summary traffic

- OpCos POST a `kind: "daily_summary"` payload to MC Portfolio Intake covering the prior day's progress, blockers, callouts, and successes, due by the 08:00 Europe/Dublin intake window.
- A missing summary triggers an MC reminder dispatch (`portfolio_input_request`, ref `daily-summary-reminder:<date>:<slug>`, 10-min ack deadline). Treat the reminder as a real directive: ack it, then post the summary.
- Response body conventions (both directions): `kind` signals intent (`channel_ack`, `portfolio_decision`, `daily_summary_ack`, `approval_response`), `summary` is a short headline (rendered as the issue title hook), substance goes in `details` (markdown), `context` names what is being responded to (intake run id / source issue id), `timestamp` is ISO8601 Zulu. Expect HTTP 202 with `linkedIssueId` — reference it in the source-side issue comment so the two threads stay correlated.

## Escalation rules

- **Channel dark:** the MC→OpCo handshake routine (2-hourly) tracks `consecutiveBrokenCount` per OpCo. At 2 consecutive broken cycles (~4 h dark) it files one board-action escalation issue per incident (deduped over a 24 h window, repeat counter instead of new issues) and auto-resolves when the handshake recovers. Do not file parallel escalations for the same dark window.
- **Both legs failing auth:** break-glass — re-register via the public register endpoint and alert the active CEO and CTO lanes; primary and secondary credentials drift independently, so report both statuses.
- **Unknown payload shape:** do not guess. Route to the primary CTO with the title, parent identifier, and a pointer to the dispatcher routing table, exactly as `mc-compiler-dispatch.py` does for unrecognized wakes.

## Verification checklist

- [ ] Payload was read from the routine run (`triggerPayload`), not inferred from the issue body.
- [ ] Probe/handshake fires are `done`, not `cancelled`, `blocked`, or left open.
- [ ] `requiresAck` directives got an ack (positive or negative) within the deadline, before substantive work.
- [ ] Real directives ended in a terminal disposition or a routed child issue with an owner.
