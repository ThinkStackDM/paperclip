# THIAAAA-59 — Optimised Lane Rollout ("perfect" setup for discussion)

Evidence base: the full benchmark (`PRODUCTION-TIER-MAP.md`). Every claim below is measured.

## 1. The one principle the data proves
**The split that matters is SINGLE-PASS vs AGENTIC, not cheap vs premium.**
- Single-pass work (write/review/extract/classify/calc) → cheap models match or beat premium. No supervisor.
- Agentic work (multi-step: wake→read→work→delegate→set disposition) → needs a strong reasoning model; cheap/fast models collapse.
- **Gemini wins both ends** (Flash leads single-pass content; Pro is top-tier agentic), but quota caps how much we can lean on it — so we spread for capacity.

## 2. The lanes (model assignments)

| Lane | Work profile | Primary model | Why (measured) | Fallbacks |
|---|---|---|---|---|
| **A — Orchestration / agentic** | CEOs, COOs, managers, routers, ops, PMs, engineers running build loops | **codex-gpt-5.4** | agentic 0.917 (top); already the codex lane | gemini-pro 0.914 → claude-opus-4.8 0.900 |
| **B — Content production** | authors, content/SEO writers, video-hooks, social, designer copy | **Gemini 3.5 Flash** | leads all 4 content suites (0.93–0.95), calibrated, cheap | grok-4.1-fast (constraint/format tasks) |
| **C — Judgment / review** | CV review, auditing, research, analysis | **Gemini 3.5 Flash + targeted skill** | wins judgment natively (CV 0.929); skill adds calibration | grok-4.1-fast + CV-skill |
| **D — Numeric precision** | quant, ledger, hard-format/constraint tasks | **grok-4.1-fast** | best at ledger/quant precision; cheapest measured tokens | Gemini Flash |

