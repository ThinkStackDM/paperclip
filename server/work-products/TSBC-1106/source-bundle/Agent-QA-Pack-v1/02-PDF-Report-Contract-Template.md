# Report Title

Source issue or project: `<link or id>`  
PDF filename: `<final-file-name.pdf>`  
Verdict: `<CONFIRMED | REFUTED | INCONCLUSIVE>`  
Report date: `<YYYY-MM-DD>`  
Owner: `<person or team>`

## Hypothesis

State the exact claim this report is trying to confirm or refute.

## Method

Describe:

- what was tested;
- what was compared;
- what counted as success or failure; and
- what limits or caveats apply.

## Data

Summarize the evidence that actually drove the call.

Suggested subsections:

- sample size or repetitions;
- score or rubric summary;
- cost or time notes;
- low-tail failures;
- preserved evidence paths.

## Verdict

State `CONFIRMED`, `REFUTED`, or `INCONCLUSIVE` and explain why in one short
paragraph.

## Recommendation

State the decision that follows from the evidence:

- ship;
- do not ship;
- rerun;
- request review;
- or block on a named gate.

## Evidence Table

| Evidence | Path or link |
| --- | --- |
| Source notes | `<path>` |
| Preserved files | `<path>` |
| Screenshots or exports | `<path>` |
| Final artifact | `<path>` |

## Public-Claim Check

- Allowed claim level: `<internal only | customer-safe | public-safe>`
- Required caveat: `<exact wording or none>`
- Approval owner: `<person or team>`

## Render Notes

- Keep the PDF readable in one pass.
- Put raw logs and large tables in linked evidence, not in the main narrative.
- If the decision changes spend, rollout, or public wording, include the
  rollback owner and retest trigger.
