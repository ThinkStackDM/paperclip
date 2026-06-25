# Sister-Lane Redesign — benchmark-driven failover (proposal, 2026-06-23)

Reframes fallback "sisters" from a **blanket** `claude→codex→hermes(grok)` chain to a
**benchmark-driven** one: the agent you fail over TO should be the next-best *model for that
lane's work*, not a fixed tier. Grounded in `PRODUCTION-TIER-MAP.md` + `LANE-HARDENING-READOUT.md`
+ `PORTFOLIO-LANE-CHARTER.md`. Wires into the unified `agent_fallback_sisters` registry
(see `scripts/lane_registry/`).

## Why the blanket chain is wrong (two benchmark facts)

1. **grok is the WORST agentic model** — agentic suite: codex-gpt-5.4 **0.917** ≈ gemini-pro(3.1 High)
   **0.914** ≈ claude-opus-4.8 **0.900**; grok-4.3 ~0.66–0.75; **grok-*-fast 0.44–0.49**. Yet a
   grok `-Hermes` sister is today the active fallback for **every** agentic lane (CEO/CTO/engineer).
   When a codex CEO (0.917) limits out it drops to grok-4.3 (~0.70) — a cliff, not a fallback.
2. **content lanes don't fail to the content leader.** Single-pass content winner = **gemini-flash**
   (leads all 4 production suites, natively calibrated); grok-4.1-fast for hard-constraint tasks.
   codex/opus are overkill and *not* content leaders. A content drafter failing to its codex/grok
   sister ignores this.

**Organizing principle (from the tier map):** the dividing line is **single-pass vs agentic**, and
within each, **per-task winners**. So sisters are chosen by (a) is the lane agentic or single-pass,
(b) which models win that task.

## The three archetypes

### A — Agentic lanes  (CEO, CTO, engineers, control-plane workers — multi-step tool-use)
Top-3 agentic are near-equal and **cross-provider** → that IS the redundancy set.
- **Failover order: `codex-gpt-5.4 → gemini-pro(3.1 High) → claude-opus-4.8 → [grok cold last-resort]`.**
- Drop grok as a *peer* fallback (0.66 is a cliff). Keep it only as a cold last resort if at all.
- CTO (windowed opus primary): `opus-4.8 → codex-5.4 → gemini-pro`.

### B — Single-pass / draft lanes  (drafters, content/social/designer/intake/cv-review)
Primary + sister = the task's **winner → runner-up** from the locked charter:
| task | primary | sister |
|---|---|---|
| content | gemini-flash | grok-4.1-fast |
| book-chapter | gemini-flash-low | grok-4-fast |
| video-hook | grok-4.1-fast | gemini-flash |
| social-post | grok-4-fast | grok-4.1-fast |
| designer | grok-4.1-fast | gpt-5.4-mini(+skills) |
| cv-review | gemini-flash (agentic) | grok-4.1-fast(+skill) |
| summarize-extract | codex-gpt-5.4 | gemini-flash |
| intake | grok-4.1-fast (any — trivial) | — |
Here grok-4.1-fast is a *legit* sister (top single-pass constraint model). gemini-flash is the other
pillar. **codex/opus are NOT the right single-pass sisters.**

### C — Media-gen lane  (Designer-Media ×7)
grok / grok-imagine — owns image/video. Correct as-is; no LLM failover needed.

## C-level: not all the same

- **CEO primary = codex-gpt-5.4** stays (single best agentic, 0.917) — but its cross-provider sister
  should be **gemini-pro, not grok**.
- **Content-heavy houses (Media, Books, KISS):** Gemini wins BOTH single-pass content AND is top-3
  agentic → a **gemini-pro** lane is doubly valuable (covers drafting + agentic fallback). Strong case
  for gemini-pro as the #2 there.
- **Technical/agentic houses (TSMC platform, Capital quant):** codex-5.4 leads; **opus-4.8** is the
  natural #2 (premium reasoning), gemini-pro #3.
- **CTO already differentiated** (windowed opus). Note: single-pass technical *judgment*
  (auditor/cto/ledger/quant) ceilings on cheap models (gemini-flash/grok-4.1 ~0.95–0.99) — so the opus
  CTO earns its cost ONLY on agentic/final-review, not single-pass judgment.
