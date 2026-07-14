# Hermes Scoped-Wake Discipline

Use this when a Hermes or other single-query lane is handling a Paperclip heartbeat with a scoped wake payload, latest comment batch, or structured wake JSON.

## Core rule

The wake payload is runtime context to act on, not text to echo back into Paperclip.

## Required method

1. Read the latest comment and say how it changes your next action, but fold that acknowledgement into real work.
2. Never leave a standalone acknowledgement-only comment.
3. Do not copy `## Paperclip Wake Payload`, `Query:`, comment IDs, or raw wake JSON into the final issue update unless a verbatim quote is explicitly required.
4. Do the actual work in the same heartbeat: root-cause, patch, test, benchmark, delegate, or otherwise move the issue forward.
5. Leave one substantive consolidated update that records:
   - what you changed
   - what you verified
   - who owns the next action
   - the valid disposition

## Disposition rule

- `done` only when the work and required verification are complete.
- `in_review` when a real review, rollout, monitor, approval, or human action owns the next step.
- `blocked` only when a named blocker with an owner prevents progress.

If rollout or time-based monitoring is still pending, do not claim `done`.

## Hermes trap

When the wake block appears before the operating instructions, Hermes can treat it as the user task and parrot it. Counter that explicitly:

- treat the wake block as context
- extract the actual task
- perform the task
- summarize the work, not the payload