**Retire grok from agentic lanes entirely** — grok-*-fast score 0.44–0.49 agentic (worst); even grok-4.3 (today's "premium") is mid-pack at ~0.66–0.75 vs the 0.90 leaders.

## 3. Capacity / quota strategy + redundancy across subscription packs (the real constraint)
Lanes are subscription/quota-billed, not per-token. Each provider is an INDEPENDENT pack with its own
quota: ChatGPT (codex), Gemini/Antigravity (gemini), Claude (opus/sonnet), xAI/Hermes (grok). Gemini has
hard 5h + weekly limits we already hit today.

**The key leverage: the benchmark shows the top models are near-EQUAL per lane, so model diversity = quota
redundancy at ~zero quality cost.** Redundancy lanes fall back ACROSS packs, never within one:
- **Lane A (agentic):** codex-5.4 (ChatGPT) → gemini-pro (Gemini) → opus-4.8 (Claude) — 3 independent pools, all ~0.90.
- **Lane B/C (single-pass):** Gemini Flash (Gemini) ↔ grok-4.1-fast (xAI) — 2 independent pools, both strong.
- **Lane D (precision):** grok-4.1-fast (xAI) ↔ Gemini Flash (Gemini).

So a depleted pack never downs a lane — it shifts to a quality-equivalent model on a different subscription.

**Quota-aware routing (safe because quality-equivalent):** route each lane by live quota headroom, not a
fixed model. When Gemini 5h is low → single-pass to grok-4.1-fast; when ChatGPT throttles → agentic to
gemini-pro/opus. Track quota as a first-class signal (`agy /usage` for Gemini; usage.py for the rest) and
feed headroom into the fallback trigger.

**Plan to actual pack capacity:** size each lane's expected volume against the real subscription limits we
hold, so the primary+fallback pair always has headroom. (Action: map current packs → quotas → per-lane
volume before go-live.)

## 4. Skills & instructions (measured lesson)
- **Ship small, targeted SKILLS, not bloated agent-files.** CV-review: skill-only 0.938 > AF+skill 0.897 (a custom AGENTS.md HURT). A 1.4KB calibration skill fixed a 0.192→1.000 disaster.
- Keep the core "Execution Contract" instructions (drives the agentic loop); add a skill only where a *measured* gap exists.

## 5. Portfolio-wide vs per-company (the THIAAAA-59 question)
**Charter-level standard, company-level application.**
- **The lane→model map (§2) is a PORTFOLIO-WIDE charter standard** set by the MC — every company inherits it. Consistency + it's evidence-backed, so no company re-litigates model choice.
- **Companies apply it to their own agents** (their CEO assigns each agent to a lane). Company-specific deviations (e.g. Capital wanting a specific quant model) are allowed but require MC sign-off + a benchmark justification.
- **The MC owns the benchmark** as the source of truth: re-run on every new model / quarterly; the charter updates when the data does.

## 6. Reporting chain / governance
- MC sets + owns the lane charter and the benchmark.
- Each company CEO maps its agents to lanes per charter; reports lane assignment + any deviation up to MC.
- Quota/cost + lane-quality are MC-level dashboards (roll up usage.py + agy /usage + periodic benchmark deltas).
- Fallback sisters (existing `agent_fallback_sisters`) wired per the §2 fallback column.

## 7. Known gap to fix in parallel (not model-selection)
**Stage-12 idempotent-restraint fails for EVERY model (~0.00) except gemini-pro (0.50)** — agents churn already-done/blocked issues instead of leaving them. This is a HARNESS / execution-contract gap, not a model problem. Worth a dedicated fix to the agentic contract.

## 8. Suggested rollout sequence (safe, reversible)
1. **Pilot one company** (e.g. Media or Books — content-heavy, low blast radius): move content agents to Gemini Flash (Lane B), orchestrators to codex-5.4 (Lane A). Measure for a sprint.
2. **Validate** lane quality + quota headroom hold in production (not just benchmark).
3. **Roll portfolio-wide** company by company, orchestrators first (biggest agentic gain off grok), then content.
4. **Keep grok-4.1-fast** as the constraint/precision + relief lane; retire grok from agentic.
5. **Re-baseline** after rollout; fold the stage-12 harness fix in.

## Open questions for discussion
- Lane A default: codex-5.4 (top score) vs gemini-pro (ties, but shares Gemini quota with Lane B) vs spread-by-default?
- How aggressive on retiring grok — full retirement from agentic, or keep grok-4.3 as a fallback tier?
- Per-company autonomy: how much deviation latitude before MC sign-off?
- Pilot company choice + success criteria for go/no-go to portfolio-wide.

## ROLLOUT LOG
**2026-06-21 — Phase 1 LIVE:** upgraded 18 Lane A primaries claude-opus-4-7 → claude-opus-4-8
(every CEO/CTO + Auditor/Ledger/Quant, all companies). 0 failures, audited in agent_config_revisions.
Rollback: `rollback-claude-opus-4-7-to-claude-opus-4-8.json` + `upgrade_model.py <to> <from> --apply`.
Fleet already implements the charter structure: opus primaries (Lane A) + grok-4.3 "-Hermes" fallback
sisters (mid-stack fallback) + codex agents. So rollout = upgrade + targeted refinement, not teardown.

**Phased next (monitored):**
- Content/SEO → Gemini Flash: GATED by scarce Gemini quota; roll gradual, quantify monthly impact first.
- grok-4.3 agentic primaries (TSB Compiler, MCInboundHandler, RoutineOps) → codex-5.4 (Lane A, roomy ChatGPT pack).
- Capital quant agents: HOLD (grok precision + sensitive trading lane).
- gpt-5.5 → gpt-5.4 for agentic: marginal (+0.045), charter default for new agents only; no mass-churn.

**Monitor:** usage.py (per-pack token/run volume), agy /usage (Gemini quota), heartbeat_runs health.

## ROLLOUT LOG — Phase 2 (overnight 2026-06-21, autonomous, davin asleep)
**Full backup taken:** `fleet-backup-20260621-011440.json` (153 agents, complete adapter_config + runtime_config). Primary rollback.

**Applied (all safe pure-model bumps, no adapter swaps, configs preserved, reversible):**
- opus-4-7 → opus-4-8: 18 CEO/CTO/Auditor/Ledger/Quant claude primaries (Phase 1).
- CEO codex sisters gpt-5.5 → gpt-5.4: 6 (-Codex agents). gpt-5.4 is the CEO/agentic winner.
- CTO codex sisters gpt-5.5 → gpt-5.4: 2 (Astra-Codex, Prometheus-Codex).
- NET: every CEO/CTO trio tier now on an optimal model — claude=opus-4.8, codex=gpt-5.4, hermes=grok-4.3.
  So whatever the window-flip does, the active CEO/CTO runs on a top model.

**The window-flip ("6h sprint CEO swap") = `claude-window-flip`:** parks the claude CEO/CTO outside its
~6h sprint window (pauses via the pause API, reason "manual", at company window boundaries) so the codex
sister covers. Implementer is NOT in the app (routines/heartbeat only reference it) — likely an external
cron/scheduled-task I could not locate. LEFT RUNNING ON PURPOSE: now harmless (both flip sides are top
models). Disabling it + making CEO=codex-only / CTO=opus-only is the pure split — DEFERRED (stateful
work-routing; needs davin to point to the scheduler, do test-first together).

**Deferred (need test-first / davin input — NOT safe to do unattended):**
- Pure CEO=gpt-5.4 / CTO=opus split + disable claude-window-flip (above).
- grok-4.3 agentic primaries (TSB Compiler, MCInboundHandler, RoutineOps) → top model: needs
  hermes→claude/codex ADAPTER swaps (config construction = risky unattended; only ~3 agents; grok-4.3 acceptable meanwhile).
- Fleet-wide gpt-5.5 → gpt-5.4 (~23 agents): marginal (+0.045), agentic-only single-run evidence — 3-run confirm first.
- Capital quant agents: HOLD (grok precision + sensitive trading lane).
- Content/SEO → Gemini: GATED by Gemini quota AND ⚠️ Gemini FLASH was only validated SINGLE-PASS, NOT on
  the agentic lane — fleet agents are agentic, so use gemini-PRO (agentic-validated 0.914), not Flash, for them.

**Rollback:** primary = restore from `fleet-backup-20260621-011440.json`. Per-change = `rollback-*.json` files + `upgrade_model.py <to> <from> --apply`.
**Monitor:** `python3 usage.py`, heartbeat_runs health, `agy /usage`.

## PHASE 2 — Operational tiered lanes (recurring-task pipelines)

Capacity-driven (sub thickness): **Grok = thickest + MONTHLY pool (no 5h/weekly) → volume/churn. ChatGPT
thick → agentic. Claude middle → reserve. Gemini THINNEST (5h+weekly, hit them) → spend only where uniquely best.**

**The tiered production-lane pattern** (operationalizes the cascade economics) for high-volume recurring tasks:
1. DRAFT (volume)   → grok-fast + task-skill   (churn bulk cheap on the fat monthly grok sub)
2. REFINE (strict)  → gemini-flash             (selective quality pass; ration the thin sub)
3. QA / ASSEMBLE    → agent (codex/claude)     (check, edit, stitch, final touches, hand off)

Beats one premium agent doing everything ad-hoc: grok absorbs volume ~free, gemini rationed to quality-
critical step, agent spends judgment only on assembly/QA.

**Split high-volume recurring tasks into dedicated single-task lanes** (not a general agent): one optimized
grok-fast+skill drafter per recurring task type. Validated pieces: grok-fast+skill CV-review 0.94, chapters/
social at parity. Worth the extra-agent overhead only for genuinely high-volume recurring work.

**Recurrence data (issues/30d, content OpCos):** Books 2572 > KISS 2181 > Media 2165 > Recruitment 1723.

**PILOT = Books / book chapters** (highest content volume + a PUBLISHED book = objective ground truth).
Test design: grok-4.1-fast+chapter-skill drafts a target published chapter from its setup → compare vs
published → gemini refine → agent QA → compare final vs published. Measures the whole lane against pro work.
BLOCKED ON: davin to provide the published book (target chapter + setup/context + published version to diff).
(CV-review NOT piloted: 1 sample, no answer-key, already validated 0.94. Books templates to KISS/Media/Recruit after.)

**Baseline relane still feeding this:** grok-4.3 move-candidates (only 4): TSB Compiler / MCInboundHandler /
RoutineOps → codex-5.4 (ops, adapter swaps); GrowthSEO-Gemini → gemini-pro (content). Rest of grok = media/
fallback/Capital-held (keep). Plus gpt-5.5→5.4 fleet bump (gated on running confirm).
