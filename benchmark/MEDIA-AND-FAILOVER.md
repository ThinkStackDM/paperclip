# Media-gen benchmark + portfolio failover / usage-balancing

_Built 2026-06-14 (overnight autonomous session). Companion to [HANDOFF.md](./HANDOFF.md) and the #15/#16 text lock-in. Purpose: bring image+video into the rollout, then turn the text lock-in + media results + real usage data into one failover/usage-balancing plan so we don't hit session limits or sacrifice quality._

---

## Part A — Image / video generation benchmark

### Lanes tested

| Lane | Invocation | Cost | Latency | Online? | Pool |
|---|---|---|---|---|---|
| **grok-imagine** (image) | `hermes -z "..." -t image_gen` | **$0** | **~13 s** | yes | xAI SuperGrok OAuth |
| **grok-imagine-video** | `hermes -z "..." -t video_gen` | **$0** | ~30–60 s | yes | xAI SuperGrok OAuth |
| **FLUX.1-schnell (local MLX 4-bit)** | `scripts/imagegen/generate-image.sh "..." out.png` (`IMAGE_PROVIDER=local`, default) | **$0** | **~5 min** | **offline / on-device** | local Mac CPU/GPU |
| Cloudflare flux-1-schnell | same script, `IMAGE_PROVIDER=cloudflare` | ~paid | ~secs | yes | CF Workers AI (own token, opt-in) |
| Gemini image | same script, `IMAGE_PROVIDER=gemini` | — | — | yes | **BLOCKED — free-tier quota 0** |

### grok-imagine (image) — verdict: **production-quality, primary lane**

Generated 6 images spanning every OpCo use case. Viewed all 6:

| Use case | Result | Score |
|---|---|---|
| App-icon / logo (isometric stacked layers) | clean, on-brief, brand colours | 9/10 |
| Marketing hero (quant trading desk, teal market-depth) | cinematic, premium, dark-teal, on-brief | 9/10 |
| Book cover (single ceramic mug, negative space) | calm, credible, vast negative space — perfect minimalist cover | 9/10 |
| Product shot (home-office laptop dashboard) | editorial, warm light, shallow DoF — magazine-quality | 9/10 |
| **UI infographic (3-step flow)** | clean cards + icons + arrows **and legible, correct text** ("Ideation Planning", "Step 1: Plan") | **9.5/10** |
| Mascot (friendly robot, flat vector) | exact brand colours, approachable | 9/10 |

**Key finding — text handling is bimodal:** grok-imagine renders **structured/infographic text cleanly and correctly** (the 3-step infographic labels were perfect), but **garbles small text inside photoreal scenes** (chart axis labels on the product-shot laptop were illegible). This is the universal diffusion-text limitation, not grok-specific. → Route any *text-bearing* asset (infographics, posters with copy, slide art) to grok-imagine and it's fine; for photoreal hero shots, treat embedded text as decorative only and overlay real copy in the layout layer.

### grok-imagine-video — verdict: **stock-footage-quality B-roll, primary lane**

Generated an 8 s clip from "slow cinematic push-in on a calm minimalist desk at dawn, steaming coffee, shallow DoF". Output: **1280×720, h264, 24 fps, AAC audio track, 1.8 MB, ~8 s**. Extracted start/mid/end frames:

- **Camera direction followed exactly** — genuine slow push-in (wide → mid → tight close-up).
- Steam animates naturally and continuously; warm window light stays consistent; real shallow-DoF bokeh on the background.
- No flicker / morphing artefacts across the 8 s. Audio track included.

This is usable marketing B-roll out of the box at $0.

### FLUX.1-schnell local — verdict: **good, the offline fallback**

Model present locally (`~/.cache/huggingface/.../FLUX.1-schnell-mflux-4bit`, 8.9 GB). Existing sample = ThinkStack app-icon logo with a **perfectly legible "ThinkStack" wordmark** + clean gradient bar. Quality good, slightly less cinematic than grok, but: **free, unlimited, fully on-device, no quota or session limit ever.** Cost is **~5 min/image of heavy MLX on the shared Mac**, so it competes for the same hardware as the live MLX fleet and these benchmarks. Use for offline/batch/non-urgent work or when the xAI pool is session-capped — **not** during peak fleet load.

