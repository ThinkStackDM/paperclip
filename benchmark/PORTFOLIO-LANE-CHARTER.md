# Portfolio Drafter-Lane Charter — LOCKED 2026-06-23

> Superseded as the live lock table on 2026-07-12.
> Use `benchmark/results/tskb0042-drafter-lane-lock-table-20260712.md` for the
> current portfolio drafter locks. The table below is retained as the historical
> 2026-06-23 charter and still includes retired-fast-era assumptions that are no
> longer valid as live routing locks.

The decision-grade model→task assignments for drafter / single-lane work across all OpCos,
from the TSBC benchmark matrix (base + with-skills, 5+ samples/cell; cv-review via the agentic
skill-eval). Quality weighted against **output-token / quota cost**. This is the standard — apply it.

## Locked lanes (use this model for this task)
| Task | Model | Skills | Notes |
|---|---|---|---|
| content | **gpt-5.4-mini** | +skills | flash was 3rd — do NOT use flash for content |
| book-chapter | **gemini-flash-low** | bare | grok-4-fast (0.950) is the fallback |
| video-hook | **grok-4.1-fast** | bare | |
| social-post | **grok-4-fast** | bare | |
| designer | **grok-4.1-fast** | bare | |
| ops | **grok-4.1-fast** | bare | |
| summarize-extract | **codex-gpt-5.4** | bare | on the ChatGPT sub = low quota burn |
| intake | **grok-4.1-fast** | bare | cheapest; all lanes ace it |
| cv-review | **gemini-flash** | bare | **AGENTIC frame only** (skills staged as files; single-shot derails) |

## Rules
1. **gpt-5.4-mini only earns its lane WITH skills** (book-chapter +0.105, ops +0.086, cv-review +0.075). Never lane it bare on structured tasks.
2. **cv-review must run gemini-flash AGENTICALLY** — stage skills as files + `agy --print`; single-shot Gemini derails.
3. **Cost principle:** don't pay 10–60× output tokens for +0.01–0.03 quality. **claude-haiku is OUT of drafting** — it's 5–65× more verbose than the terse lanes and its verbosity is not controllable without losing its edge. Reserve opus/sonnet/haiku for high-value, low-volume work (CTO/judgment/final-review), not high-volume drafting.
4. **Per-token cost-within-sub** (the quota-burn weight): Claude Opus:Sonnet:Haiku = 5:3:1 out · OpenAI mini:full:5.5 ≈ 1:10:30 · Gemini lite:low:flash:pro ≈ 1:2:6:8 · grok fast:4.3:4.20 ≈ 1:5:12.
5. **Redundancy/failover:** keep the Codex sister as the always-on lane; the windowed claude-opus CTO is the premium overlay; Hermes/grok sisters are fallback. Lanes are reversible (`upgrade_model.py` writes rollback files).

## How to apply (per OpCo)
For each drafter / specialist that performs a task above, set its adapter+model to the locked lane via
`benchmark/upgrade_model.py` (or `adapter_swap.py` / `make_fleet_agent.py`). Changes are reversible
(rollback files). Verify the agent still runs after the swap. Report applied lanes back to MC.

## Governance
TSBC owns the benchmark + refreshes these lanes (monthly staggered). If a task's needs change, re-benchmark
(don't guess) and update this charter. See memory `drafter-lane-lock`, `cheap-plus-skill-beats-strong`, `thiaaaa-59-rollout`.
