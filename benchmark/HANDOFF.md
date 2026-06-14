# Benchmark — overnight handoff (2026-06-14)

Built the #15 model evaluator and #16 skill bench, solved the gemini blind lane, and
consolidated token usage — all in `~/paperclip/benchmark/`. Everything runs on pure
stdlib Python 3 (no pip). Full per-role results + the grok verdict are below.

## TL;DR

- **The benchmark now discriminates.** The first baseline was useless — every model
  scored quality ≈ 1.000. Root cause: easy tasks + a lenient (gemini) judge, and a value
  metric (total tokens) that was 95% fixed CLI system-prompt overhead. So "codex wins
  everything" was an artifact of base-prompt size. **Fixed** with: harder/failable tasks
  (27 now, up from 12), a strict **claude-opus** judge (real partial credit), and an
  **output-token** value metric.
- **Headline per-role result (135 runs, 0 failures, claude judge):** see table below.
  Codex is the value pick everywhere (genuinely terse *and* accurate); peak quality
  varies by role (claude / grok-4.3 / codex).
- **grok-4.3 vs grok-4.20 — answered:** 4.20 wins 2 roles on quality (engineer, ops) but
  costs ~2× the output tokens. **Default to grok-4.3; reserve grok-4.20 for engineer/ops
  only if its small quality edge is worth 2× tokens.**
- **Real behavioral finding:** claude-opus *ignores hard constraints* (broke the "no title"
  + 60-word cap on the KDP blurb) — scored lowest on content. grok/codex follow caps. Worth
  knowing before tiering content/format-strict work onto claude.
- **Gemini blind lane: solved.** `gemini_usage.py` reads consumed tokens from local session
  history (330M tokens/14d now visible). Consumed-only — no remaining-quota on disk.

## Per-role recommendations (run-20260614-045739, claude judge)

| Role | Best quality | Best value (q/1k-out) | Notes |
|---|---|---|---|
| engineer | **Claude Opus** (0.987) | Codex (7.28) | grok-4.20 edges grok-4.3 (+0.005) |
| designer | **Claude Opus** (0.981) | Codex (6.44) | grok-4.20 burns 3.4k out-tok (reasoning) |
| content  | **Grok 4.3** (0.934)  | Codex (13.2) | claude LOWEST (0.873) — broke hard caps |
| intake   | **Claude Opus** (1.000, tie) | Codex (15.8) | all models 1.000 quality (ground-truth) |
| ops      | **Codex** (0.993)     | Codex (7.63) | grok-4.20 (0.990) ≫ grok-4.3 (0.945) here |

Overall mean quality: Codex 0.971 · Grok-4.20 0.970 · Gemini 0.970 · Grok-4.3 0.965 · Claude 0.952.
(Margins are thin — treat as directional; scale task counts before a high-stakes tiering call.)