### Image/video rollout recommendation

1. **Primary: grok-imagine / grok-imagine-video** for all image + video gen. Best quality, $0, fast, online.
2. **Offline fallback: local FLUX** when xAI is session-capped or the box is offline. Free/unlimited but HW-heavy → schedule off-peak.
3. **Optional cloud burst: Cloudflare flux** (needs `CF_IMAGE_API_TOKEN`+`CF_ACCOUNT_ID`; not configured). Only if we ever need fast + online + xAI-capped simultaneously.
4. **Gemini image: do not use** — free-tier quota is 0.
5. **Text-in-image rule:** grok for infographics/structured text; overlay real copy for photoreal hero text.

---

## Part B — The pools, and what's actually loaded (the balancing problem)

Everything routes into **four subscription pools**. **Token volume ≠ proximity to the limit** — operator reality (davin, 2026-06-14) corrects what the raw 7-day numbers implied:

| Pool | Limit | Real status (operator-confirmed) | Strategy |
|---|---|---|---|
| **Claude** | session, **resets Tuesday** | **STRUCTURALLY TIGHTEST** — we *frequently* hit Claude session limits (historically, pre-improvements). Only temporary headroom this week (early reset). | **Spare it.** Quality peaks + editorial/final-pass + fallback only — never the high-volume lane. Lean in *this week* if needed. |
| **ChatGPT (codex)** | session | **ROOMY** — carried the whole week's load (gpt-5.5 ~954 M/7d) and **did not hit limits**. Only `spark` capped (own lane, exhausts early). | **Workhorse + pressure-release valve.** Don't depend on `spark`. |
| **xAI SuperGrok** | **MONTHLY** | Room now, but **one pool shared by grok text + grok-imagine image + grok-imagine video**. Content/media production is **untested** for our use cases. | Value-champ terse roles + media; **budget as content ramps**; codex is the release valve. |
| **Gemini (Google)** | Google quota | Huge call budget (6327/7d); weak on ops; image quota 0. | Cheap bulk only — **never ops, never image**. |

**The corrected insight:** my first pass read high token-volume as "near the limit" and had it backwards. **ChatGPT carried the load all week without hitting limits — it's the roomy pool, not the strained one. Claude is the structurally tight pool.** So the goal is *not* to offload ChatGPT; it's to **(a) protect Claude** — keep it off volume, reserve it for quality/editorial — and **(b) spread volume across the two roomy lanes (ChatGPT + Grok)**, using Grok-fast where it's the value champ. The catch on Grok: it's a **monthly** pool **shared with image+video**, and content production is untested — so **codex (proven headroom) is the release valve**: as media consumption rises against the Grok monthly budget, shift terse text off Grok onto codex, and/or fall image back to local FLUX.

---

## Part C — Failover & usage-balancing plan (what to use where)

Combines the locked-in per-role text picks (peak-quality / cost-aware, claude-opus judge, 16-model lock-in) with pool load. **Primary → fallback chain per role**, designed so the heavy pool (ChatGPT) is *relieved*, the idle pool (xAI) *absorbs*, and quality peaks (designer/content) stay on Claude.

