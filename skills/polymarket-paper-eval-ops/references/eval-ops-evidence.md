# Capital eval-ops evidence (ThinkStack Capital, company 211e0f96)

Identifiers are THIA-*.

## Recurring issue volumes (mined 2026-06-11)
- "Polymarket live paper eval pass (THIA-31)" — ~250 instances since 2026-05-26 (hourly routine). Done when run; cancelled in bulk during the 2026-06-05..06-09 session-limit window (eval passes don't backfill — cancelling missed windows is correct).
- "Daily Polymarket --resolve: calibration dataset update" — daily; "Polymarket weekly P&L report (THIA-31)" + "Polymarket weekly wallet scanner (THIA-56)" — weekly.
- "THIA-15 daily paper-trade health check" / "THIA-17 daily paper-trade health check" — daily.

## Eval-pass routine description of record (verbatim contract)
Run from `/Users/glad0s/.paperclip/instances/default/projects/211e0f96-.../1421cac9-989b-4eb7-8e02-9da5af943faa/_default`:
1. `uv run python scripts/poly_paper_eval.py`
2. capture stdout/stderr + exit code
3. exit 1 = kill switch fired (script already escalated THIA-31 → CEO); 2 = fatal (post error to THIA-31); 0 = script re-anchors THIA-31 (PATCH in_progress, assigneeAgentId=7b697537-85f2-4f8f-9dba-cf5af2de162b)
"IMPORTANT: The re-anchor in step 5 prevents recovery scanner loops — do not remove it."

## Canonical good close (real example)
"Eval pass complete (exit 0). Settled this pass: 0 / Entered: 0 / Open positions: 5 / Equity: $151.00 | Cash: $113.50 / Kill switch: not fired / CLOB enrichment: 83 active longshot candidates scanned. THIA-31 re-anchor skipped — in_review with board/user; script deferred correctly."

## Daily resolve evidence
- THIA-185 (2026-05-30): exit 1, 0 resolved, N≥30 not reached, 88 markets, 5 expired+pending; output posted to THIA-30.
- THIA-650/1025: expired markets returning `None` from Gamma = pending on-chain settlement, not an error.

## Weekly P&L evidence
- THIA-1153 (2026-06-01): 8 trades, realized +$0.99 on $150, MTM -$4.19, win rate 2/2 with "CI crosses zero (sample too small)", kill-switch inactive, max 7-day drawdown 0.7%. "Sample size 2 < 30; Phase 2 discussion gated per THIA-31 acceptance criteria." Script fix: POST timeout 15s → 30s.

## THIA-17 crash history (ETH MeanRev paper loop)
- THIA-253 — Bug 1: SIGTERM handler `task.cancel()` → CancelledError escaped `except Exception` → exit 1 → supervisor restart loop (10s) re-processing the 00:00 bar and rewriting the daily report. Bug 2: health-check heartbeat spawned a duplicate supervisor. Evidence file: `logs/paper-meanrev-eth/paper-trade.stderr`. Fix commit 7a5a464 lineage.
- THIA-1360 — THIA-253 fix incomplete: `except asyncio.CancelledError: pass` in `_run_loop` turned an external SIGTERM into exit 0 → supervisor saw clean exit and stopped; SIGHUP from tmux kill bypassed the EXIT trap → stale lock. Fix commit 8c40ad6. Python 3.12 gotcha: `str(TimeoutError())` == "".
- THIA-243/247/etc — `long_active_duration` watchdog friction on the 30-day observation; corrected approach: PATCH `executionPolicy.monitor` to set `monitorNextCheckAt`; suppression issue "Suppress long_active_duration trigger for THIA-17 (30-day observation)".
- "Restart MeanRevZScore ETH/USD 4h paper-trade loop (supervisor PID dead)" + "Recertify first-$1 soak: clear THIA-17 stale block + restart stale ETH MeanRev paper loop" — stale-supervisor recovery shape.

## Strategy/context anchors
- THIA-31 — live paper trading vs real CLOB, $150 virtual (longshot-fade strategy; filter integration + 90-day backtest gate on THIA-31 filter issue).
- THIA-30 — calibration dataset hub (daily resolve output lands here).
- THIA-56 — wallet scanner (read-only, weekly).
- Existing company skill `polygun-mcp` covers the PolyGun MCP integration — do not duplicate it.
