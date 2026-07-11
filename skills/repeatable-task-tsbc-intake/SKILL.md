---
name: repeatable-task-tsbc-intake
description: >
  System runbook for detecting repeatable task surfaces and routing them
  through OpCo daily summaries, TSMC consolidated dispatch, and TSBC
  Evaluation Intake instead of leaving benchmark opportunities buried in task
  threads. Use when an agent is about to mark work done, when a manager or CEO
  reviews repeated task classes, or when a weekly audit needs to suggest TSBC
  intake candidates.
---

# Repeatable Task -> OpCo Intake -> TSMC -> TSBC

This is a system runbook, not a craft skill. It encodes portfolio procedure that
models cannot know from training.

## Core rule

If a task surface is likely to recur and the lane, skill-pack, prompt, agent
file, or QA path materially changes cost, quality, reviewer load, or adoption
outcomes, you must create a real routing object before the source issue closes.

A prose comment like "TSBC should look at this later" is not valid routing.

## Default route

The pilot route is:

1. The assignee flags the repeatable surface locally during source-issue
   closeout.
2. The OpCo adds that candidate to a `TSBC candidates` section in its daily
   intake or daily summary.
3. TSMC reviews all OpCo candidate sections, dedupes them, and makes one
   curated daily dispatch decision set.
4. TSMC creates one TSBC parent dispatch task for that day only when at least
   one candidate is accepted.
5. TSBC opens child evaluation issues only for accepted candidates that are
   entering active testing.

Direct TSBC issue creation is reserved for TSMC, OpCo CEOs/managers, or urgent
revenue/customer-quality blockers. The default path is local capture first, then
daily batch consolidation.

## Assignee done check

Before marking an issue `done`, answer these in order:

1. Is this the same class of work I have already done twice in the last 14 days,
   or is it clearly expected to recur at least weekly?
2. Would the result materially change if we changed the model, skill-pack,
   prompt framing, agent file, soul/role file, or QA checklist?
3. Would a better default meaningfully improve cost, quality, speed, reviewer
   correction load, or adoption confidence?
4. Do I have enough evidence to benchmark it honestly: at least two
   production-like examples, or one example plus one known hard trap?

Route the surface when:

- question 1 is yes, or the parent workflow clearly implies weekly reuse;
- question 2 is yes;
- question 3 is yes.

If the first three are yes but question 4 is no, escalate instead of opening a
raw TSBC intake with missing evidence.

## Reviewer-correction trigger

Route or escalate even when recurrence is less obvious if the same reviewer
correction, QA failure, or rework pattern appears at least twice across similar
issues within 7 days.

Examples:

- the same metadata-claim fix across multiple listing reviews;
- the same formatting or trust failure across multiple delivery QA passes;
- the same prompt-structure correction repeated by a manager or CEO.

## Trigger threshold

Open or escalate to TSBC only when all three layers are present:

1. **Recurring surface**
   The task is likely to repeat across assets, customers, or weekly ops.
2. **Sensitivity**
   Model, skill, prompt, agent-file, soul/role, or QA-path choice plausibly
   changes the result enough to matter.
3. **Opportunity**
   There is real cost, quality, throughput, trust, or adoption upside from
   finding a better default.

If one of those layers is missing, keep the work local.

## Required routing action

When the threshold is met, create or update exactly one routing object before
closing the source issue:

### 1. Add a candidate row to the OpCo daily report

Do this by default. The `TSBC candidates` row should name:

- source issue and parent workflow;
- normalized task surface name;
- current baseline lane and pack;
- recurrence evidence;
- success bar and unacceptable failures;
- at least two examples, or one example plus one hard trap when available;
- urgency flag (`routine`, `revenue_blocker`, or `customer_quality_blocker`);
- missing packet fields and the local owner for filling them.

### 2. Create an owned manager/CEO escalation

Do this when the surface qualifies but the packet is incomplete, the OpCo daily
report owner still needs to make the local routing call, or the assignee cannot
place the item into the daily report directly. The escalation must name:

- the suspected repeatable surface;
- what evidence is missing;
- who owns filling the intake packet or daily-report row;
- the deadline or next review window.

### 3. Create TSBC intake or dispatch directly on the reserved path

Do this only when the actor is TSMC, an OpCo CEO/manager, or the surface is an
urgent revenue/customer-quality blocker that cannot wait for the next daily
batch. Supply a real intake packet:

- parent issue and OpCo owner;
- normalized task surface name;
- current baseline lane and pack;
- success bar and unacceptable failures;
- at least two examples, or one example plus one hard trap;
- known constraints;
- requested output (`primary`, `fallback`, `budget`, `premium_scarce`, or
  `no-go`);
- rollout owner after recommendation.

### 4. Update an already-open route object

If the same normalized surface already has an open OpCo daily-report row,
manager escalation, TSMC dispatch item, or TSBC intake for that OpCo, do not
create a duplicate. Add the new evidence there and link it from the source
issue.

## OpCo daily report format

Each pilot OpCo daily intake or daily summary should include a `TSBC
candidates` section. A minimal row should carry:

- normalized surface;
- source issue links;
- recurrence evidence;
- sensitivity/opportunity signal;
- current baseline lane/pack;
- urgency flag;
- packet status (`ready`, `needs_examples`, `needs_owner`, or `hold_local`);
- owner;
- notes / missing evidence.

The row can be short. The point is to make the candidate durable and visible for
TSMC's next batch review instead of opening raw TSBC work from an issue thread.

## TSMC consolidated dispatch format

TSMC should review each day's OpCo `TSBC candidates` sections and produce one
curated decision set:

- dedupe by normalized surface, OpCo, and dominant failure pattern;
- assign priority:
  - `P0` urgent revenue blocker
  - `P1` urgent customer-quality blocker
  - `P2` recurring high-signal benchmark opportunity
  - `P3` watch / not ready
- record one disposition per candidate:
  - `accepted`
  - `held`
  - `rejected`
- capture rationale, next owner, and any missing packet fields.

If at least one candidate is `accepted`, create one TSBC parent dispatch issue
for that day and list each candidate with:

- dedupe key;
- originating OpCo(s);
- normalized surface;
- priority;
- decision (`accepted`, `held`, `rejected`);
- why it received that decision;
- child-evaluation status.

Child-evaluation spin-up rules:

- `accepted`: TSBC may open or update child evaluation issues for active
  testing.
- `held`: no TSBC child issue yet; keep the item with an owner and the exact
  evidence needed to reconsider it.
- `rejected`: no TSBC child issue; record why it stays local or why the surface
  is not a real benchmark target.

## Noise controls

Do not route:

- one-off curiosity tests unless they are urgent revenue/customer-quality
  blockers;
- break-fix work with no repeated surface unless they are urgent
  revenue/customer-quality blockers;
- tasks whose workflow is still changing too fast to benchmark honestly;
- tasks with no stable success bar;
- purely stylistic asks with no repeat-use decision behind them;
- surfaces that already have an active TSBC intake, unless new evidence changes
  the benchmark packet materially.

One-offs and curiosity tests stay local by default.

Default cooldown: one open TSBC intake or escalation per normalized surface per
OpCo at a time.

## Daily OpCo intake gate

Each pilot OpCo manager or CEO should keep a `TSBC candidates` section in the
daily intake / daily summary. The daily queue should include:

- candidates raised during source-issue closeout;
- repeated reviewer-correction classes from the current day;
- older `held` rows still waiting on evidence;
- urgent revenue/customer-quality blockers that may justify direct TSBC
  routing.

Each daily row gets one local disposition:

- `send_to_tsmc`
- `hold_local`
- `drop_local`

The daily section is the default output target for assignee-created candidate
suggestions. Comments alone do not count.

## Weekly manager / CEO review gate

Each pilot OpCo manager or CEO should review the recent `TSBC candidates`
history weekly. The review queue should include:

- normalized task classes that appeared at least twice in the last 14 days;
- repeated reviewer-correction classes that appeared at least twice in the last
  7 days;
- any daily candidate row held for more than 7 days;
- any assignee-created escalation that still lacks a final routing decision.

Each queued row gets one disposition:

- `promote_to_tsmc_batch`
- `keep_local`
- `watch_for_more_reps`

The decision must create or update a real issue when TSBC or a manager owns the
next step. Comments alone do not count.

## Weekly audit routine

Run a lightweight audit once per week on the pilot OpCos.

Inputs:

- issues completed, reviewed, or blocked in the last 14 days;
- issue titles and final comments;
- reviewer / manager correction comments from the last 7 days.

Candidate heuristics:

- same normalized title or task-surface phrase appears at least twice;
- same reviewer correction phrase appears at least twice;
- same baseline lane is used repeatedly on a surface that still causes rework;
- the issue description or comment explicitly names a repeated QA or routing
  problem.

Suggested output fields:

- OpCo
- normalized surface
- sample issues
- recurrence evidence
- sensitivity signal
- opportunity signal
- suggested route
- owner
- notes / missing packet fields

The audit output should feed the next OpCo daily intake / daily summary, not
open raw TSBC work directly, unless the operator is using the reserved TSMC or
urgent-blocker direct path above.

## Pilot scope

Start with the highest-signal QA and review surfaces from the 2026-07-06 TSBC
sprint:

1. AroidAtlas listing trust QA and Pinterest packaging QA
2. ThinkStack Books listing / review-funnel QA
3. TSR CV-delivery fallback QA

Defer the broader distribution-copy surfaces to a second wave until the pilot
proves the noise controls hold.

Attach this runbook first to:

- managers or CEOs who review those surfaces;
- QA / review lanes that repeatedly perform those checks;
- any benchmark or routing manager responsible for opening TSBC intake.

## Pilot-to-rollout ownership

- Pilot evidence owner: Bench-Manager
- Shared-skill publication and all-agent attach owner after pilot:
  Mission Control / GLaD0S

Until shared publication happens, this runbook remains a draft skill source and
pilot-install candidate.