| Role | Primary (quality + pool-aware) | Fallback 1 | Fallback 2 | Rationale |
|---|---|---|---|---|
| **Engineer** | **Grok-4.1-Fast** (xAI) / **gpt-5.5** (codex) — split | Claude-Opus-4.7 (0.991) | — | both roomy lanes; grok = value champ, codex = headroom. Tilt to codex as Grok media-budget tightens |
| **Intake** | **Grok-4-Fast** (1.000) / gpt-5.4-mini — split | Claude-Opus | — | terse + perfect; spread across the two roomy lanes |
| **Ops** | **Grok-4-Fast** (0.995) / gpt-5.5 — split | Claude-Opus-4.7 | — | **never Gemini** (ops loop: gemini-pro 101.9k-out blowup) |
| **Designer** | **Claude-Sonnet-4.6** | grok-4.3 | gpt-5.5 | quality peak; *low-volume* use of the tight Claude lane is appropriate. Sonnet = cheapest Claude lane |
| **Content — draft** | **Haiku / Gemini-Flash + book-craft skill** | grok-4.3 | gpt-5.4-mini | high-volume drafting on cheap lanes; skill closes the quality gap (see Part D) — keeps drafting *off* the tight Claude lane |
| **Content — final / edit** | **Claude editor pass** (Sonnet-4.6 / Opus-4.7) | grok-4.3 | — | quality gate on the tight lane, but *one pass per deliverable* = low volume. **Not opus-4.8** for word-cap / format-strict work (ignores hard constraints) |
| **Image** | **grok-imagine** | local FLUX (offline) | Cloudflare flux | $0 / fast; FLUX off-peak; **counts against the Grok monthly pool** |
| **Video** | **grok-imagine-video** | local FLUX (stills only) | — | $0; only video lane; **counts against the Grok monthly pool** |

### Standing usage-balancing rules

1. **Protect Claude — it's the tight lane.** We historically hit Claude limits often; treat it as scarce. Quality peaks (designer) + editorial/final-pass (content) + universal fallback only — never the high-volume primary. We can lean in *this week* (early reset, resets Tuesday) but the steady-state must survive Claude being scarce. Sonnet-4.6 = cheapest Claude lane; opus for true peaks.
2. **ChatGPT is the workhorse + release valve.** It carried the week without hitting limits — keep it a primary for terse roles alongside Grok, and use it to absorb overflow from both the tight Claude lane and the media-shared Grok lane. Don't lean on `spark` (own sub-lane, exhausts early).
3. **Budget the Grok monthly pool against media.** Grok text value-roles + grok-imagine image + grok-imagine video all draw one **monthly** pool, and content/media volume is **untested** for us. Default to Grok-fast for terse + grok-imagine for media, but **watch the monthly burn once content production starts** — when it tightens, shift terse text → codex and/or image → local FLUX to reserve Grok budget for video. Re-measure and adjust after the first real content cycle.
4. **Gemini: cheap bulk only, never ops, never image.** Huge call budget (6327/7d) and fine for high-volume low-stakes generation, but it loops/blows up on ops and its image quota is 0.
5. **Serialize the shared subs under concurrency.** `_CODEX_LOCK` (codex) and `_HERMES_LOCK` (grok) prevent the multi-model hangs we hit — keep them on for any batch run.
6. **Don't run 4 models from one sub at once.** The lock-in had to be split into 12 non-codex + 4 codex batches *after* flipping the fleet. Any future multi-codex sweep: pause codex sisters first (fleet flip), or batch sequentially.
7. **Skill attach is conditional.** Knowledge skills (e.g. engineer-batching) lift weak/cheap models +0.19–0.20 but do nothing for already-strong models (ceiling) and can *hurt* them (distraction). Attach a skill only to a model/role below threshold — never globally. (Gemini + a skill blew output 2.6k→11.9k for +0.018 quality.)

### Fleet-flip state (current)

Claude PRIMARY (13 primaries resumed), Codex sisters PAUSED (15). This frees ChatGPT for the codex benchmark batch and is the intended rollout posture (spends Claude weekly quota pre-06-19). To revert: `POST /api/agents/:id/resume` the codex sisters and re-pause claude as desired (loopback, local_trusted, no token).

---

## Open / next

- **Smoke tests + rollout** — wire these per-role primary→fallback chains into the dispatcher and run Paperclip end-to-end smoke tests.
- **Cloudflare image fallback** — configure `CF_IMAGE_API_TOKEN`+`CF_ACCOUNT_ID` if we want a fast online image fallback for when xAI is capped (today FLUX-offline covers it).
- **Session-limit telemetry** — the controller now shows consumed usage per pool; add a soft-threshold alert per pool so failover trips *before* a hard limit, not after.

