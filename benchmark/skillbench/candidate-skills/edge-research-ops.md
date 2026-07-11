---
name: edge-research-ops
description: >
  How ThinkStack Capital defines, tests, and graduates a trading edge in any market.
  Use whenever proposing, evaluating, measuring, or reporting on a strategy or market
  opportunity before writing analysis or placing any paper/live order.
---

# Edge Research Ops

At TSC, edge work is fund work, not vibes. The job is to define a hypothesis tightly, measure it
with the most honest estimator available, and graduate it only when the after-fee, after-tax case
survives pre-registered checkpoints.

## The five rules

1. **Registry or it does not exist.** Every hypothesis must become a row in `TSKB0050` before real
   work starts: market/cell, mechanism, entry/exit, fee-adjusted breakeven, sample size, kill
   criterion, tax bucket, fee schedule, and self-funding path. No row means no edge.
2. **Compare in-pocket, not gross.** State results as `EV_net`, not just raw edge:
   `(gross edge - fees - slippage - spread - FX/withdrawal costs) x (1 - effective tax) - funding costs`.
   Report both gross and net when relevant, but decide on net.
3. **Trust estimators in this order: live > realistic paper > offline/backtest.** Offline numbers
   were 2x-5x too optimistic on Rocky because informed flow selects our fills. Do not size, promote,
   or celebrate off an offline number alone. If paper and live disagree by more than about `1.3x`,
   fix the model before trusting any conclusion.
4. **Pre-register, then stop touching it.** Before a test starts, write the checkpoints, promote
   bar, and kill criterion. Mid-test tuning resets the test. A checkpoint kill is a process success:
   write the epitaph and move on.
5. **Variance is not a signal.** Losing streaks are expected at low base rates. Use statistical
   guards, spend caps, and experiment budgets; do not re-interpret red days or lot streaks as
   meaning anything unless a pre-registered guard or checkpoint is hit.

## Graduation ladder

No rung-skipping:

`idea -> defined registry row -> data/paper -> pre-registered paper test -> board approval -> mini-live -> sized`

- The size step is its own test; thin books kill edges at scale.
- Board approval is mandatory before live money.
- Self-funding is the default; scaling is bought by realised in-pocket profit.

## What a good answer must do

- Name the exact market/cell and the mechanism: why would this be mispriced?
- Separate estimator quality from strategy quality.
- Quote sample size, checkpoint cadence, and kill criterion.
- State fee/tax/funding assumptions explicitly.
- Treat noise as noise; only guards and checkpoints are decision surfaces.

## Hard constraints

- Paper/data first.
- Live money only after board approval on a passed pre-registered test.
- `risk-management` hard limits and Sentinel halt authority always apply.
- No API spend.
- Default to self-funding; credit requires a written board exception.
- Keep reports factual and low-noise.
