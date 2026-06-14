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

Everything routes into **four subscription pools**, three of which have session/weekly limits. Current real load (live fleet, last 7 d, from `heartbeat_runs` + CLI consumed usage):

| Pool | What runs on it | 7-day load | Headroom | Risk |
|---|---|---|---|---|
| **ChatGPT (codex)** | gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex-spark, `auto` | **~1.6 B tokens** (gpt-5.5 alone 1612 calls / 954 M) | **lowest** | **HIGH** — heaviest load + was the benchmark-contention source |
| **Claude (weekly)** | opus-4-8[1m] (2520 calls), sonnet-4-6 (5646 calls), opus-4-7, haiku | ~13 M out | moderate, **resets 2026-06-19** | MED — now PRIMARY post-flip, will grow; watch the reset |
| **xAI SuperGrok** | grok text (hermes, 472 msgs/7d) **+ grok-imagine image/video** | ~24 M | **highest (under-utilised)** | LOW |
| **Gemini (Google)** | gemini-3-flash-preview (5956 calls!), 3.1-pro, 2.5-flash-lite | 380 M / 6327 calls | separate quota | image BLOCKED; weak on ops |

**The single most important insight:** the ChatGPT/codex pool is carrying the portfolio and is the one that hits limits, while **xAI SuperGrok is the least-loaded pool** — and the text lock-in already found that **Grok-4-Fast / 4.1-Fast are the value champions** (q ≈ 0.96–0.99, ultra-terse 33–127 out-tok) that win **engineer / intake / ops** cost-aware. So we have an under-used pool whose models are independently the right call for our highest-volume role types. **Shifting high-volume terse work off ChatGPT onto xAI is both the quality-optimal and the limit-avoiding move** — they point the same way.

Note grok-imagine shares the xAI pool with grok *text*, but that pool is so lightly loaded (472 text msgs/7d) that adding image/video there still leaves it the roomiest — and crucially it does **not** add to the already-strained ChatGPT or Claude pools.

---

## Part C — Failover & usage-balancing plan (what to use where)

Combines the locked-in per-role text picks (peak-quality / cost-aware, claude-opus judge, 16-model lock-in) with pool load. **Primary → fallback chain per role**, designed so the heavy pool (ChatGPT) is *relieved*, the idle pool (xAI) *absorbs*, and quality peaks (designer/content) stay on Claude.

| Role | Primary (quality+pool-aware) | Fallback 1 | Fallback 2 | Rationale |
|---|---|---|---|---|
| **Engineer** | **Grok-4.1-Fast** (xAI) | Claude-Opus-4.7 (0.991) | gpt-5.5 | value champ; moves volume off ChatGPT |
| **Intake** | **Grok-4-Fast** (xAI, 1.000) | Claude-Opus | gpt-5.4-mini | terse + perfect; xAI headroom |
| **Ops** | **Grok-4-Fast** (xAI, 0.995) | Claude-Opus-4.7 | gpt-5.5 | **never Gemini** (ops loop: gemini-pro 101.9k-out blowup) |
| **Designer** | **Claude-Sonnet-4.6** | grok-4.3 | gpt-5.5 | Claude quality peak; sonnet is high-freq/low-context (5646 calls, tiny input) → cheap on the Claude pool |
| **Content** | **Claude-Opus-4.7** | grok-4.3 | grok-3-mini | Claude quality peak. **Do NOT route format-strict copy (word caps / "no title") to claude-opus-4.8** — it ignores hard constraints; grok/codex obey caps |
| **Image** | **grok-imagine** | local FLUX (offline) | Cloudflare flux | $0/fast; FLUX off-peak |
| **Video** | **grok-imagine-video** | — (no local video lane) | — | $0; only online lane |

### Standing usage-balancing rules

1. **Relieve ChatGPT.** It's the most-loaded + limit-prone pool. Keep gpt-5.5/5.4 as *fallback*, not primary, for the high-volume terse roles (engineer/intake/ops) now that grok-fast matches them on quality. Reserve codex for where it's genuinely best (it was the value winner pre-lock-in and is a strong fallback everywhere).
2. **Absorb on xAI.** It's the idle pool. Land engineer/intake/ops text **and** all image/video here. Monitor that grok *text* + grok-imagine combined stay within SuperGrok session limits (still huge headroom today).
3. **Spend Claude deliberately.** It's PRIMARY post-flip and the weekly quota resets **2026-06-19**. Keep it on its quality peaks (designer/content) and as universal fallback; don't make it the high-volume terse lane. Sonnet-4.6 is the cheap high-frequency Claude lane (low input/call); opus for true quality peaks.
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