- **Capital = the deliberate exception** (held on grok-4.3, sensitive). It is also the WORST-configured
  for redundancy: Engineer/Compiler/PolymarketEngineer are grok-primary + grok-`-Hermes` = **same
  provider** — if xAI flakes, both die. Benchmark + the 06-21 fleet audit both say: give it a codex
  cross-pack sister. **Flagged for davin (held).**

## What changes vs today (per the live fleet)

Today: every lane = claude(parked) + codex-gpt-5.4 + grok-4.3 `-Hermes`. Deltas:
1. **Agentic lanes:** add an active **gemini-pro** sister; reorder failover `codex → gemini-pro →
   opus(parked, un-park only if needed) → grok(cold)`. (GrowthSEO-Codex already did exactly this:
   "gemini-pro → codex-5.4 → grok trio".)
2. **Content worker lanes** (Books Author/Editor/Quill/Designer, Media ContentStrategist/Storyboard,
   Recruit ApplicationWriter, KISS Scribe): give a **gemini-flash** sister (their existing codex sister
   is fine as the agentic-ish 2nd, but gemini-flash is the benchmark drafting fallback).
3. **17 "no-failover" worker lanes** (the audit gap): most already have a **codex** sister (gpt-5.4 =
   the BEST agentic, 0.917) → registering `claude→codex` is already benchmark-right for the agentic
   ones; the content ones additionally want gemini-flash.
4. **Capital:** convert one grok `-Hermes` per lane → codex sister (cross-pack). Held → propose to davin.
5. **Cleanup:** Media `Content-Repurposing-Hermes` = orphan grok sister with no primary lane → re-primary or retire.

## Hard constraints (why this is a phased project, not a registry reorder)

- The registry only **orders existing agents**. Most lanes have **no gemini sister**, and the **opus
  sister is parked** (claude-window-flip halts claude CEOs/CTOs to save Claude slots). So the only
  *active* fallback today is grok. Benchmark-optimal failover therefore needs **new gemini-pro/flash
  sisters hired** (antigravity adapter; quota-billed, ~$0 token cost) before the registry can point at them.
- **Gemini quota is the limiter.** `agy` is capacity-billed (weekly + 5h bars). gemini sisters that only
  wake on a single lane's limit are cheap; but a *fleet-wide* Claude/codex limit would make many lanes
  contend for Gemini at once. → Add gemini-pro sisters to **high-value lanes first** (leadership +
  critical always-on workers: TSMC Ledger/Auditor, the active CTOs), not all 15 agentic lanes at once.
- **codex rarely limits** (ChatGPT sub) — so for many worker lanes, `claude→codex` (both already exist)
  is a perfectly good 1-level failover with zero new hires. The gemini layer is the *premium* upgrade.

## Recommended phased rollout (TSBC-owned)

- **Phase 0 — ✅ DONE 2026-06-23:** registered the 17 worker lanes' existing `claude→codex` failover
  (codex = top agentic, no hires). +18 rows tagged `lane-coverage-phase0-2026-06-23`. Closed the
  coverage gap; watchers re-read clean.
- **Phase 1 — ✅ DONE 2026-06-23:** hired **11 gemini-pro sisters** (`<Base>-Gemini`, antigravity /
  Gemini 3.1 Pro (High), wake-on-demand) for the 6 CEOs (ex-Capital) + TSMC Ledger/Auditor + the 3
  active CTOs (Astra/Prometheus/Daedalus). Wired tag `gemini-sister-phase1-2026-06-23`; chains now run
  `codex→gemini-pro→grok` (gemini sorts between codex and hermes, so the tier generator produces it
  automatically). All files parse, all refs live, 0 drops.
- **Phase 2 — ✅ DONE 2026-06-23:** generator now uses **content-lane ordering** (`order_lane()`:
  content lanes = primary → gemini-flash → grok-4.1 → codex → claude; agentic lanes unchanged, classified
  by role/base — committed to the PR). Hired **7 gemini-flash (Low) sisters** (Books Author/Editor/Quill/
  Designer, Media ContentStrategist/Storyboard, KISS Scribe; tag `gemini-flash-phase2-2026-06-23`); content
  chains now run `claude→gemini-flash→codex`. 74 active rows. (Recruit ApplicationWriter already had a
  gemini sister; DP/Recruit drafter cross-sisters still optional.)
