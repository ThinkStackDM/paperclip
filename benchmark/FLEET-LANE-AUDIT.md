# Fleet lane audit — 2026-06-21

Per-company map of agent → role → lane/model, redundancy gaps, model stragglers, and
the front-line/single-lane-optimisation plan. Charter: [[THIAAAA-59-ROLLOUT.md]].

## Where the fleet stands (after today's re-laning)

- **Management trios are solid:** every CEO (and the 3 CTOs) = claude-opus-4.8 primary (parked) + gpt-5.4 Codex sister (active primary) + grok-4.3 Hermes sister. Cross-pack, top-tier both sides.
- **Codex worker lane = gpt-5.4** everywhere except Media's 3 (Coder-Codex, ContentStrategist-Codex, Showrunner — still gpt-5.5, auto-bumped 00:15 post-sprint).
- **Content/general workers = claude-sonnet-4-6** primaries, most with a gpt-5.4 Codex sister.
- **Media-gen lane = grok-4.3** (Designer-Media ×7) — correct, grok owns image/video.
- **Capital = grok-4.3** across the board — HELD (sensitive quant).

## Redundancy gaps — single-lane agents (no fallback sister)

| priority | company | agent | model | why it matters |
|---|---|---|---|---|
| **HIGH** | TSMC | **Ledger** | opus (running) | platform finance/usage ledger, always-on, zero fallback |
| **HIGH** | TSMC | **Auditor** | opus | governance/audit, zero fallback |
| **HIGH** | Media | **Frame, Storyboard** | sonnet | active production company; design/storyboard hands are single-lane |
| MED | Media | **Showrunner** | gpt-5.4 | production orchestration, single-lane |
| MED | Books | Press, Quill | gpt-5.4 / sonnet | publish + prose, single-lane |
| MED | KISS | Crawler, Scribe | gpt-5.4 / sonnet | ingest + writing, single-lane |
| MED | DP | Tagsmith | gpt-5.4 | listing tags, single-lane |
| LOW | DP/Recruit | Concierge, Liaison | sonnet | light comms |
| — | Capital | Quant, Sentinel | opus | single-lane but HELD |
| ⚠ | Capital | Compiler / Engineer / PolymarketEngineer | grok + grok | "redundancy" is grok+grok — **same pack**, not cross-pack; if xAI flakes both fail |
| cleanup | Media | Content-Repurposing-Hermes | grok | orphan `-Hermes` sister with no primary lane |

## Single-lane optimisation (tiered: fast draft → agentic ship)

Each company has one recurring high-volume task where a **cheap fast lane drafts** and the
**agentic lane ships/QAs** — the Books pilot pattern, generalised:

| company | recurring task | draft tier (fast) | ship/QA tier (agentic) |
|---|---|---|---|
| Books | chapter/book production | gemini-flash / grok-4.1-fast | Forge codex-5.4 + Editor |
| Media | video script → packaging | gemini-flash (scripts) | Coder/Prometheus codex-5.4 + render |
| KISS | SEO content / utility sites | gemini-flash (keyword/copy) | GrowthSEO gemini-pro/codex-5.4 |
| Recruitment | application writing / sourcing | grok-4.1-fast (drafts) | ApplicationWriter codex-5.4 |
| DP | listing copy / tags | grok-4.1-fast | BrandDesigner codex-5.4 |

Fast lanes are a **draft sub-step inside the role**, not the agent's primary model (fast models
collapse on agentic orchestration: grok-4.1-fast agentic = 0.444).

## Proposed front-line hires (prioritised)

Pattern: add a **gpt-5.4 Codex sister** (cross-pack fallback) to each single-lane worker that
does text/ops/agentic work; keep visual work on claude-sonnet/grok. Tool: `make_fleet_agent.py`.

1. **GrowthSEO-Codex (KISS)** — ✅ DONE (gemini-pro → codex-5.4 → grok fallback trio).
2. **Ledger-Codex, Auditor-Codex (TSMC)** — redundancy for the two critical always-on platform agents.
3. **Frame-Codex, Storyboard-Codex (Media)** — keep the active production line moving when Claude is busy.
4. **Press-Codex (Books), Crawler/Scribe sisters (KISS), Tagsmith-Codex (DP)** — worker redundancy.
5. **Capital:** convert one of each grok+grok pair's `-Hermes` to a codex sister for true cross-pack — DEFERRED (Capital held; flag for davin).
6. **Cleanup:** retire or re-primary the Media `Content-Repurposing-Hermes` orphan.

Near-term "bake in now": every new sister gets the full engineer/ops skill bundle + the company
ops skills (issue-handling, context-compression, skill-stewardship) so it's a complete worker on
day one (as GrowthSEO-Codex was).
