# Marketplace Packaging QA

Audit marketplace packaging with three decisions only: `pass`, `warn`, or
`block`.

## Decision discipline
- `block` only when the buyer would be sent to the wrong thing, receive the
  wrong thing, or lose trust because the draft is materially misleading.
- `warn` for optimization or craft gaps that should be improved but do not make
  the draft unsafe to ship for board approval.
- `pass` when the click promise, destination, and included deliverable are
  coherent and truthful.

## Pinterest pin QA
- Check the image text, title, board, description, and destination link as one
  promise. They should all describe the same plant, bundle, and set size.
- Wrong product or wrong set-size routing is a `block`.
- A readable typographic pin can still ship. Not being a styled-room mockup is
  an optimization note, not a publish blocker by itself.
- Do not invent blockers from taste. Prefer the smallest safe note set.

## Etsy listing QA
- Check the hero claim, title, included-files tile, description, and actual
  deliverable count together.
- Any mismatch like `set of 5` in the marketing but only `3 files included` in
  the deliverable is a `block`.
- Search-quality checks matter: front-loaded buyer phrase, 13 multi-word tags,
  useful attributes, credible price/sale plan. Weak SEO is usually a `warn`,
  not a `block`, unless the draft becomes deceptive or unusable.
- Styled-room first images are best for click-through, but a truthful
  non-optimal image is not a blocker on its own.

## Output discipline
- Return the smallest safe disposition for each draft and short reasons tied to
  the concrete evidence.
- Name the draft that can move to board approval now. Use `neither` only when
  both drafts are blocked.
