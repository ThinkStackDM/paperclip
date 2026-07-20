# Terminal-Bench Loop Pattern

Use this pattern when you need a bounded, decision-ready comparison rather than
an open-ended experiment.

## 1. Frame One Question

Good questions:

- Which lane handles this task better?
- Did the fix improve the failure case enough to ship?
- Is the new workflow ready for live use?

Bad questions:

- What is the best model overall?
- How should we redesign the whole product?

## 2. Lock The Candidate Set

Before the first run, write down:

- the candidates being compared;
- the task set;
- the judge or rubric;
- the repetition count; and
- the stop rule.

Do not keep adding contenders mid-loop unless you explicitly restart the test.

## 3. Preserve The Inputs

Save:

- prompts or task files;
- rubric text;
- environment assumptions;
- model or tool versions;
- run logs or exports.

If the evidence is not preserved, the result is a memory, not a benchmark.

## 4. Run In Batches, Not Streams

Run a complete comparable batch, then read the outcome. Avoid a live "judge as
you go" habit that changes the bar halfway through.

## 5. Read The Low Tail

Do not stop at average quality. Look for:

- catastrophic misses;
- false positives;
- fragile formatting;
- hallucinated claims; and
- outputs that would fail a real customer or operator review.

One ugly failure can matter more than a nicer mean score.

## 6. Force A Decision Class

At the end of each loop, pick one:

- adopt;
- soft-adopt;
- benchmark-only;
- reject;
- rerun with a narrower change.

If you cannot classify the result, the loop is not finished.

## 7. Stop Rules

Pick stop rules before running:

- timebox exhausted;
- evidence strong enough for a decision;
- failure mode proved the candidate unsafe;
- external blocker prevents a fair comparison.

Without stop rules, the loop becomes entertaining but uneconomic.

## 8. Close With A Report

Every loop should end with:

- a short report;
- linked evidence;
- a named adoption owner or blocker owner; and
- the exact claim level the team is allowed to make.