---

## Part D — TSB book production: cheap-draft → Claude-edit pipeline (validated)

davin's question: *can a skill get the same level of output from haiku/flash?* **Yes — validated.**
Built `skillbench/candidate-skills/content-book-craft.md` (hook-first, concrete specifics,
varied rhythm, kill-AI-tells) and benched it on an under-specified "write the chapter opening"
task (`content-book-craft` pair), claude-opus judge, 2 reps:

| Model | Baseline | + skill | Lift |
|---|---|---|---|
| **gemini-flash** | 0.805 | **0.944** | **+0.139** |
| **claude-haiku** | 0.813 | **0.930** | **+0.117** |
| claude-sonnet | 0.884 | 0.954 | +0.070 |
| grok-4.3 | 0.911 | 0.961 | +0.051 |

**Read:** cheap + skill (0.93–0.94) **beats the strong models' bare baseline** (sonnet 0.884,
grok 0.911) and lands within ~0.01 of strong + skill. Cost ≈ 650 tok/call (modest, deterministic).
Unlike the ops-forensics skill (which *hurt* strong models), book-craft lifts **everyone** — it's
genuine craft knowledge models don't apply by default — so it's safe on every lane, biggest where
it's needed most (the cheap drafting lanes).

**The pipeline (recommended for TSB):**
1. **Draft** — Author agent on **gemini-flash** (or haiku) **+ book-craft skill** → ~0.94 chapters.
   gemini-flash is ideal: cheapest, on the *separate Google pool*, and got the biggest lift
   (+0.139). Keeps high-volume drafting **off the tight Claude lane** entirely.
2. **Edit / final pass** — Editor agent on **Claude** (Sonnet-4.6 for most, Opus-4.7 where it's
   format-strict like KDP metadata — **not opus-4.8**, which ignores hard constraints). Because the
   draft is already ~0.94, the editor *polishes* rather than rewrites → far less Claude spend than
   drafting on Claude directly. **Best of both: cheap volume + a top-model quality gate on the
   final deliverable.**

TSB already has the right org for this: it has distinct **Author** and **Editor** roles (plus
Architect/Researcher/Designer). Wiring: attach book-craft to the Author, set Author model →
gemini-flash, keep Editor on Claude. *(This changes how the book company drafts — staged for
go-ahead before flipping live, since it touches their product output.)*

---

## Part E — Skill audit (corrected)

Two read-only sweeps enumerated all **21 live skills** (files in `~/paperclip/skills/<name>/SKILL.md`,
DB `company_skills`; attached per-agent via `agents.adapter_config.paperclipSkillSync.desiredSkills`).
A first-pass sub-agent flagged ~7 skills as "remove from strong models." **That recommendation was
wrong and I did not act on it** — it mis-applied the #16 finding.

**The distinction that matters:** the "skills hurt strong models" result is about **general
knowledge** a strong model already has (the model knows N+1 query batching; the skill is noise).
It does **not** apply to **system-specific operating runbooks** — a strong model cannot know
Paperclip's internal procedures (the three liveness invariants, `doc/execution-semantics.md`,
board-gated child issues, `$AGENT_HOME` memory layout, the sister-swap protocol) from training.
Removing those would **degrade operations**, not improve them.

Re-classified:

| Category | Skills | Verdict |
|---|---|---|
| **System-specific runbooks — KEEP on any model** | fallback-lane-ops, mc-portfolio-comms, silent-run-review, diagnose-why-work-stopped, para-memory-files, paperclip-converting-plans-to-tasks, + all per-company pipeline-ops (kdp/etsy/content/recruitment/utility/polymarket) | Keep. These are operating instructions, not general knowledge. |
| **Efficiency concern — TRIM (needs confirm)** | the **Paperclip-internals dev bundle**: `paperclip` (29.8KB) + `paperclip-dev` (13.2KB) + `terminal-bench-loop` (25.6KB) + `paperclip-create-agent`/`-plugin` ≈ **83KB** | Bundled onto engineer/CTO agents in **all 5 technical companies**, but only **TSMC develops Paperclip** (TSC=Go trading bot, TSK=SEO sites, TSM=media, TSR=recruitment). ~83KB of token overhead per heartbeat on ~10 non-TSMC technical agents. |

