# TSBC-1077 — Grok 4.5 EU Engineer Packet

Date: 2026-07-17
Issue: [TSBC-1077](/TSBC/issues/TSBC-1077)
Parent: [TSBC-987](/TSBC/issues/TSBC-987)

## Summary

Friday, July 17, 2026 was the first day the Ireland `grok.com` lane was
provably callable for `grok-4.5`. I restored the direct `grok` benchmark path
in `benchmark/adapters.py`, registered `grok-4.5` as an opt-in catalog model in
`benchmark/config.json`, and ran a same-batch decision packet against the
flagship Codex and Claude baselines on the engineer surface.

Headline result:

- `grok-4.5` is competitive in `raw_base`, but it fails the current engineer
  packet badly.
- Raw base (`bare+none`) on the Friday, July 17, 2026 engineer slice:
  `grok-4.5 meanQ 0.941 / minQ 0.766`, versus `gpt-5.6-sol 0.952 / 0.919` and
  `claude-opus-4-8 0.954 / 0.883`.
- Refined `current+none`: `grok-4.5` collapsed to `meanQ 0.393 / minQ 0.071`
  with `8/9` successful cells.
- Refined `current+all`: `grok-4.5` collapsed further to `meanQ 0.180 / minQ 0.000`
  with only `7/9` successful cells.

Recommendation:

- Reject `grok-4.5` for the current engineer / agentic lane on Friday,
  July 17, 2026.
- No drafter-lock change.
- Do not add `grok-4.5` to the sister registry for Codex/Opus engineering lanes.

## Method

Task packet:

- `eng-token-normalizer`
- `eng-flaky-test-diagnose`
- `eng-unsafe-migration`

Models:

- `grok-4.5` via direct `grok.com` CLI lane
- `gpt-5.6-sol`
- `claude-opus-4-8`

Contexts:

1. `raw_base` = `bare + none`
2. `benchmark_current` = `current + none`
3. `benchmark_current` = `current + all`

Every compared cell ran `3` reps on the same Friday, July 17, 2026 suite hash:

- suite sha256:
  `b7373c2152d432ffadaa313c61133d110457a1e56402bf122dab21c5460d183f`

Direct `grok` caveat:

- the `grok` CLI still emits no usage block, so `inputTokens` / `outputTokens`
  on `grok-4.5` rows are estimated by the harness (`~4 chars/token`).
- This does not affect the quality verdict, but it weakens token-efficiency
  precision versus Hermes/Codex/Claude rows.

## Aggregate Results

| context | model | ok | meanQ | minQ | meanOut | q/1k-out | run |
|---|---|---:|---:|---:|---:|---:|---|
| `raw_base` | `claude-opus-4-8` | `9/9` | `0.954` | `0.883` | `668.1` | `2.094` | `probe-20260717-075519` |
| `raw_base` | `gpt-5.6-sol` | `9/9` | `0.952` | `0.919` | `254.7` | `4.504` | `probe-20260717-075519` |
| `raw_base` | `grok-4.5` | `9/9` | `0.941` | `0.766` | `239.9` | `4.360` | `probe-20260717-075519` |
| `current+none` | `claude-opus-4-8` | `9/9` | `0.967` | `0.876` | `725.6` | `1.749` | `probe-20260717-080408` |
| `current+none` | `gpt-5.6-sol` | `9/9` | `0.938` | `0.857` | `267.8` | `4.938` | `probe-20260717-080408` |
| `current+none` | `grok-4.5` | `8/9` | `0.393` | `0.071` | `77.8` | `3.890` | `probe-20260717-080408` |
| `current+all` | `claude-opus-4-8` | `9/9` | `0.942` | `0.855` | `583.2` | `2.069` | `probe-20260717-081234` |
| `current+all` | `gpt-5.6-sol` | `9/9` | `0.954` | `0.919` | `245.4` | `4.753` | `probe-20260717-081234` |
| `current+all` | `grok-4.5` | `7/9` | `0.180` | `0.000` | `40.7` | `2.737` | `probe-20260717-081234` |

## Why Grok 4.5 Failed The Refined Packet

The raw records show a concrete failure mode, not just a low score:

- under `current+none`, `grok-4.5` answered the diagnosis and migration tasks
  with meta-process text such as:
  `Analyzing the flaky concurrent ranking test and checking for any Paperclip wake context.`
  and
  `I'll follow the Paperclip heartbeat procedure and review this migration for production safety.`
- under `current+all`, it degraded further into empty or near-empty responses,
  plus more heartbeat/procedure narration instead of solving the engineer task.

Interpretation:

