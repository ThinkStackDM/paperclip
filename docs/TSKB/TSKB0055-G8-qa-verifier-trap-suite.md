# TSKB0055 G8: QA verifier trap suite and onboarding gate

Updated: 2026-07-10

## Purpose

TSBC-997 established the release-signoff verifier benchmark for Cerberus. This
document records the trap suite, the baseline recommendation, and the standing
onboarding/self-test rule for the verifier lane.

## Baseline decision

- Decision-grade repeat aggregate date: 2026-07-10
- Runs aggregated: `run-20260710-141317`, `run-20260710-143521`,
  `run-20260710-152833`
- Recommended verifier model: `codex-gpt-5.4`
- Why: it finished the full suite with `0%` false-pass rate, `100%` defect
  detection, `100%` refusal discipline, `100%` clean-control pass rate, and the
  lowest output-token cost among the fully-safe finishers.
- Highest-evidence alternative: `claude-opus`
- Why not promote it by default: it is safer-looking only on evidence-quality
  margin, not on the killer metric. The current suite shows no safety win over
  `codex-gpt-5.4`, only a cost increase.

## Trap suite inventory

Canonical runnable inventory: `benchmark/qa-verifier/trap-manifest.json`

Current fixture mix:

- Real exported reject bundles:
  - double outro + stale intro/body-title mismatch
  - flat-bars chart render
  - Apple/system-TTS audio
  - harsh-swoosh transition set
- Synthetic integrity/control traps:
  - red gate presented as green
  - sha mismatch refusal
  - missing promotion record refusal
  - clean control pass

Important note:

- The historical late-tail black-gap chain remains documented in the manifest,
  but the exported source-black sidecar currently in TSBC scope is green. That
  defect is therefore tracked as history, not scored as an active reject signal
  in the current bundle.
- The clean control is still synthetic until a genuinely passing exported
  rerender bundle is attached into TSBC scope.

## Cerberus onboarding gate

Cerberus is not trusted for signoff unless the current verifier model passes the
entire trap suite before first live use.

Current onboarding result for the live recommendation:

- Model: `codex-gpt-5.4`
- Result: pass
- Aggregate safety result: `0` false passes across `24` scored cases, `15/15`
  defect detections, `6/6` refusal traps handled correctly, `3/3` clean control
  passes
- Evidence source: `benchmark/results/run-20260710-152833/qa-verifier-report-3run.md`

## Weekly self-test rule

Before Cerberus signoffs are trusted for the week:

1. Run the verifier suite against the current production verifier model.
2. Rebuild the verifier report.
3. Confirm:
   - false-pass rate = `0%`
   - defect detection = `100%`
   - refusal discipline = `100%`
   - clean-control pass rate = `100%`
4. If any check fails, hold live verifier signoff authority until the lane is
   remediated and the suite is green again.

Suggested commands:

```bash
python3 bench.py all --roles qa-verifier --models codex-gpt-5.4
python3 verifier_report.py results/run-<ts>
```

For a decision-grade model swap or fleet rebaseline, use the 3-run aggregate
documented in `benchmark/README.md` rather than a single pass.
