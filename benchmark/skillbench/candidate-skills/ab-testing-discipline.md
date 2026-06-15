---
name: ab-testing-discipline
description: >
  How to design, run, and read a fair A/B test or before/after experiment so the verdict is real,
  not noise. Use whenever marketing-ops' experiment loop reaches "measure" — testing a title,
  thumbnail, price, page, or listing change. marketing-ops says run an experiment; this stops it lying.
---

# A/B Testing Discipline

A bad experiment ships a false verdict with confidence. This is the rigor under the marketing-ops loop, especially on the small samples a young portfolio actually has.

## Before you start
- **Change ONE variable** (title AND thumbnail = you learn nothing about either).
- **Pre-register the metric + the call** before looking at data (one success metric + the threshold that means "win").
- **Capture the baseline** with its source + date (no baseline = no experiment).

## Running it fairly
- Same conditions both arms (audience, time window, season).
- **Beware tiny samples** — a "30% lift" on a handful of clicks is usually noise. Can't get volume? Use a sequential before/after over a long window + call it *directional*, not proven. State N in the verdict.
- Let it run to the pre-set window (platform reporting lags — peeking early ships noise). Default 2 weeks marketplaces; 48h+7d YouTube packaging.

## Reading it honestly
Compare to the pre-registered threshold, not your hope. Name any confound (price drop elsewhere, seasonal spike, algo shift). Verdict explicit: `double-down` / `kill` / `extend-once` WITH numbers, N, and source. Log kills so the idea isn't silently re-run.

## What's worth testing (high-leverage first)
Packaging (titles/thumbnails), primary CTA/headline on a converting page, price, first listing image. Don't A/B things with no traffic — fix discoverability first. Results feed analytics-finops.