- the current engineer operating file and full runtime bundle are a bad fit for
  `grok-4.5` on this single-shot benchmark path.
- Codex and Claude continued answering the engineer tasks directly under the same
  packet; Grok 4.5 got captured by the Paperclip heartbeat scaffolding.
- That is a legitimate lane-fit failure for the current engineer packet on
  Friday, July 17, 2026, even if the base model itself is strong.

Per-task `grok-4.5` pattern:

| context | token-normalizer | flaky-test | unsafe-migration |
|---|---:|---:|---:|
| `raw_base` | `0.997 / min 0.990` | `0.983 / 0.983` | `0.845 / 0.766` |
| `current+none` | `1.000 / 1.000` | `0.083 / 0.083` | `0.095 / 0.071` |
| `current+all` | `0.328 / 0.000` | `0.139 / 0.083` | `0.071 / 0.071` |

## Adoption Implications

### Bench matrix

- Accept `grok-4.5` as a callable catalog row on the direct EU `grok.com` lane.
- Record the engineer verdict as:
  raw promising, refined reject.
- Do not present the raw `0.941` row as proof that the live engineer lane is
  safe; the refined packet disproves that.

### Drafter locks

- No drafter-lock implication from this packet.
- This benchmark only covers the engineer surface.
- Friday, July 17, 2026 data is not permission to move any content/book/social
  rows toward `grok-4.5`.

### Sister registry

- Do not add `grok-4.5` as a Codex/Opus engineer fallback on Friday, July 17, 2026.
- Keep the existing engineer sister ordering unchanged.
- If `grok-4.5` is revisited later, require one of:
  - a Grok-specific engineer operating file that does not derail into heartbeat
    procedure behavior, or
  - a real `live_agentic` Grok-local proof run that survives the full Paperclip
    execution loop on the intended lane.

## Deviation

DEVIATION:

- I did not rerun `grok-build` in the same Friday, July 17, 2026 batch.
- Any within-xAI ranking claim beyond this exact Codex/Opus engineer comparison
  therefore remains directional only.
- The July 10 `grok-build` engineer signal can still be cited as historical
  context, but not as a same-batch overwrite.

## TSBC Fairness Closeout

- Fairness verdict: `pass_with_caveat`
- Evidence depth: `decision_grade`
- Run IDs:
  - `probe-20260717-075519`
  - `probe-20260717-080408`
  - `probe-20260717-081234`
- Repetitions per compared cell: `3`
- Low-tail / min-score note:
  - `grok-4.5` raw min = `0.766`
  - `grok-4.5 current+none` min = `0.071`
  - `grok-4.5 current+all` min = `0.000`
  - the refined lows are real packet-level collapses, not narrow token truncation
- Token / cost / runtime caveat:
  - `grok-4.5` token usage is estimated on the direct Grok lane
  - Codex and Claude token rows are CLI-native
- Scorer lane: `claude-opus`
- Scorer calibration status: `pass_with_caveat`
- Calibration set:
  `not_preserved:no dedicated July 17 calibration anchor packet was run; this closeout relies on the standing engineer suite rubric and blind judge behavior already in use by TSBC`
- Tie-break owner: `Bench-Manager`
- Scorer caveat:
  blind Claude judging is acceptable for relative ordering here, but the direct
  Grok refined failure is strong enough that human review is only needed if a
  board user wants to challenge the prompt-packet fairness rather than the lane fit
- Fingerprint:
  `TSBC:engineer:grok-4.5-eu:probe-20260717-075519+080408+081234:2026-07-17`
- Model version(s): `grok-4.5, gpt-5.6-sol, claude-opus-4-8`
- Scorer/rubric version:
  `engineer/suite.json sha256 b7373c2152d432ffadaa313c61133d110457a1e56402bf122dab21c5460d183f + judge claude-opus + prompt hashes 329a37bb92eb3f629d42411fcf070746b53b85d60787433e6b137119810aa953 / 1d417bd05e262827af232f15bbce350b0ee7cefd57685f780a0e1ecff6b7c15a / e37a47b7504e661717b4c57385487b50777be35d425d1b967b9496f0a8f18980`
- Environment:
  `TSBC task-probe harness on Friday, July 17, 2026; role=engineer; contexts=bare+none,current+none,current+all`
- Records path:
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-075519/report.md`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-075519/records.json`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-075519/summary.json`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-080408/report.md`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-080408/records.json`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-080408/summary.json`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-081234/report.md`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-081234/records.json`
  - `/Users/glad0s/paperclip/benchmark/results/probe-20260717-081234/summary.json`
- Failure-library IDs: `none`
- Next gate: `reject`
