# TSBC — ThinkStack BootCamp — Charter

*The internal org that owns ThinkStack's model / skill / agent quality system.*
(Workstream **B** of the [[tsbc-bootcamp-vision]] plan. Company: id `e212ce50-…`, prefix **AGE** retained — 706 existing issues make a prefix change destructive; identity is by name + mission.)

## Mission
Turn "which model / adapter / skill is best for which task" from guesswork into evidence. TSBC designs and runs the benchmark suites, puts every model + adapter + skill combination through its paces cleanly and repeatably, and converts the results into the lane and skill decisions the operating companies run on.

## Remit
- **Suites** — design + maintain benchmark suites per role, per task, and (newly) per single-lane sub-task.
- **Runs** — put models/adapters/skills through the suites; **3-run minimum for decision-grade** (n=1 = directional only); maintain the score ledger (`ledger/results.jsonl`).
- **Skills** — refine + refresh skills; **tag each skill per (model, adapter, task)** — "skill X lifts model Y on task Z by N". This is the core IP.
- **Adapters / MCPs** — test + integrate MCP servers; diagnose + fix adapter issues (the hermes/codex/antigravity lanes).
- **Self-correction** — pull REAL fleet data (live-run quality) back into the suites to refine them and catch drift.
- **Recommendations** — publish the lane/skill picks; MC routes them to the companies (autonomy within the menu).
- **(stretch E)** — productize role-specific skill packs via a basic website.

## Structure
- **Drillmaster (lead)** — designs suites, orchestrates runs, synthesizes results, owns the ledger + recommendations. codex-5.4. *Stood up as the first step of workstream A* (repurpose the paused `Bench-Manager`, grok→codex).
- **Proving ground (subjects)** — the `Bench-<model>` agents, one per model/adapter (claude-opus / opus-4.7, codex-gpt-5.4, gpt-5.5, gemini-pro, grok-4.3 / 4.1-fast / 4-fast / 4.20). They run identical suites so comparisons are fair. Kept as-is.
- **Tooling** — `bench.py` (multi-model eval), `variants.py` (AF×skill grid), `cascade.py`, `costreport.py`, `per_task_compare.py`, `adapter_swap.py`, `make_fleet_agent.py`; registry in `config.json`; results in `ledger/`.

## Operating model
1. A suite is `suite.json` per task class. `bench.py` runs suite × models → ledger.
2. Decision-grade requires ≥3 runs; results below that are flagged directional.
3. Skills are evaluated WITH and WITHOUT, per model/adapter, and tagged with the delta.
4. Recommendations → MC → companies adopt; off-menu deviations need a TSBC run to justify.
5. Concurrency is capped (shared Mac) — heavy runs scheduled off live-sprint windows.

## Roadmap
- **A** — Cheap-model × task × skill **decision matrix** (flagship first run; validates the drafter lanes).
- **C** — Per-single-lane-task benchmarks (chapter prose, hook, SEO copy, application, tag-gen…).
- **D** — Fast-agent **team decomposition** (do 2–3 fast agents split a task better than one drafter?).
- **E** — Skill-pack productization.

## Governance
TSBC is the source of truth for model/skill decisions and re-runs on every new model. Its company is isolated so its 700+ benchmark issues never touch live OpCo boards; all fleet exclusions key off the company **id**, so the rename is safe.
