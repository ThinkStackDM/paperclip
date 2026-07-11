---
name: crypto-trading-ops
description: >
  Pull crypto + market data and run/evaluate PAPER-trading strategies (no real money).
  Use for any task involving exchange prices, klines/OHLCV, backtests, or strategy evaluation on
  Binance and other venues. Names the exact free tools so cheap lanes actually reach for
  them. Data + paper only — never place real-money orders.
---

# Crypto & market data + paper-trading ops

A vetted playbook for **market data and paper-trading** on the trading desk. The strict rule:
**data and paper-trading only — never execute real-money trades, place live orders, or move
funds.** If a task implies live trading with real capital, stop and escalate to a human.

## Tools — name them, don't guess

**`ccxt`** (top pick — unified API for Binance + 100+ exchanges). Use it from a
workspace where `ccxt` is already installed, or install it explicitly into a local
venv/project environment before running strategy code. Use it for live + historical data:
- Live ticker: `exchange.fetch_ticker('BTC/USDT')`
- Candles/OHLCV: `exchange.fetch_ohlcv('ETH/USDT', timeframe='4h', limit=500)`
- Order book / depth: `exchange.fetch_order_book('BTC/USDT')`
Replaces stale local JSON files with a real feed, and future-proofs you to other venues.

**Binance public REST/WebSocket** — no API key needed for public data (`/api/v3/klines`,
`/api/v3/ticker/24hr`, depth streams). Use directly when you want raw Binance endpoints.

**Binance Testnet** (`https://testnet.binance.vision`) — free **paper-trading sandbox** with
fake balances against live market conditions. This is where strategies get validated. Point
`ccxt`'s `binance` with `{'options': {'defaultType': 'spot'}}` and the testnet URLs, using
**testnet** API keys (free from testnet.binance.vision — ask the human to provision them;
they live in env/secrets, never hard-coded). If testnet keys aren't set yet, fall back to
public-data + offline simulation and note that testnet execution is pending keys.

**`yfinance`** — free stocks/ETF/FX data. Use it from a workspace dependency or a
pre-provisioned local environment when you need non-crypto markets.

**`duckdb`** — fast SQL over CSV/parquet/JSON for backtests + analysis
(`duckdb -c "SELECT ... FROM 'klines.parquet'"`). Pair with ccxt to crunch large histories.

## Method

1. **Get data** with `ccxt` (or Binance public API for raw) — never assume; fetch current.
2. **Analyse / backtest** with `duckdb` over the pulled OHLCV; report metrics (PnL, Sharpe,
   max drawdown, win rate) on the SAME bare objective, not cherry-picked windows.
3. **Paper-execute** only on **Binance Testnet** (fake funds). Log every simulated fill.
4. **Never** touch real-money endpoints. Real keys, position limits, and a kill-switch are a
   separate, human-approved decision — this skill does not do live execution.

See the Polymarket paper-trading sibling workflow skill for the prediction-markets counterpart.
