---
name: operator-asks
description: Write a Paperclip operator ask (request_confirmation / ask_user_questions) that is actionable at a glance — a required summary as a crisp ASK / WHY / ACTION, the right interaction kind, and a user-facing link. Use whenever an agent needs a human decision before work can continue.
key: paperclipai/bundled/paperclip-operations/operator-asks
recommendedForRoles:
  - manager
  - ceo
  - engineer
  - product
tags:
  - paperclip
  - asks
  - approvals
  - inbox
  - operator
---

# Operator Asks

An ask is the only thing that pulls a human into the loop, so it has to stand on its own. The operator reads it in a queue next to dozens of others, with no memory of your run. If they cannot tell what you need and what each answer does without opening the thread, the ask stalls — and a stalled ask blocks the work behind it.

## When to use

- You need a genuine human decision before you can continue: a go/no-go, an approval, a choice between paths, missing information only a person has.
- The decision is irreversible, spends money, is externally visible, or contradicts a stated constraint.
- You have done the work to make the decision cheap: the options are scoped and you have a recommendation.

## When not to use

- You can decide it yourself from the issue, the code, or sensible defaults. Decide and proceed — do not outsource judgement you already have.
- The thread already has an open `request_confirmation` or `ask_user_questions`. Wait for the answer; a second ask is noise.
- You are really reporting status. Post a comment instead — asks are for decisions, not FYIs.

## The summary is required — write ASK / WHY / ACTION

Every `request_confirmation` and `ask_user_questions` MUST carry a `summary` (the server rejects the ask without one). Write it as three short lines:

- **ASK** — the one decision you need, as a question. "Approve the $400/mo Vercel Pro upgrade?"
- **WHY** — why it needs the operator and why now. One sentence on what is blocked. "Build minutes hit the free-tier cap; deploys are queued until this clears."
- **ACTION** — what happens on each answer, so the choice has consequences. "Accept → I upgrade and resume the deploy. Reject → I move the marketing site to static export instead."

Keep it tight — three lines, not three paragraphs. The `title` is a label; the `summary` is what makes the ask decidable.

## Pick the right kind

- **request_confirmation** — a single yes/no or accept/reject gate (approve a plan, ship a release, spend a budget). Bind it to the thing being confirmed via `payload.target` when there is a concrete artifact (a plan revision, a document).
- **ask_user_questions** — the operator must choose among options or supply input. Give real, mutually exclusive options with clear labels.

## Link to something the operator can open

Any link in the ask — `payload.target.href`, a URL in the summary — must point at a **user-facing** page: the issue (`/<prefix>/issues/<issue-id>`), a rendered document anchor (`#document-plan`), an approval, a deployed preview. Never link to an agent-internal path: a worktree file path, a sandbox URL, an internal run id, a localhost address the operator cannot reach. If the evidence lives somewhere internal, surface it into the issue (a comment, a document) and link that.

The inbox deep-links straight to the ask, so the operator lands on your card — make sure what they land on is readable.

## Filing

- `POST /api/issues/{issueId}/interactions` with `kind`, the required `summary`, the `payload`, and a `continuationPolicy` (`wake_assignee` for questions you will act on; `none` for a pure gate).
- Set an `idempotencyKey` so a retried heartbeat does not create duplicate asks (e.g. `"confirmation:{issueId}:plan:{revisionId}"`).
- Move the issue to `in_review` and stay assigned, so the answer wakes you. The ask now surfaces in the operator's "Needs you" view regardless of the issue's status — but keeping status honest keeps the rest of the board accurate.

## Good vs bad

**Bad** (title only, no summary, internal link):
> title: "Need approval"  → rejected: summary is required; and "approval for what?"

**Good:**
> ASK: Approve deleting the 3 legacy S3 buckets listed in the plan?
> WHY: They cost ~$90/mo and block the storage-cleanup issue; nothing has read them in 180 days.
> ACTION: Accept → I delete them and close the issue. Reject → I keep them and document an exception.
> link: /ACME/issues/ACME-481#document-plan

## Anti-patterns

- An ask with an empty or one-word summary. It will be rejected, and even if it were not, the operator cannot act on it.
- "Please advise." Give options and a recommendation; never hand the operator an open-ended prompt.
- Linking to a worktree path, sandbox, or internal run the operator cannot open.
- Asking for a decision you could have made, then waiting — the work behind the ask sits idle for hours.
- Stacking a new ask on a thread that already has one open.
