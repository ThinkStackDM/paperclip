# Liveness Forensics — diagnosing stalled / looping / over-recovered work

A repeatable method for the recurring class of incident where a system stops making
progress, loops, or "recovers too hard". Produce a written root cause and a plan — no
code changes. Use this whenever asked why work stopped, stalled, looped, or went too deep.

## The three invariants (every diagnosis and fix must hold ALL THREE)

1. **Productive work continues.** Every unit of work must always have a clear next-action
   owner — agent, board, human, or a *named* blocker. No silent idle with nothing waiting.
2. **Only real blockers stop work.** A stop is legitimate only when something genuinely
   cannot proceed (needs approval, a credential, QA, or exhausted budget). A "stop" with
   nothing actually waiting on it is a pseudo-stop and must be routed back to progress.
3. **No infinite loops.** Retries, recovery, and watchdogs must be bounded (count,
   wall-clock, or a gate) so they converge instead of hammering.

For each fix you propose, state explicitly how it preserves all three.

## Method

1. **Forensics first, on the named tree only.** Establish the exact stop-point from the
   evidence before theorizing. Quote the specific failure/log/state that proves it.
2. **Enumerate ALL compounding defects — do not stop at the first.** Incidents like this
   are usually several independent faults stacking. Treat the symptom as a *set* of
   distinct root causes; list each separately. Missing one means the incident recurs.
3. **One concrete fix per defect.** Each fix must be specific (what changes, where), not
   "add error handling". Frame each as a general product rule, not a one-off patch.
4. **Check each fix against the three invariants.** Reject or rework any fix that would
   violate one (e.g. a fix that silently drops work, or that unbounds a loop).
5. **No code.** The deliverable is a root cause + an approved plan; implementation is a
   separate, board-gated step.

## Anti-patterns to avoid

- Blaming a single cause when several compound (the most common miss).
- "Just add retries / backoff" without removing the actual fault → unbounded loop risk.
- Resuming or unpausing something that was *deliberately* stopped → fights a real blocker.
- Proposing code instead of a product rule.
