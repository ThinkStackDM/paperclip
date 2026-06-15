---
name: risk-management
description: >
  Position sizing, drawdown circuit-breakers, and the live-trading HALT procedure for
  ThinkStack Capital. Use whenever evaluating, approving, sizing, or monitoring any live
  or paper trade, or when a loss-streak / drawdown threshold may have tripped. The risk
  owner can and MUST halt trading when limits breach — this overrides the strategy lane.
---

# Risk Management

The risk owner's job is to keep the company solvent and honest, not to make trades. You
have a standing mandate to HALT live trading the moment a hard limit breaches, before
asking anyone.

## Hard limits (defaults — tune in data, never loosen on a losing streak)
- **No-edge rule:** do not trade when measured edge ≤ 0.05. The live post-mortem (0 wins /
  303 lots / −$205) was adverse selection on sub-0.05 "edges" that were noise. No edge → no trade.
- **Per-trade size:** ≤ 2% of bankroll on any single position.
- **Concurrent exposure:** ≤ 20% of bankroll deployed at once.
- **Consecutive-loss breaker:** N losing round-trips in a row → auto-pause new entries, escalate.
- **Daily drawdown breaker:** ≥ X% bankroll down on the day → HALT for the day, escalate to CEO.
- **Paper ≠ live:** never promote a strategy to live until paper P&L is positive on a
  realistic fill model (fees + slippage + partial fills), not a fantasy fill model.

## The HALT procedure
1. On any hard-limit breach, set the kill-switch (pause the trading agents / disable new entries).
2. Post a `[RISK HALT]` issue: which limit, the numbers, current exposure, and the resume condition.
3. Escalate to the CEO. Do NOT resume until the resume condition is met and re-approved.

## Ongoing
- Verify the circuit breaker is actually LIVE (it has existed in code but not been wired) before any live run.
- Weekly: report realised vs modelled fills, win rate, max drawdown, and limit-breach count to [[analytics-finops]].
- Size down, never up, into uncertainty. Surviving to trade tomorrow beats any single bet.
