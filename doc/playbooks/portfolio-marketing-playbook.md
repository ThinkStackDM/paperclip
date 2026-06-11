# Portfolio Marketing Playbook

The copy-from master document for marketing across the ThinkStack portfolio. Nothing has been marketed anywhere yet — this playbook is the starting framework every company copies, then adapts. The operational form lives in the `marketing-ops` skill (install it in any company doing marketing work); agent role templates live in `skills/paperclip-create-agent/references/agents/` (`cmo.md`, `contentmarketer.md`, `socialmediamanager.md`, `growthanalyst.md`, plus future roles `financeops.md`, `supportagent.md`, `bizdevsales.md`).

Three portfolio realities are load-bearing everywhere below:

1. **Subscription economics.** Marketing runs on subscriptions we already pay for. No ad spend is assumed anywhere; paid channels exist only after an explicit board budget approval.
2. **The board-approval gate.** Every external publication — listing going live, blog post, social post, outreach email, customer reply — is drafted by agents and approved + posted by the board. Agents never post publicly. "Done" for a marketing deliverable means draft + publish instructions + approval requested.
3. **Costs are runs and tokens.** Experiments and content are budgeted in agent runs, scoped to 4-hour company sprint windows. Cheap-to-test beats impressive-to-run.

## The phases

Phases are sequential per company. A company can be in phase 1 on one channel while phase 0 is still open elsewhere only if the positioning one-pager is done — that gate is absolute.

### Phase 0 — Positioning + ICP (one page, board-approved)

Before any channel work: a single-page positioning document per company — product in one sentence, primary ICP, problem and the customer's current alternative, max three verifiable differentiators, proof we can point at, voice, one-line pitch. Template: `skills/marketing-ops/references/positioning-one-pager.md`. The board approves it; every later marketing issue links it. Cost: roughly one sprint per company. If the proof section is empty, the first marketing job is creating proof (live listings, published work), not reach.

### Phase 1 — Owned channels (free, subscription-powered)

The compounding, zero-cash channels each company already controls:

- **TSB (KDP):** category + keyword optimization, book description as sales page, A+ content, series cross-selling. Amazon ads explicitly deferred to phase 3.
- **DP (Etsy):** listing SEO — titles, all 13 tags, attributes, photo selection for the ICP, description snippets; publish cadence as freshness signal.
- **TSR (recruitment):** job-board listings as marketing surfaces; the $29 CV-polish wedge discoverable at every candidate touchpoint.
- **TSK (utility sites):** the `utility-site-shipping` skill's W0–W4 SEO bundle already owns site-level SEO — follow it. Portfolio adds keyword-driven "which tool next" selection, programmatic page sets, cross-linking under brighttoolstudio.com.
- **TSM (YouTube):** titles, thumbnails, descriptions, tags, chapters; the launch hitlist doubles as keyword research. Within `content-production-ops` YMYL gates.
- **TSC / TSMC:** no consumer marketing motion; excluded from this playbook's rollout.

Channel specifics: `skills/marketing-ops/references/channel-playbooks.md`. Everything in phase 1 runs as experiments — hypothesis → smallest test → measure → double-down/kill — with baselines recorded before changes.

### Phase 2 — Community/social (agents draft, board posts)

Opens per company once phase 1 channels have owners, KPIs, and running experiments. SocialMediaManager maintains a rolling 2-week calendar; drafts are batched so the board approves a week in one sitting. Platform priorities: LinkedIn for TSR, Pinterest-shaped visual social for DP, X/LinkedIn build-in-public for TSK/TSB, YouTube community posts for TSM. Source material is shipped work only — no invented announcements. The never-post-without-approval rule is structural: a post that went out unapproved is an incident.

### Phase 3 — Paid (post-revenue, board-budgeted)

Only after a company has revenue and a phase-1 channel that demonstrably converts (ads pointed at a page that doesn't convert just pay to lose traffic). Each paid motion is a board decision with a named budget, a target metric, and a kill threshold agreed in advance: Amazon ads for TSB, Etsy ads for DP's proven listings, anything else case-by-case. No standing ad budgets — every spend is an experiment with an end date.

## Hiring sequence

Marketing headcount follows proof, not ambition:

1. **CMO at one pilot company first — recommend DP or TSB.** Both have live pipelines closest to revenue (Etsy listings staged/publishing; Book 1 through the KDP gate), so a CMO has product truth to market on day one. Pick one; do not hire two CMOs to start. The pilot CMO runs phase 0 → 1 and proves the weekly-report + experiment cadence.
2. **GrowthAnalyst second**, at the same pilot, once 2–3 experiments are in flight and measurement is the bottleneck.
3. **ContentMarketer third**, when the CMO's backlog of copy/listing work exceeds what fits in CMO sprints.
4. **SocialMediaManager** only when phase 2 opens — not before there is owned-channel proof to amplify.
5. **Copy the proven structure** to the second company (whichever of DP/TSB wasn't the pilot), then TSK/TSM/TSR as their pipelines mature. Reuse the templates; adapt the domain skill attachment.
6. **Future roles, portfolio-level triggers:** **FinanceOps** at first real revenue (the ledger should exist before the second sale); **SupportAgent** at first sustained customer-message volume (Etsy buyers, KDP readers, candidates); **BizDevSales** when TSR is ready for client-side outreach (draft-only, board sends).

## KPIs per company type

One primary KPI per phase per company; weekly report format in `skills/marketing-ops/references/weekly-growth-report.md`.

| Company | Phase 1 KPI | Phase 2 KPI | Revenue KPI |
|---|---|---|---|
| TSB (KDP) | Impressions → page reads per title | Follower/profile growth | Royalties/month |
| DP (Etsy) | Listing views → favorites rate | Social → listing clicks | Orders/month |
| TSR | Qualified candidate signups | LinkedIn post reach → inbound | Wedge orders, then placement fees |
| TSK | Organic clicks per site (GA4/GSC) | — (programmatic SEO is the motion) | AdSense revenue/month |
| TSM | Impressions → CTR → watch time | Subscriber growth | RPM once monetized |

Secondary metrics live in the growth reports; KPIs only change deliberately, with the baseline reset called out.

## How to copy this into a company

1. **Install the `marketing-ops` skill** in the company (board action).
2. **Hire from the templates** in `skills/paperclip-create-agent/references/agents/` per the sequence above — CMO only, to start. Attach `paperclip`, `marketing-ops`, and the company's domain skill (`etsy-listing-ops`, `kdp-publishing-pipeline`, `recruitment-pipeline-ops`, `utility-site-shipping`, or `content-production-ops`).
3. **Create the kickoff issues from this playbook** using the `paperclip-converting-plans-to-tasks` skill: phase 0 positioning one-pager (assignee: CMO; board approval as the gate), then phase 1 channel issues per the company's row above — each with a named owner, the company KPI, and real `blockedByIssueIds` wiring (everything blocks on phase 0). Add the standing weekly growth-report routine.
4. **Phase 2/3 issues are created later, not now** — they are unlocked by phase-1 proof, and pre-creating them just makes noise.
5. **Report upward.** Weekly growth reports go to the company board; TSMC may roll the portfolio's reports into one digest via `mc-portfolio-comms` conventions.
