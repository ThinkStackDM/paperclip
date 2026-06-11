# Callback Registry, Dual-Leg Registration, and Bearer Repair

The MC-side source of truth for outbound dispatch is `opco-callback-registry.json` in the dispatching agent's instructions directory (non-secret), plus bearer files under `.secrets/` (mode 0600). Do not hardcode `/fire` URLs inline anywhere else.

## Registry schema

Top-level fields:

- `revision` — bump on every edit (date + source issue number convention).
- `sourceCompany` — set on outbound payloads by callers (usually `"MissionControl"`); the dispatcher never injects it.
- `mcInbound` — the canonical MC callback agents must embed in any outbound `callback.url` so OpCos can reach MC's live Portfolio Intake routine. Fields: `url`, `publicRegister`, `routineId`, `triggerLabel`, `credentialFile`, `archivedUrls` (never use these), and an optional `secondary` block with its own `url`, `routineId`, `triggerId`, `credentialFile`, `ownerAgentId`, and registration audit fields. OpCos register both legs and fall back to secondary when primary returns 401/422/5xx.
- `opcos.<slug>` — one entry per OpCo.

Per-OpCo entry fields:

- `name`, `companyId` (enables the outbox transport path when present)
- EITHER legacy single-URL form (`url` + `credentialFile`) OR the dual-URL form:
  `urls: [{ url, credentialFile, label }, ...]` — when `urls` is present it is
  authoritative; **index 0 is the PRIMARY leg**, later entries are fallbacks.
  `label` should be `primary` / `secondary` so probe alerts can name the failing leg.
- `method`, `contentType`, `routineId` (informational), `expectedSchema` (informational: `{ sourceCompany, type, ask, why, financial?, deadline, context, callback? }`)
- `registeredAt`, `registrationIssue`, `parentIssue`
- `rotatedAt: []` — append-only audit log of every URL/bearer change (see below).

## Registering an OpCo secondary callback (dual-leg registration)

The OpCo sends a registration payload to MC Portfolio Intake with:

- `callbackRef` (or `ref`) matching `mc-secondary-callback-registration:*`, or
  `type` of `dual_leg_registration` / `secondary-callback-registration`
- fields: `primaryCallbackUrl`, `secondaryCallbackUrl`, `secondaryBearer`

The MC dispatcher routes that issue to `secondary-callback-registration.py`, which:

1. Writes the bearer ONLY to the local `.secrets/<slug>-callback-bearer-secondary` file (0600). Issue comments carry only fingerprints/public ids — never the bearer value.
2. Adds/updates the `urls[]` secondary entry for the slug.
3. Appends a `rotatedAt` audit record (`kind: "secondary-callback-registered"`, leg, source run/issue, OpCo source issue, the secondary publicId, credentialFile, and the fallback policy line).

Fallback policy to record verbatim: *use secondary only when primary returns 401/422/5xx; the handshake URL is liveness-probe only and must not receive directives.*

Adding a brand-new OpCo manually: drop the bearer at `./.secrets/<slug>-callback-bearer` (0600), drop metadata at `./.secrets/<slug>-callback.json` (0600), add the registry entry, bump `revision`.

## Bearer rotation / mismatch repair runbook

Symptom: dispatch to one leg returns 401/403 while the other leg (or the binding probe) shows the OpCo alive.

1. Confirm which leg fails from the dispatch summary (`primary`/`secondary` status fields) or the binding-probe alert naming the leg.
2. Compare the stored bearer against the OpCo's control-plane secret: a known incident shape is *stored bearer matches secret version N (status=previous) after the OpCo rotated to version N+1*. Resync the MC `.secrets/<slug>-callback-bearer[-secondary]` file from the current control-plane secret value.
3. If the OpCo rotated its trigger (URL change), update the `urls[]` entry; if MC rotated its inbound trigger, dispatch a `mc-bearer-rotate` notification so OpCos update their stored MC bearer/URL.
4. Append a `rotatedAt` record: `{ at, issue, kind, reason }` — kinds seen in production: `mc-url+bearer`, `mc-bearer-rotate`, `opco-trigger-rotate-sync`, `secondary-callback-registered`. Always link the controlling issue.
5. Re-probe before closing: a real fix shows `binding_present` / HTTP 2xx on the repaired leg. A 409 `routine_inactive` does NOT count as live.

## Dispatch transport notes

`opco-dispatch.py <slug> <payload.json|->` is the only sanctioned wire path:

- `OPCO_DISPATCH_TRANSPORT=auto|outbox|webhook` (default auto: Paperclip outbox first when the registry entry has `companyId`, webhook fallback).
- Secondary-leg retry triggers: any 5xx, 401/403, 422 with `binding_missing`, network-level errors. Non-triggering 4xx (404, 400) are legitimate refusals — no silent fallback.
- `OPCO_DISPATCH_DRY_RUN=1` prints the request without sending.
- Exit code 0 only when the final leg returned 2xx; a stderr line is emitted whenever the secondary leg was attempted.
- Special case: probe-only relay endpoints (registered with an explicit note in the registry) accept `_binding_probe: true` + bearer and return liveness with no issue created — never send real directives to a probe-only URL.
