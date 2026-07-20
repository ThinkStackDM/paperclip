# Generic QA Gate Patterns

Name the gate that is blocking the work. This keeps status honest and makes the
next action obvious.

## Scope Gate

Question:

Does the output still match the approved ask?

Use when:

- requirements drifted;
- named exclusions might have been crossed;
- the team is unsure whether a shortcut changed the promise.

Pass condition:

- scope matches; or
- approved deviation is recorded explicitly.

## Evidence Gate

Question:

Do the important claims have preserved support?

Use when:

- someone says "best", "proved", "safer", or "ready";
- a recommendation changes spend or rollout;
- customer-facing wording depends on benchmark results.

Pass condition:

- report or preserved evidence exists and is linked.

## Quality Gate

Question:

Would a reasonable reviewer accept this as functional and coherent?

Use when:

- the file exists but may still be sloppy;
- a draft needs a real final pass;
- the output will be seen by a customer, operator, or stakeholder.

Pass condition:

- errors, placeholders, broken references, and obvious UX flaws are resolved.

## Claims Gate

Question:

Is the public or customer wording honest for the evidence level?

Use when:

- a listing, case study, ad, or sales line is being drafted;
- the result contains percentages, rankings, or capability claims;
- internal truth and public-safe truth are not the same sentence.

Pass condition:

- allowed wording and required caveats are written down.

## Delivery Gate

Question:

Can the next reviewer or operator actually inspect the output?

Use when:

- artifacts only exist on one machine;
- filenames are ambiguous;
- a final package is missing.

Pass condition:

- inspectable files are attached, linked, or otherwise reachable.

## Rollback Gate

Question:

If this turns out wrong, do we know what to undo and who owns the fix?

Use when:

- a live asset is being replaced;
- a benchmark decision may influence routing or spend;
- the output could become public or customer-visible.

Pass condition:

- rollback owner, correction path, and retest trigger are known.

## How To Use These Gates

Keep the gate names stable. A simple issue note such as "Blocked on Claims Gate"
is more useful than a long paragraph that never says what kind of risk is still
open.
