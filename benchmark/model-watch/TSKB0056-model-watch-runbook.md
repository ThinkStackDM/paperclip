# TSKB0056 — Model-Watch Bench Validity And Refinement Runbook

## Purpose

Prevent TSBC from shipping model verdicts that mix incompatible contexts or stop
at a raw base-model score when the real production lane depends on
instruction-file and skill context.

This runbook applies to every model-watch bench and to any TSBC issue that could
change a live lane.

## Non-negotiable rules

1. Record the verdict class explicitly:
   - `raw_base`: neutralized `bench.py` result, no local agent file, no skills.
   - `benchmark_current`: benchmark-owned `current` prompt packet from
     `variants.json` or an explicit probe override.
   - `live_agentic`: a real Paperclip agent run with a named instructions path
     and runtime skill materialization.
2. Never cite a `raw_base` score as proof that a production lane works with its
   current instruction bundle.
3. Challenger and incumbent must be re-benched in the same batch when the
   verdict could move a live lane. Do not compare a fresh challenger against an
   old incumbent row from a different date, task packet, or context class.
4. Every final keep/reject/adopt call must record both:
   - the raw score
   - the best refined score produced by the post-bench refinement loop
5. Every refinement artifact must preserve source paths and hashes for the
   agent file and skills bundle used.

## Required sequence

### 1. Raw base run

Run the neutralized slice first with `bench.py` or another base harness.

This answers: "what can the model do without our lane context?"

Required closeout fields:

- run ID
- task packet
- compared models
- verdict class `raw_base`

### 2. Provenance check

Before any adoption claim, answer:

- Which instruction file did the run load?
- Which skills bundle did the run load?
- Were they benchmark-owned copies or live company files?
- Are the compared rows from the same batch and same context class?

If any answer is missing, the verdict is audit-incomplete and cannot drive a
lane change.

### 3. Post-bench refinement loop

After the raw score lands, run a bounded refinement loop on the exact tasks that
matter to the adoption decision.

Default bounded loop:

1. `current + none`
2. `current + all`
3. one focused tweak if the lane is still weak
   - tighten the operating file
   - reduce an over-broad skill bundle
   - test one targeted candidate skill per `make-a-skill`

Use `tsbc_task_probe.py` for the refinement pass, with explicit overrides when
the live lane is not the same file bundle that `variants.json` points at.

Example:

```bash
python3 tsbc_task_probe.py \
  --role book-chapter \
  --task-ids chapter-open-in-scene,chapter-no-cliche-open,chapter-show-dont-tell,chapter-pov-tense-discipline,chapter-continuity \
  --models gpt-5.6-luna,gemini-flash \
  --reps 1 \
  --agent-file current \
  --skills all \
  --current-agent-file-path /abs/path/to/live/AGENTS.md \
  --skills-dir-path /abs/path/to/live/runtime-skills
```

The report must preserve:

- agent-file source path
- skills source path
- agent-file sha256
- skills bundle sha256
- prompt packet sha256

### 4. Decide

Use these outcome labels:

- `keep_raw`: raw already wins; refinement did not materially help
- `keep_refined`: only the refined context clears the bar
- `reject`: neither raw nor refined clears the bar
- `rerun`: provenance or incumbent parity is still missing

## Required report shape

Every decision-grade closeout that could move a live lane must include a table
with at least these columns:

| model | context | task pack | n | meanQ | minQ | source paths | source hashes |
|---|---|---|---:|---:|---:|---|---|

`context` must be one of `raw_base`, `benchmark_current`, or `live_agentic`.

## Special rule for incumbents

If a challenger is re-run, the incumbent named in the recommendation must be
re-run in the same batch unless the issue explicitly scopes the work to
directional-only research.

Acceptable exception text:

- `DEVIATION: incumbent unavailable because <named blocker>; final verdict withheld pending rerun`

Without that explicit deviation, the verdict is malformed.
