---
name: kdp-keyword-category-research
description: >
  Pre-publish discoverability research for KDP books — the 7 keyword slots, 3 BISAC categories,
  and subtitle that decide whether a book is findable. Use during niche/architecture/metadata
  stages of kdp-publishing-pipeline, BEFORE the listing goes live. No paid tools — Amazon's own surfaces only.
---

# KDP Keyword & Category Research

A book nobody can find earns nothing. Amazon ranks on relevance + sales velocity; pre-launch we
control the 7 keyword slots, the categories, and the title/subtitle. Pick them with $0 of tools.

## Mine demand (Amazon's own surfaces)
- **Autocomplete**: type the seed in the Amazon Books search bar; append a–z to fan out the
  suggestion tree. Top suggestions = highest real demand.
- **Competitor rails**: "customers also bought / also searched" on the top 10 titles = buyer language.
- **Category depth**: open the candidate category bestseller list; read #1 and #20 BSR. Deep demand if #20 still strong.

## Keywords (7 slots)
- Each slot is a *phrase* (Amazon indexes the whole 50-char field), not a single word.
- Score on demand × relevance × winnability — a phrase real buyers type, that fits the book, where
  the current top results are weak. Win the long tail, not head terms.
- Do NOT repeat words already in the title/subtitle (already indexed). No prohibited terms
  (other authors, "bestseller", "free", trademarks) — risks suppression.

## Categories (3 BISAC) + subtitle
- Choose the most *specific* legitimate categories — #1 in a small relevant category (orange badge) beats lost in a giant one.
- The **subtitle carries the genre keywords the title lacks** — an 8th keyword field that's also human-readable. Draft 3 variants, pick the most embedded demand that still reads naturally.

## Deliverable
A `keyword-category-pack` doc: 7 phrases (each with autocomplete evidence + "why winnable"),
3 ranked categories, 2–3 subtitle candidates, rejected alternatives + reasons. Input to the
metadata pack (kdp-publishing-pipeline). Research only — nothing board-gated here.