`results/run-20260614-045739/recommendations.json` is the machine-readable feed for
data-driven tiering (#9). The gemini-judge baseline is archived at
`results/_archive/` for the judge-leniency comparison.

## The open decision for you

The value metric (q/1k-output) makes **codex the value winner in every role** — it's both
high-quality and by far the tersest (66–271 out-tok vs others' 600–3,400). Two readings:
1. **Codex is genuinely the efficient workhorse** → tier most roles onto codex, reserve
   claude/grok-4.3 for the roles where peak quality matters (engineer/designer = claude;
   content = grok-4.3).
2. **Terseness is over-rewarded** on open-ended/creative tasks → weight quality higher
   (lower the value's influence) before tiering creative work.

Which axis do you want tiering to optimize — value (codex-heavy) or peak quality
(role-specific)? That's the one judgment call I left for you. Everything else is built.

## What's in the box

| File | What |
|---|---|
| `bench.py` | #15 runner: `all` / `report <run>` / `list`. 27 tasks, 5 roles. |
| `<role>/suite.json` | The task suites (engineer/designer/content/intake/ops). |
| `adapters.py` | 5 race-safe model lanes → Paperclip `usage_json` shape. |
| `scoring.py` | deterministic checks + strict blind LLM-judge. |
| `report.py` | aggregation → per-role recommendation + grok verdict. |
| `skillbench.py` | #16: with/without-skill lift → KEEP/NEUTRAL/DROP. |
| `skillbench/` | candidate skills + `pairs.json` (skill ↔ bare task). |
| `usage.py` | consolidated token usage: bench + gemini + hermes + Paperclip DB. |
| `gemini_usage.py` | gemini blind-lane extractor (local session history). |
| `config.json` | models, judge, value metric, scoring weights — all tunable. |
| `README.md` | full docs. |

## Run it

```bash
cd ~/paperclip/benchmark
python3 bench.py report run-20260614-045739    # re-print the headline result
python3 usage.py all                            # consolidated token usage
python3 gemini_usage.py --by model              # gemini consumed usage
python3 skillbench.py --pairs ops-restart-race  # skill lift demo
python3 bench.py all                            # fresh full sweep (~40 min, claude judge)
```

## #16 skill-refinement result (skill-20260614-051256)

Demo: an `ops-liveness-forensics` candidate skill × 2 under-specified ops tasks × 5 models × 2 reps.

| Skill pair | Mean lift | Verdict |
|---|---|---|
| `ops-restart-race` | +0.011 | NEUTRAL |
| `ops-recovery-loop` | −0.056 | DROP |

**The mechanism works — and surfaced a real product insight:** skill value is
**conditional on baseline weakness.**
- The skill **helped the weakest model (gemini)** on both tasks: **+0.062** (restart-race),
  **+0.055** (recovery-loop). grok-4.3 +0.018. That's the proof-of-concept: a skill lifts a
  model that doesn't already nail the task.
- The skill **hurt or didn't help the already-strong models** (claude/codex/grok-4.3 baselines
  0.96–0.99 — no headroom), and actively **degraded grok-4.20** (−0.17): the long skill
  preamble was distraction, not signal, where the model already had the answer.

So the right #16 output isn't a global keep/drop — it's **"attach this skill only for the
models/roles whose baseline is below threshold."** That plugs straight into tiering: weak-lane
agents get the skill; strong-lane agents don't. The eval gate correctly flagged that bolting
this skill onto strong models is net-negative.

**Two harness fixes this demo exposed (both fixed in code for future runs):**
1. A transient `API Error: socket closed` on one claude cell was being scored as quality 0.0;
   skillbench now **excludes infra-failed cells** from lift (a network blip is not a quality
   signal). _(#15 already excluded `ok:false` runs, and that sweep had 0 failures — unaffected.)_
2. The `+tok` skill-cost column was computed from **total** tokens and got swamped by
   output/thoughts variance (the −63k nonsense values). Now computed from the **input**-token
   delta = the skill body's real cost. The numbers in the demo report above are still the old
   total-based values; re-run `skillbench.py` for the corrected input-based cost.

---

## Media gen + failover/usage-balancing (2026-06-14)

See **[MEDIA-AND-FAILOVER.md](./MEDIA-AND-FAILOVER.md)** — full image/video benchmark + the
portfolio failover plan. Headlines:

- **Image:** `grok-imagine` ($0, ~13 s, xAI OAuth) is production-quality across all 6 OpCo use
  cases (logo/hero/book-cover/product/infographic/mascot). Renders **structured infographic text
  cleanly** but garbles small photoreal text → overlay real copy on photoreal heroes.
- **Video:** `grok-imagine-video` ($0, 8 s / 720p / 24fps + audio) followed camera direction
  exactly — stock-footage-quality B-roll out of the box.
- **Offline fallback:** local **FLUX.1-schnell** (MLX 4-bit, free/unlimited/on-device, ~5 min,
  good, legible logo text) — but HW-heavy on the shared Mac → off-peak only. Gemini image = quota 0.
- **Failover insight from live usage:** the **ChatGPT/codex pool is the most-loaded + limit-prone**
  (gpt-5.5 ~954 M/7d), while **xAI SuperGrok is the idle pool** — and the lock-in's value champs
  (Grok-4-Fast/4.1-Fast) win engineer/intake/ops anyway. So shift high-volume terse text **and**
  all image/video onto xAI; keep Claude (now primary, resets 06-19) on designer/content peaks;
  Gemini for cheap bulk only (never ops, never image). Per-role primary→fallback chains in the doc.