**Finding:** no skill is clearly *hurting output* (the suspected ones are needed runbooks). The real
issue is **efficiency** — the Paperclip-dev bundle on non-Paperclip-dev companies. Trimming it from
non-TSMC technical agents would cut heartbeat token overhead with low risk (reversible: re-add to
`desiredSkills`). **But it hinges on a fact only davin has:** do any non-TSMC technical agents ever
do Paperclip development or create their own agents/plugins? If no → safe to trim. Staged, not applied.

Ready SQL to trim one skill from one agent (template):
```sql
UPDATE agents SET adapter_config = jsonb_set(adapter_config, '{paperclipSkillSync,desiredSkills}',
  (adapter_config->'paperclipSkillSync'->'desiredSkills') - 'paperclipai/paperclip/terminal-bench-loop')
WHERE company_id <> '<TSMC-id>' AND role IN ('engineer','cto') AND status <> 'terminated';
```

---

## Part F — Rollout executed (2026-06-14) + what remains

### Done + verified (live)
- **3 new skills registered** across all 7 companies (mirroring the bundled-skill pattern):
  `make-a-skill` (create→benchmark→roll-out meta-skill) → all cto+ceo (27); `content-book-craft`
  → TSB Author+Editor (2); `escalate-platform-work-to-tsmc` → all non-TSMC engineer/cto/ceo.
- **Dev-build bundle trimmed** (`paperclip-dev`, `terminal-bench-loop`, `paperclip-create-plugin`)
  from ALL non-TSMC active agents (kept on TSMC; kept `paperclip-create-agent` everywhere since
  non-TSMC companies do spin up their own agents). Gated behind the escalate-to-TSMC rule.
- **Roomy ChatGPT lane restored**: resumed 14 paused codex sisters + cleared 2 stale-`error`
  KISS codex sisters → 16 codex agents now idle/available (was: all paused by the benchmark flip).
  Post-resume health clean (0 failed runs; a sister already picked up work). Claude primaries left
  active (Claude has headroom this week) — both lanes now available; no work cancelled.

### The structural gap this surfaced (the big remaining build-out)
Only **CEO/CTO agents have the full 3-lane sister set** (claude + codex + hermes). The **worker
agents** (e.g. TSR ApplicationWriter / JobSourcer / CandidateIntakeSpecialist, TSC Polymarket-
Engineer, etc.) are mostly **single-lane** — no roomy-lane sister to fail over to or to carry load.
So the role-based split ("engineer/intake/ops on Grok+codex, designer/content on Claude") can't be
fully realised until those workers get sisters.

**Remaining (deliberate, larger phase):**
1. **Spin up roomy-lane sisters for worker agents** that lack them (codex and/or hermes), with the
   correct model + the same domain skills as their primary (parity, so failover keeps capability).
2. **Role-based active-primary split** — make the roomy-lane sister the active primary for
   terse/high-volume roles (engineer/researcher/pm/general/cto), keep Claude primary for
   designer/cmo + TSB Author/Editor. This shifts the ~10k-issue/week load off the tight Claude
   lane. It changes assignment on a busy live system, so do it **per-company, canary + verify**,
   not fleet-wide at once. (Pausing an idle primary is clean; pausing a running one cancels its run,
   which re-enqueues.)
3. **TSB cheap-draft lane** (the agreed "next step"): give Author a gemini-flash drafting lane,
   keep Editor on Claude.
4. **Tune hermes sister models** to the value lane (grok-4-fast for terse, grok-4.3 for leadership)
   once the exact model strings are confirmed.
