# Ship-It QA Checklist

Use this checklist on the actual deliverable, not on an idea of the
deliverable.

## Scope Check

- The output still matches the original ask.
- Named exclusions are still excluded.
- Any approved deviation is labeled clearly.

## Artifact Check

- The final file or files exist.
- A reviewer can open them without local-only tribal knowledge.
- Editable source is preserved where future revision matters.
- File names and version labels are explicit.

## Evidence Check

- Any important claim is backed by a report, source note, or preserved proof.
- Metrics, comparisons, and "best" language cite the basis for the claim.
- If evidence is weak, the caveat is attached to the claim instead of hidden.

## Quality Check

- The deliverable solves the real user task, not just the stated format.
- Obvious errors, placeholders, and broken links are removed.
- The output has been checked in the surface where it will actually be used.

## Risk Check

- Sensitive data, credentials, or internal-only references are absent.
- Public wording does not reveal internal routing, security posture, or private
  process details.
- If this touches payments, auth, compliance, or customer trust, a real human
  approver is named.

## Rollback Check

- You know what version this replaces.
- You know how to revert or supersede it if a problem is found.
- The owner for correction is named.

## Delivery Check

- The review path is explicit: ship, request review, or block.
- "Ready for review" points to a real reviewer, approval, or interaction.
- The final note explains what changed, what was verified, and what remains
  gated.

## Closeout Rule

If any box above is false, the output is not done yet. Name the blocker
directly instead of leaving the work in a vague in-progress state.
