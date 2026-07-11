# Paperclip Model Benchmark (#15) — active model evaluator

Answers one question per role: **which model should this kind of agent run on?** —
and settles the standing **grok-4.3 vs grok-4.20** guess. Output drives the
data-driven tiering work (#9).

```
role suites  ──►  multi-model runner  ──►  deterministic + LLM-judge scorer  ──►  quality-per-token  ──►  per-role recommendation
<role>/suite.json   claude/codex/gemini/      objective checks + blind judge      tokens = cost proxy      report.md + recommendations.json
                    grok-4.3/grok-4.20                                            (subscription billing)
```

## Quick start

```bash
cd ~/paperclip/benchmark
python3 bench.py list                     # show role suites + task counts
python3 bench.py all --dry-run            # plan + CLI-call estimate, runs nothing
python3 bench.py all                      # full sweep -> results/run-<ts>/
python3 bench.py all --max-tasks-per-role 1   # smoke (1 task/role, all models)
python3 bench.py all --roles intake,engineer
python3 bench.py all --models grok-4.3,grok-4.20   # just the grok showdown
python3 bench.py report run-<ts>          # re-render report from a finished run
```

No pip deps — pure stdlib Python 3.

## Local Ollama model bench (TSBC-727)

The harness now supports direct local Ollama HTTP calls via the `ollama`
adapter in `config.json`. The focused local-model driver reuses the normal TSBC
suites/scoring, but runs a fixed task-type matrix with `n>=3` repeats and emits
variance + throughput (`tok/s`) for the local model.

```bash
cd ~/paperclip/benchmark

# role-appropriate incumbents on the same matrix
python3 local_ollama_eval.py baseline

# qwen first, then gemma, each compared to that baseline run
python3 local_ollama_eval.py local qwen3:8b --compare-to results/ollama-baseline-<ts>/summary.json
python3 local_ollama_eval.py local gemma3:12b --compare-to results/ollama-baseline-<ts>/summary.json

# role-specific WITH-skills reruns against the saved no-skills local base
python3 local_ollama_eval.py --profile qwen_strengths --with-skills \
  local qwen3:8b --compare-to results/ollama-qwen3-8b-<ts>/summary.json
python3 local_ollama_eval.py --profile gemma_strengths --with-skills \
  local gemma3:12b --compare-to results/ollama-gemma3-12b-<ts>/summary.json

# validate the qwen triage-gate classifier on the labelled real-issue set
python3 triage_gate_eval.py --model qwen3:8b
```

Outputs land in `results/ollama-*` and `results/triage-gate-*`.

`local_ollama_eval.py` now supports profile-scoped role skills injected into the
GENERATION prompt only (`--with-skills`). Scoring still uses the bare task, so
the blind judge never sees the skill text. Saved-base comparison is overlap-aware:
the report compares only exact task ids present in the saved base summary and
flags any missing baseline tasks instead of rerunning external incumbents.

## What it measures

Each model is invoked through its own CLI in a **fresh, empty temp working
directory** with config/rules-ignore flags. That neutralizes the local
`CLAUDE.md`/`AGENTS.md`/rules so we measure **base-model capability**, not the
local agent harness. (Measuring the harness — skills/tools — is #16's job.)

| Lane | CLI invocation | token source |
|---|---|---|
| `claude-opus` | `claude -p … --output-format json` | `usage` block |
| `codex-gpt-5.4` | `codex exec … --json -o last.txt` | cumulative JSONL events |
| `gemini-pro` | `gemini -p … -o json` | `stats` block |
| `grok-4.3` / `grok-4.20` | `hermes -z … -m <model>` | `hermes sessions export` JSONL |

The normalized per-run record mirrors Paperclip's `usage_json`
(`inputTokens`/`outputTokens`/`model`/`costUsd`) so the agent-scorecard and
tiering tooling speak the same dialect. Every emitted run record now also
carries `requestedModel`, `responseModel`, `responseModelSource`,
`servingConfirmed`, and `servingValid`. A row without confirmed serving truth
is **INVALID** by definition and is excluded from recommendations / trusted
ledger queries.

## Scoring

Per task, quality ∈ [0,1] blends two layers (`config.json → scoring`):

1. **Deterministic checks** — objective, no LLM. `contains`, `regex`,
   `json_path_equals`, `max_words`, `max_chars`, … (see `scoring.py`).
   Ground-truth tasks (intake routing, failure classification, escalation
   policy) are scored entirely here.
2. **LLM judge** — a single **blind** judge model scores subjective criteria
   (correctness, hook, design quality…) in [0,1]. Blind = never told which model
   produced the answer, applied uniformly → fair *relative* rankings.

**`q/1k-out`** = quality per 1,000 **output** tokens = the primary value metric.
NOT total tokens: total is ~95% fixed CLI system-prompt overhead (claude ~25k base
vs codex ~10k), a harness artifact that would just reward whichever CLI ships the
smallest base prompt rather than the better model. Output tokens are the marginal
generation cost and comparable across CLIs. Set `config.json → recommendation.value_metric`
to `"total"` to rank on total instead.

> ⚠️ Lesson from the first baseline: with easy tasks + a lenient judge, EVERY model
> scored quality ≈ 1.000 (ceiling effect) and the only separator was total-token
> overhead → "codex wins everything" was an artifact, not a result. Discrimination
> comes from (1) failable/trap tasks, (2) a strict judge, (3) the output-token metric.

### Judge choice

The judge defaults to **`claude-opus`** — the sharpest available grader, and it gives
real partial credit (0.8/0.92/0.97) where a lenient judge hands out flat 1.0s. It is a
contestant too, but the judge is blind to which model produced an output and applied
uniformly, so rankings are fair (mild self-preference is the one caveat). To conserve
claude quota, flip `config.json → judge` to `gemini-pro`. `python3 bench.py report
<run-id>` re-aggregates without re-judging; re-run `all` to re-judge.

## The suites (`<role>/suite.json`)

| role | tasks | grounded in |
|---|---|---|
| `intake` | 6 (deterministic) | `mc-compiler-dispatch.py` routing + traps (wrong-parent, false probe flag, strict schema) |
| `engineer` | 6 | failure classify, scorecard SQL bug, prefix router, concurrency-race spot, `staleThresholdMs=0` bug, null-safe normalizer |
| `ops` | 5 | recovery-loop + 3-defect restart-race diagnosis, escalate-after-3, failover routing, pseudo-stop classify |
| `content` | 5 | KDP blurb, launch tweet, forbidden-word trap, exact 3-line structure, tighten-to-40-words |
| `designer` | 5 | grok-imagine prompt, status pill, exact-geometry bar chart, hex palette, accessible badge |
| `qa-verifier` | 8 | release-signoff trap packets: real double-outro/stale-intro, real flat-bars chart render, real system-TTS audio, real harsh-swoosh transition, plus red-gate contradiction, sha-mismatch refusal, missing-promotion refusal, and clean control pass |

Adding a task = appending one object to a suite's `tasks[]`. Task schema:

```jsonc
{
  "id": "unique-id",
  "title": "human label",
  "prompt": "self-contained task text given verbatim to every model",
  "rubric": {
    "deterministic": [ { "type": "json_path_equals", "path": "decision", "value": "cancel", "weight": 5 } ],
    "judge": { "criteria": [ { "name": "correctness", "weight": 3, "guidance": "..." } ] }
  }
}
```

## QA verifier suite (`qa-verifier`)

TSBC-997 adds a verifier-specific suite for the release-signoff role. It uses a
compact `pass` / `reject` / `refuse` packet format plus a 6-row A-G table so the
normal harness can grade the verdict while a verifier-specific post-processor
turns the run into the metrics the operator actually cares about:

- detection rate on known-bad fixtures
- false-pass rate on bad or invalid packets
- refusal discipline on invalid packets
- clean-control pass rate
- evidence quality
- output-token cost proxy per verdict

Run the suite against the requested verifier candidates:

```bash
python3 bench.py all --roles qa-verifier \
  --models codex-gpt-5.4,claude-sonnet,claude-opus,gemini-pro,grok-4.3
```

For the decision-grade TSBC-997 baseline, run the suite three times and then
aggregate the repeats:

```bash
python3 bench.py all --roles qa-verifier \
  --models codex-gpt-5.4,claude-sonnet,claude-opus,grok-4.3
python3 bench.py all --roles qa-verifier \
  --models codex-gpt-5.4,claude-sonnet,claude-opus,grok-4.3
python3 bench.py all --roles qa-verifier \
  --models codex-gpt-5.4,claude-sonnet,claude-opus,grok-4.3
python3 verifier_report.py results/run-<ts1> results/run-<ts2> results/run-<ts3>
```

Render the verifier-specific report:

```bash
python3 verifier_report.py results/run-<ts>
python3 verifier_report.py results/run-<ts1> results/run-<ts2> results/run-<ts3>
python3 verifier_report.py results/run-<ts> --json
```

The full fixture inventory lives in `qa-verifier/trap-manifest.json`. The real
TSM-source bundles exported by [TSBC-998](/TSBC/issues/TSBC-998) now live under
`qa-verifier/fixtures/real/`, with `bundle-manifest.json` files recording the
copied source artifacts and per-file SHA-256 values. The suite now mixes those
real-source reject fixtures with the synthetic refusal/control traps. One
historical black-gap defect on the cashflow chain is still documented only as a
manifest note because the exported black-QA sidecar is already green on the
bundle currently in TSBC scope.

The TSKB-side operational record for the verifier lane lives in
`docs/TSKB/TSKB0055-G8-qa-verifier-trap-suite.md`, including the current model
recommendation plus the Cerberus onboarding and weekly self-test gate.

## Output (`results/run-<ts>/`)

- `raw/<role>__<task>__<model>.json` — every run: output, tokens, scores, errors
- `runs.json` — all runs, flat (`requestedModel` / `responseModel` / serving-validity included)
- `report.md` — human report: overall + per-role tables, recommendations, grok verdict
- `recommendations.json` — machine-readable per-role recommendation → **tiering #9**
  (invalid-serving rows stay visible in the stats, but never drive picks)

`recommendations.json → roles.<role>.recommendation.pick` is the model to tier
that role onto; `roles.<role>.grokHeadToHead` carries the 4.3-vs-4.20 result.

## Consolidated token usage (`usage.py`)

One command, every lane's token usage in one place — input/output/total per model:

```bash
python3 usage.py all                # bench run + gemini + hermes + paperclip DB
python3 usage.py bench [run-id]      # per-model usage from a benchmark run
python3 usage.py gemini --days 7     # gemini CONSUMED usage (the blind lane, solved)
python3 usage.py hermes --days 7     # grok/hermes via `hermes insights`
python3 usage.py paperclip --days 7  # live fleet per-model from heartbeat_runs DB
```

`gemini_usage.py` is the standalone gemini extractor (also importable). Gemini has no
quota endpoint and Paperclip's quota board can't see it, but the CLI persists per-call
tokens to `~/.gemini/tmp/<slug>/chats/session-*.jsonl` (`type=="gemini"` lines,
`.tokens.{input,output,cached,thoughts,total}`). This rolls them up per day/model.
CONSUMED-only — there is no local record of remaining quota (that needs a live Google
Code Assist API call); `~/.gemini/tmp` is best-effort retention, so ingest incrementally.

## #16 Skill-refinement benchmark (`skillbench.py`)

Does a candidate skill actually earn its place? Runs an under-specified task WITH vs
WITHOUT a skill injected, scores both on the same rubric (reusing the #15 engine), and
reports the lift → KEEP / NEUTRAL / DROP.

```bash
python3 skillbench.py                         # all pairs, all models, 2 reps
python3 skillbench.py --pairs ops-restart-race --models claude-opus,gemini-pro
python3 skillbench.py --keep-threshold 0.03
```

- Pairs in `skillbench/pairs.json` pair a candidate skill (`skillbench/candidate-skills/*.md`)
  with a deliberately under-specified task (the methodology the skill teaches is NOT in the
  bare prompt, leaving room to help).
- The skill is injected into the GENERATION prompt only; SCORING uses the bare task so the
  blind judge sees the candidate's OUTPUT and the real objective, never the skill text — we
  measure whether the skill made the ANSWER better, not whether the model parrots the skill.
- Reports lift AND the extra tokens the skill costs (a small lift may not justify a big skill).
- Skillbench / variants / team-decomp result files follow the same serving-truth rule:
  they emit first-class response-model columns, and any cell without confirmed serving truth
  is invalid by definition.
- This is the keep/kill gate for the skill-creator eval loop: iterate the SKILL.md, keep it
  only if it beats baseline.

## Caveats

- **Subscription billing** → `costUsd` is ~0 for most lanes; **tokens are the
  cost proxy**. q/1k is the comparable efficiency metric.
- **Hermes tokens** come from the session store; if export parsing ever fails
  for a run, that run's tokens are **estimated** (`tokensEstimated: true`, flagged
  `(est)` in the report) so cross-lane efficiency stays populated.
- The benchmark measures the **base model**, neutralized of local skills/tools.
  Skill effectiveness is #16 (run a task with vs without a candidate skill on
  these same rubrics).
- Small task counts → treat single-run deltas as directional. Scale up with
  `--max-tasks-per-role` or by adding tasks before making a tiering call on a
  thin margin.
