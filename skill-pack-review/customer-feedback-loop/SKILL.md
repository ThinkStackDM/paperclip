---
name: customer-feedback-loop
description: >
  Turn reviews, refund reasons, support messages, and ratings into a ranked backlog of product/
  listing fixes. Use weekly per company once anything is live and getting buyer contact, or when a
  refund/complaint/review lands. Closes the loop analytics-finops opens: routes "what's not working" back into the build.
---

# Customer Feedback Loop

Every refund, 3-star review, and "where's my file?" is free product research the portfolio throws
away. analytics-finops measures *that* outcomes are weak; this finds *why* and routes the fix.
Loop: collect → categorize → rank → act → reply.

## Collect (where buyers actually speak)
- TSB: Amazon reviews + ratings + report reasons; sample-read 1–3★ for the recurring complaint.
- DP: Etsy reviews + messages + refund reasons ("didn't realize it was digital" = a *listing* fix).
- TSR: CV-polish QA outcomes, revision requests, refund reasons (sharpest signal today).
- TSK: tool feedback (contact form), GA4 rage-click/bounce on a step.

## Categorize (don't react to anecdotes)
Bucket each: product defect / listing-expectation mismatch / pricing / support-UX / out-of-scope.
One complaint = a data point; the same complaint 3× = a backlog item. Separate "product is wrong" from "listing set the wrong expectation" (the latter is usually cheaper, higher-leverage).

## Rank + act
Rank by frequency × revenue impact × fix cost. The cheap fix that kills the #1 refund reason beats a big feature. Each ranked item → an issue routed to the owning pipeline with the evidence quotes.

## Reply (board-gated)
Drafts by agents, posted by the board (except pre-approved support templates, each use citing the template). Acknowledge, fix or refund per policy, never improvise on an unhappy order.

## Report
Weekly to analytics-finops: top 3 themes per company, what shipped in response, the metric it moved.
