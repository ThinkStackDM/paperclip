# Agent QA Pack Guide

## What This Pack Is

The Agent QA Pack is a small operating kit for teams that use AI to draft,
check, or ship recurring work. It does not try to automate judgment. It gives
you a few reusable patterns so quality review stops being improvised.

This pack focuses on four practical assets:

1. a final-pass ship checklist;
2. a report contract for evidence and verdicts;
3. a bounded benchmark loop pattern; and
4. a QA-gate library for deciding when to ship, stop, or escalate.

## Who It Is For

Use this if you already have recurring deliverables such as:

- landing pages;
- reports;
- listings;
- support macros;
- internal tools; or
- prompt or workflow packs.

It is most useful when one person or one lead still owns the final call and
needs better evidence from AI-assisted contributors.

## What It Will Not Do

This pack will not:

- replace human review for public claims, security, payments, or compliance;
- choose your scoring rubric for you;
- guarantee market demand; or
- make your internal prompts transferable without editing.

## The Four Assets

### 1. Ship-It QA Checklist

Use this at the end of the work, not the beginning. The job is simple: stop
teams from calling something done when the artifact is missing, the scope
drifted, or the claims outran the evidence.

Best for:

- final review before a customer sees the output;
- issue closeout;
- release packaging;
- approval packets.

### 2. PDF Report Contract Template

This is the backbone for explainable decisions. The template forces the same
sequence every time:

1. what you were trying to prove;
2. how you tested it;
3. what the evidence says; and
4. what decision follows.

Best for:

- benchmark closeouts;
- quality audits;
- launch-readiness checks;
- model or workflow comparisons.

### 3. Terminal-Bench Loop Pattern

This is a bounded loop for evaluation work. It exists to stop endless
"one-more-run" drift. The pattern forces a clear candidate set, a fixed judge,
preserved evidence, and explicit stop rules.

Best for:

- workflow bake-offs;
- prompt evaluations;
- lane-routing decisions;
- regression checks after a fix.

### 4. Generic QA Gate Patterns

These gates convert fuzzy approval language into named checkpoints. A team can
say "this is blocked on evidence gate" or "this is pending claims gate review"
instead of hiding uncertainty behind status churn.

Best for:

- small AI teams without a formal QA manager;
- mixed human + AI delivery workflows;
- cases where shipping is cheap but trust damage is expensive.

## How To Adopt In One Afternoon

### Step 1. Pick one recurring deliverable

Choose something frequent enough to matter and important enough to justify a
review step. Good first candidates:

- a weekly report;
- a storefront listing pack;
- a public-facing page;
- a support workflow;
- an internal benchmark note.

### Step 2. Name the approval owner

Every pattern in this pack assumes there is a real person or explicit decision
gate at the end. If no one owns approval, the process will collapse into
performative paperwork.

### Step 3. Install the checklist at the end of the flow

Do not expand it into a giant project-management ritual. Keep it close to the
finish line. The checklist is a brake, not a second roadmap.

### Step 4. Require the report template for claims

Any recommendation that changes spend, launch posture, public wording, or model
choice should leave a short report with preserved evidence. This prevents
unsupported claims from becoming institutional memory.

### Step 5. Use the bench loop only for bounded decisions

The loop is for questions like:

- which lane handles this task better;
- whether a fix materially improved output;
- whether a new workflow is ready for live use.

It is not for broad product discovery or open-ended ideation.

### Step 6. Keep the gate names stable

Once you adopt gate names, do not rename them every week. Repetition is the
feature. Stable gates make team language sharper.

## Suggested Minimal Policy

If you want the smallest useful operating rule set, start here:

1. No public claim without a report.
2. No "done" status without an inspectable artifact.
3. No launch without a named approver.
4. No benchmark verdict without preserved evidence.
5. No rerun loop without a stop rule.

## Common Failure Modes

### The checklist becomes a dumping ground

If the checklist keeps growing, move discovery and planning questions out of
it. The checklist should remain a final-pass tool.

### Reports become too long to read

If a reviewer cannot skim the hypothesis, method, data, and verdict in a few
minutes, the report is doing too much. Preserve raw evidence separately.

### Bench loops drift into hobby work

If the loop has no timebox, no candidate limit, or no decision owner, stop.
That is analysis sprawl, not QA.

### "Approval" exists only in prose

If the team says "ready for review" but no actual person, ticket, or decision
card owns the next step, work will strand. Convert the handoff into a real
state change.

## Adaptation Note

This pack was built inside a task-driven Claude-agent workflow. The logic is
portable; the wording is not always drop-in. Adapt:

- issue states;
- owner names;
- approval paths;
- artifact storage; and
- evidence links

to your own stack before live use.

## Next Step

Pick one recurring output and apply all four assets to it once. After one real
run, trim anything your team never uses. The goal is a lighter, more reliable
finish line, not more ceremony.
