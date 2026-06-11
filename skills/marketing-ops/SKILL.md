---
name: marketing-ops
description: Portfolio marketing process for ThinkStack companies. Use for any "marketing plan", "launch plan", "listing optimization", "content calendar", "growth experiment", "positioning", "SEO pass", or "weekly growth report" issue. Encodes the positioning-first sequence, channel selection by company type (KDP, Etsy, recruitment, utility sites, media), the hypothesis-to-verdict experiment loop, the hard board-approval gate on all external publication, and the weekly growth-report format.
---

# Marketing Ops

The portfolio-wide marketing process. The strategy rationale and phase model live in `doc/playbooks/portfolio-marketing-playbook.md`; this skill is the operational form for doing the work inside a company. Two fleet realities shape everything here: **costs are runs and tokens, not dollars** (no ad spend exists without explicit board budget approval), and **every external publication is a board-approval gate** — agents draft, the board posts. A 4-hour sprint window is the natural unit: scope each marketing deliverable to land inside one.

## Order of operations

Work in this order; do not skip ahead.

1. **Positioning one-pager first.** No channel work, copy, or calendar before a board-approved positioning one-pager exists for the company. Template: `references/positioning-one-pager.md`. Link it from every subsequent marketing issue.
2. **Owned channels.** Listings, SEO, metadata, on-platform optimization — free, compounding, powered by subscriptions we already pay for.
3. **Community/social.** Drafted by agents, posted by the board, only once owned channels are in order.
4. **Paid.** Post-revenue only, board-budgeted, never assumed.

## Channel selection by company type

Detail per channel in `references/channel-playbooks.md`. Defaults:

| Company type | Now (owned, free) | Later (post-proof) |
|---|---|---|
| KDP books (TSB) | Category + keyword optimization, A+ content, book description SEO | Amazon ads (board-budgeted) |
| Etsy print (DP) | Listing SEO: titles, tags, attributes, photos | Etsy ads, Pinterest |
| Recruitment (TSR) | LinkedIn presence drafts, job-board listings | Outbound at scale (BizDevSales) |
| Utility sites (TSK) | Programmatic SEO — the `utility-site-shipping` skill's W0–W4 SEO bundle already covers site-level SEO; follow it, don't duplicate it | Content hub, backlink outreach |
| Media/YouTube (TSM) | YouTube SEO: titles, descriptions, tags, thumbnails, chapters | Shorts repurposing, cross-promo |

A channel is only "active" when it has a named owner, a KPI, and a current experiment.

## The experiment loop

Every marketing initiative runs as an experiment issue:

1. **Hypothesis** — "Changing X will move metric Y because Z." One metric, falsifiable.
2. **Smallest test** — the cheapest version that can disprove it (one listing, not ten; one title pattern, not a rebrand). State the cost in agent runs.
3. **Measure** — GrowthAnalyst records the baseline before launch and the result after a stated window (default 2 weeks for marketplace channels; note platform reporting lag).
4. **Verdict** — explicit `double-down` / `kill` / `extend-once`. Kills are logged with the reason; the same hypothesis doesn't get re-run unknowingly.

No experiment without a baseline. No verdict without numbers and their source.

## Board-approval gate (hard rule)

Anything that leaves the building — listing copy going live, blog posts, social posts, outreach, replies to customers, ads — is drafted by an agent and approved + posted by the board. The deliverable that satisfies "done" is **draft + exact publish instructions + approval request**, never a live publication. Agents must never post publicly; if a tool or credential would allow it, flag it instead of using it. Pre-approved reply templates (support) are the only exception, and each use cites the template.

## Weekly growth report

GrowthAnalyst (or the CMO before that hire) posts one per company per week, board-assigned, even when nothing moved. Full format in `references/weekly-growth-report.md`; the shape:

- **Headline** — one sentence: trajectory and the single most important fact.
- **Funnel numbers** — per active channel: metric, this week, last week, source + retrieval date.
- **Experiments** — running (with time left), closed (with verdict), queued next.
- **Asks** — approvals waiting on the board, data/access gaps, budget requests.
- **Cost** — runs/tokens spent on marketing this week vs. output shipped.

## Issue patterns

- "Marketing plan" / "launch plan" → check positioning one-pager exists (create it first if not), then plan phases 1→3 as issues via `paperclip-converting-plans-to-tasks`, each with owner, KPI, and blocker wiring.
- "Listing optimization" → ContentMarketer reads the domain skill + live listing, drafts changes with before/after and target keyword, approval-gates the publish.
- "Content calendar" → SocialMediaManager maintains a rolling 2-week calendar document; drafts batched for one board approval sitting.
- "Growth experiment" → run the loop above; the issue is not done without a verdict.
