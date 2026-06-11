# Hiring a Sister Lane (-Codex / -Grok / -Hermes clone)

How to create a fallback sister clone of an existing agent. This mirrors how production sisters (e.g. a `GLaD0S-Codex` CEO sister) are configured.

## Naming and adapter

- Name: `<PrimaryName>-Codex`, `<PrimaryName>-Grok`, or `<PrimaryName>-Hermes` (url key lowercased, e.g. `glad0s-codex`).
- `adapterType`: `codex_local`, `grok_local`, or `hermes_local` to match the suffix. Pick the next free family in the fallback priority order `claude_local -> codex_local -> grok_local -> hermes_local`.
- `adapterConfig`: keep minimal and adapter-appropriate. Observed production values: `{ "modelReasoningEffort": "high" }` for a `codex_local` senior-judgment sister; `{ "sandbox": false }` for a `gemini_local` routine-ops agent. Do not copy the primary's Claude-specific config.
- Same `role` and reporting line as the primary (a CEO sister has `reportsTo: null`; an engineer sister reports to the same manager).

## Hire payload

Use the hire API from the `paperclip-create-agent` skill:

```
POST /api/companies/$PAPERCLIP_COMPANY_ID/agent-hires
```

with a payload of this shape (derived from production hire records):

```json
{
  "name": "<Primary>-Codex",
  "role": "<same as primary>",
  "title": "<Role> Fallback Sister (Codex)",
  "icon": "<primary's icon>",
  "capabilities": "codex_local fallback sister of <Primary>. Takes over <role> duties when the primary is rate-limited or hits weekly limits. Wake-on-demand only.",
  "adapterType": "codex_local",
  "adapterConfig": { "modelReasoningEffort": "high" },
  "instructionsBundle": { "files": { "AGENTS.md": "<see below>" } },
  "runtimeConfig": { "heartbeat": { "enabled": false, "wakeOnDemand": true } },
  "sourceIssueIds": ["<hiring issue>", "<rollout directive issue>"]
}
```

Key invariants from the production sisters:

- **Wake-on-demand only** — `heartbeat.enabled: false`, `wakeOnDemand: true`. Sisters never run a timer heartbeat; they are woken by assignment/fallback reassignment.
- **No marginal spend** — sisters run on existing local subscriptions (e.g. `~/.codex/auth.json`). The bundle must say: no paid tools, no new logins; anything requiring spend or permission changes stops and escalates to the board.

## The sister AGENTS.md bundle

Write a short bundle (not a copy of the primary's) covering, in order:

1. **Why you exist** — primary runs `claude_local`; when it is limited, you take over. "When you are active, you ARE the <role>. Same authority, same judgment bar, same accountability."
2. **Activation contract** — wake on demand only; handle the single issue you were woken for; leave durable progress and a clear final disposition (`done`, `in_review` with a real reviewer path, `blocked` with a named owner/action, delegated children, or `in_progress` only with a live continuation path).
3. **Operating identity** — point at the PRIMARY's instruction files by absolute path (AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md under `~/.paperclip/instances/default/companies/<companyId>/agents/<primaryAgentId>/instructions/`) and the primary's shared memory/PARA tree. The sister reads these on every activation rather than duplicating them — so primary instruction updates apply to both lanes automatically.
4. **Handback discipline** — when the primary returns, hand context back via the issue thread; never silently overwrite the primary's in-flight decisions; prefer reversible two-way-door moves while active and flag one-way doors for the primary or board.
5. **Safety and spend** — as above, plus: never exfiltrate secrets, no destructive commands unless the board explicitly requests them.
6. **Coordination** — name the source hiring issue and the fallback-registry location the sister is registered in.

## Register the lane

After the hire is approved and the agent exists:

1. Add the sister's agent id to the machine registry consumed by the monitors: `fallback-registry.json` → append to the primary's ordered list (and add a second-hop entry for the sister itself if a further fallback exists).
2. Update the company's human-readable `fallback-registry/registry.json` `fallbacks[]` entry: primary/sister ids and names, adapter types, `triggerCondition` (e.g. "Claude rate-limited or weekly limit reached"), `status: "active"`, source issues, hire date.
3. If the company reports into a Mission Control portfolio, relay the registration to MC so the MC-side fallback registry stays consistent.
4. Smoke the lane with one bounded, non-sensitive issue before trusting it in the fallback chain, and apply the ramp rules from the main skill until it has 3 consecutive clean completions.
