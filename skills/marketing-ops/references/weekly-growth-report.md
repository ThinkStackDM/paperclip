# Weekly Growth Report Format

One report per company per week, posted as an issue (or issue document) assigned to the board. Owner: GrowthAnalyst; the CMO writes it before that hire exists. Ships every week — "nothing moved, here's why" is a valid report; a skipped week is not.

## Template

```md
# Growth report — {{companyName}} — week of {{date}}

## Headline
One sentence: trajectory + the single most important fact this week.

## Funnel
| Channel | Metric | This week | Last week | Δ | Source (retrieved) |
|---|---|---|---|---|---|
| Etsy listings | Views | 530 | 412 | +29% | Etsy stats (2026-06-09) |
| Etsy listings | Orders | 1 | 0 | +1 | Etsy stats (2026-06-09) |
| ... | | | | | |

Unavailable metrics listed explicitly with what's needed to get them.

## Experiments
- **Running:** [ISSUE-ID] hypothesis — N days left in measure window.
- **Closed:** [ISSUE-ID] hypothesis — verdict (double-down / kill / extend-once) + the number that decided it.
- **Queued:** next experiment + cost estimate in runs.

## Asks
- Drafts awaiting board approval (links).
- Data/access gaps (exact export or wiring needed).
- Budget requests, if any (board decision).

## Cost
Marketing runs/tokens spent this week vs. what shipped.
```

## Rules

- **Every number has a source and a retrieval date.** Platform stats lag (Etsy/KDP/YouTube: hours to days) — state the freshness window so verdicts aren't drawn on partial data.
- **No vibes.** "Engagement feels better" does not appear in this report. Unmeasurable claims are listed under Asks as measurement gaps.
- **Week-over-week, same metrics.** Changing what's measured mid-stream resets the baseline; do it deliberately and say so.
- **Short.** The board reads seven of these. Headline + table + verdicts; analysis goes in the experiment issues.
- At portfolio level, TSMC may roll the seven reports into one board digest — same format, one row-block per company.
