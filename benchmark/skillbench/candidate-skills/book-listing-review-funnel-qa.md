# Book Listing + Review-Funnel QA

Audit Book 1 listing and review-funnel drafts with only three decisions:
`pass`, `warn`, or `block`.

## Core decision discipline
- `block` only for trust, launch, or governance failures that would make the
  draft unsafe to send for board approval or publish.
- `warn` for SEO, craft, or channel-optimization gaps that should be improved
  but do not make the draft unsafe.
- `pass` when the package is coherent, truthful, and launch-ready enough for
  the board gate.
- Prefer the smallest safe disposition. Do not invent blockers from taste.

## KDP listing metadata QA
- Check title, subtitle, pen name, price, launch footprint, categories,
  keywords, and series handling as one promise.
- Hard blockers:
  - contradicting the Book 1 KU-first launch decision by presenting the launch
    as simultaneous-wide
  - setting a series field before Book 2 exists
  - unsupported sales or ranking claims such as `bestseller`
  - placeholder / uncleared branding or pen-name drift
  - contradictory offer details that would mislead the buyer
- Warn-level issues:
  - weak or incomplete keyword/category coverage
  - subtitle or SEO craft that can be improved without making the listing
    deceptive
- Book 1 anchors:
  - pen name: `Margaret Ashbridge`
  - launch model: KDP Select / Kindle Unlimited first, wide later
  - ebook price anchor: `$4.99`
  - categories: `FIC022070`, `FIC022100`, `FIC022040`
  - subtitle anchor includes `Cozy English Village Murder Mystery`
  - series field stays blank until Book 2 exists

## Review-funnel and launch-readiness QA
- Check the channel packet, CTA copy, claims, tracking, and pre-upload gate
  together.
- Hard blockers:
  - unverifiable social-proof claims (`bestseller`, `thousands of readers`,
    fake review counts)
  - link-dropping in replies or growth behavior that breaks the approved
    channel packet
  - skipping the final branded `epubcheck` or KDP Previewer spot-check
  - bypassing the board approval / credential gate
  - public copy that contradicts the launch model or what is actually live
- Warn-level issues:
  - cadence ratio drift
  - missing tracking tags or weekly-ledger fields
  - softer hook / CTA craft gaps
- Book 1 Bluesky anchors:
  - keep the mix near `80% community / 20% promo`
  - no link-dropping in replies
  - no unverifiable claims
  - follow cap stays below `20/day` and typically `6-12/day`
  - keep the weekly ledger and review date in the packet

## Output discipline
- Return the smallest safe disposition for each draft with short concrete
  reasons.
- Name the draft that can move to board approval now.
- Use `neither` only when both drafts are blocked.
