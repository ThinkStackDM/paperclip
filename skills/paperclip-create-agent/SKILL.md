---
name: paperclip-create-agent
description: >
  Create new agents in Paperclip with governance-aware hiring. Use when you need
  to inspect adapter configuration options, compare existing agent configs,
  draft a new agent prompt/config, and submit a hire request.
---

# Paperclip Create Agent Skill

Use this skill when you are asked to hire/create an agent.

## Preconditions

You need either:

- board access, or
- agent permission `can_create_agents=true` in your company

If you do not have this permission, escalate to your CEO or board.

## Workflow

### 1. Confirm identity and company context

Read your current agent identity through the authenticated Paperclip API helper described in the Paperclip skill. The exact endpoint is listed in [api-reference.md](references/api-reference.md).

### 2. Discover adapter configuration for this Paperclip instance

Read the global adapter-configuration summary first, then the specific adapter note for the runtime you plan to use (for example `claude_local`). Both endpoint paths are documented in [api-reference.md](references/api-reference.md).

### 3. Compare existing agent configurations

List the company's current agent configurations before drafting a new one. Use the agent-configuration listing endpoint from [api-reference.md](references/api-reference.md).

Note naming, icon, reporting-line, and adapter conventions the company already follows.

### 4. Choose the instruction source (required)

This is the single most important decision for hire quality. Pick exactly one path:

- **Exact template** — the role matches an entry in the template index. Use the matching file under `references/agents/` as the starting point.
- **Adjacent template** — no exact match, but an existing template is close (for example, a "Backend Engineer" hire adapted from `coder.md`, or a "Content Designer" adapted from `uxdesigner.md`). Copy the closest template and adapt deliberately: rename the role, rewrite the role charter, swap domain lenses, and remove sections that do not fit.
- **Generic fallback** — no template is close. Use the baseline role guide to construct a new `AGENTS.md` from scratch, filling in each recommended section for the specific role.

Template index and when-to-use guidance:
`references/agent-instruction-templates.md`

Generic fallback for no-template hires:
`references/baseline-role-guide.md`

State which path you took in your hire-request comment so the board can see the reasoning.

### 5. Discover allowed agent icons

Read the allowed icon list from the icon-reference endpoint documented in [api-reference.md](references/api-reference.md).

### 6. Draft the new hire config

- role / title / name
- icon (required in practice; pick from `/llms/agent-icons.txt`)
- reporting line (`reportsTo`)
- adapter type
- `desiredSkills` from the company skill library when this role needs installed skills on day one
- if any `desiredSkills` or adapter settings expand browser access, external-system reach, filesystem scope, or sensitive-access capability, justify each one in the hire comment
- adapter and runtime config aligned to this environment
- leave timer heartbeats off by default; only set `runtimeConfig.heartbeat.enabled=true` with an `intervalSec` when the role genuinely needs scheduled recurring work or the user explicitly asked for it
- if the role may handle private advisories or sensitive disclosures, confirm a confidential workflow exists first (dedicated skill or documented manual process)
- capabilities
- managed instructions bundle (`AGENTS.md`) for adapters that support it; avoid durable `promptTemplate` config
- for coding or execution agents, include the Paperclip execution contract: start actionable work in the same heartbeat; do not stop at a plan unless planning was requested; leave durable progress with a clear next action; use child issues for long or parallel delegated work instead of polling; mark blocked work with owner/action; respect budget, pause/cancel, approval gates, and company boundaries
- instruction text such as `AGENTS.md` built from step 4; for local managed-bundle adapters, send this as top-level `instructionsBundle.files["AGENTS.md"]`. Do not set `adapterConfig.promptTemplate` or `bootstrapPromptTemplate` for new agents.
- source issue linkage (`sourceIssueId` or `sourceIssueIds`) when this hire came from an issue

### 7. Review the draft against the quality checklist

Before submitting, walk the draft-review checklist end-to-end and fix any item that does not pass:
`references/draft-review-checklist.md`

### 8. Submit hire request

Submit the hire request through the `agent-hires` create endpoint using a structured JSON payload. A full field example lives in [api-reference.md](references/api-reference.md).

### 9. Handle governance state

- if the response has `approval`, the hire is `pending_approval`
- monitor and discuss on the approval thread
- when the board approves, you will be woken with `PAPERCLIP_APPROVAL_ID`; read linked issues and close/comment follow-up

Review the approval record, then post a follow-up comment on that approval thread summarizing:

- approval id
- pending agent reference
- source issue reference
- what changed after board feedback

Use company-prefixed issue and approval links in the actual comment you send.

If the approval already exists and needs manual linking to the issue:

If the approval already exists and needs manual linking, attach it to the source issue through the issue-approval link endpoint documented in [api-reference.md](references/api-reference.md).

After approval is granted, run this follow-up loop:

After approval is granted, re-read the approval record and its linked issues through the approval endpoints documented in [api-reference.md](references/api-reference.md).

For each linked issue, either:
- close it if the approval resolved the request, or
- comment in markdown with links to the approval and next actions.

## References

- Template index and how to apply a template: `references/agent-instruction-templates.md`
- Individual role templates: `references/agents/`
- Generic baseline role guide (no-template fallback): `references/baseline-role-guide.md`
- Pre-submit draft-review checklist: `references/draft-review-checklist.md`
- Endpoint payload shapes and full examples: `references/api-reference.md`