- **Singletons — ✅ DONE 2026-06-23:** the MED+ production agents that had NO sister now have a
  benchmark-matched next-in-line (tag `redundancy-singletons-2026-06-23`): `Frame→Frame-Codex`,
  `Showrunner→Showrunner-Gemini`, `Press/Crawler/Tagsmith→ -Hermes (grok-4.1-fast, the single-pass
  ops/content runner-up)`. Smoke-tested `GLaD0S-Gemini` end-to-end (woke, executed, closed an issue).
  **Excluded:** BootCamp `Bench-*` (benchmark roster, isolated by design), the `*-Drafter` cheap-draft
  lane (Phase 2), and low-value light-comms singletons (Concierge/Liaison/TSMC-RoutingPA — flagged).
- **Phase 3 — ✅ DONE 2026-06-23 (davin go):** Capital optimised to benchmark. **Promoted** the engineer
  primaries `Engineer/Compiler/PolymarketEngineer` grok-4.3 → **codex-gpt-5.4** (`adapter_swap.py`,
  rollback `rollback-adapter-swap-20260623-201943.json`) — was grok+grok single-provider, now best-agentic
  primary + cross-provider grok `-Hermes` fallback. Hired `MIDAS-Gemini` (gemini-pro) → MIDAS-Codex now
  `codex→gemini-pro→grok`. Tag `capital-optimise-2026-06-23`. 75 active rows.
- **Cleanup — ✅ DONE:** retired `Content-Repurposing-Hermes` (unused orphan, 0 runs/0 issues; repurposing
  covered by Designer-Media + drafters).
- **Full coverage sweep — ✅ DONE 2026-06-23:** audited every org chart vs the benchmark. Fixed 2 misconfigs
  (`Media-Drafter` antigravity/`gpt-5.4-mini` → Gemini-flash; `AntiGravEngineer` model `"antigravity"` →
  Gemini-pro). Closed remaining session-limit gaps so **every production agent has a CROSS-PROVIDER**
  ("different sub") next-in-line — hired 12 sisters + wired `GrowthSEO-Codex` (tag `sweep-sisters-2026-06-23`):
  Concierge/Liaison/Quant/Sentinel→`-Codex`; CodexEngineer→gemini-pro; AntiGravEngineer/HermesEngineer→`-Codex`;
  the 5 drafters→opposite-provider draft sister (grok↔gemini). 13/13 verified cross-provider. Only TSMC
  `RoutingPA` left uncovered (duplicate name across companies blocks the clone tool; trivial intake task).
- **Capability-first ordering — ✅ DONE 2026-06-23:** generalized `order_lane()` so EVERY lane fails over
  primary-first → next MOST CAPABLE available sister per archetype (agentic `codex→gemini-pro→opus→grok`;
  content `gemini-flash→grok-4.1→codex→claude`). Fixes non-codex-primary agentic lanes (GrowthSEO-Gemini,
  promoted grok primaries now fail UP to codex) + 2 primaries (AntiGravEngineer/HermesEngineer) that had
  no chain. Committed to the PR. **Net result: ~88 active rows, every role passes to the best available
  cross-provider sister; "most capable" == "token-friendly" because the task-leading models are the cheap
  ones (Gemini Flash content, codex/gemini-pro agentic) — opus only as a rare deep fallback.**

> ✅ **Tooling bug FIXED 2026-06-23:** `make_fleet_agent.py` now sets `runtimeConfig.ignoreActivityWindow`
> on every hire — inherited from the clone source, defaulting to `true` for sister hires (the always-on
> codex/gemini lanes all set it), with a `--no-ignore-window` opt-out. Previously it dropped the flag, so
> newly-hired antigravity/Gemini (and any) sisters wouldn't pick up failover work outside the company
> activity window — exactly when failover fires. All 16 sisters hired today were patched manually before
> the fix; future hires carry it automatically.

> ⚠ **Gemini-quota watch:** 11 new wake-on-demand gemini-pro sisters consume `agy` quota only on
> failover; fine for sporadic per-lane limits, but a correlated fleet-wide Claude/codex limit would make
> them contend for Gemini capacity at once. Monitor `agy /usage` if mass failover ever fires.

Each phase: hire via `make_fleet_agent.py` (full skill bundle baked in), then run
`scripts/lane_registry/backfill.py` + `generate.py` to wire the registry, then verify. All reversible.

_Owner: TSBC (benchmark). Source data: `PRODUCTION-TIER-MAP.md`, `LANE-HARDENING-READOUT.md`,
`PORTFOLIO-LANE-CHARTER.md`, `FLEET-LANE-AUDIT.md`. Registry mechanics: `scripts/lane_registry/`._
