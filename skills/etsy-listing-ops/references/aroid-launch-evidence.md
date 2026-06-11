# Aroid Atlas launch evidence trail (Dastardly Print, company e7507bfa)

Identifiers are THIAAAA-*.

## Design → raster → QA
- THIAAAA-14 — first 10 product designs; CEO approval = design lock.
- THIAAAA-16 — "Etsy store live with first 10 listings" (still blocked at mining time on the board credential). Carries: export-at-upload routing decision, raster export run (13 rasters), listing scaffolding (`launch-listings` doc), and the blocker-hygiene history (stale THIAAAA-42 blocker cleared 2026-06-10).
- THIAAAA-42 — visual-truth QA sign-off; two-stage gate definition (Stage 1 flat conformance / Stage 2 on-product render, "no fabricated mockups"). Done 2026-06-09, 11 digital listings cleared.
- THIAAAA-43 — mug/sticker master rebuilds (mug 2715×1155, sticker 1275×1275 + bleed + cut line). Frozen out of scope by the digital-only rescope (MC THIAAAA-378, relayed THIAAAA-385).
- Conformance-guard fix: `.tools/export-rasters.js` used sharp `fit:"fill"` which silently distorts on ratio mismatch; now skips with a reason and tags sRGB explicitly.
- THIAAAA-45/46/56 — 3-image listing visual sets for the digital wall-art plates (8 + 3 fast-follow species).

## Publish path
- THIAAAA-466 — "Pre-stage Path A: one-shot Etsy OAuth + publish helper (etsy-auth.js)". Files: `.tools/etsy-auth.js` (PKCE, dry-run default, `--live`, `--refresh`), `.tools/.env.etsy.example`, `.tools/.gitignore`, runbook `listings/aroid-digital/_etsy-oauth-runbook.md`. Constants: `taxonomy_id = 2078`, 11/11 dry-run.
- THIAAAA-529 — "make Etsy go-live mechanical": idempotent ledger `.tools/.etsy-published.json`, `--force`/`--reset`, keystring masking fix, `--exclude` flag (added when the CEO's 10-vs-11 call turned out not to be zero-code), crash/resume validated, `runbook` document. CEO re-armed an expired board confirmation (interaction 91deed1b → re-armed 8d323b24).
- THIAAAA-530 — publish manifest: 11 rows, zero gaps, title ≤140 / 13 tags / price / ZIP / tile per row; SEO polish (L9 `hanging plant` → `heart leaf plant`); engineer cross-checked manifest ↔ runbook 1:1.
- Board approval of record: c5322b9b — "Authorize Etsy one-pass go-live", Path A (API token) vs Path B (manual runbook).
- THIAAAA-531 — Hoya kerrii (L9) relist under "The Botanical Atlas" sister banner (deferred, cancelled at mining time).

## Copy/pricing sources
- `listings/aroid-digital/_etsy-listing-packs.md` — canonical copy source parsed by the publisher.
- THIAAAA-12 — pricing benchmarks doc (art $16.99/$27.99/$49.99 by size; tee $25.99; mug $17.99; sticker $4.99/$11.99 — physical rows now frozen).

## Failure-shape stats (mined 2026-06-11)
- 85 domain issues. Stall points: board credential (THIAAAA-16/529 blocked), expired board confirmations, sample orders blocked (physical lane, now rescoped out), least-privilege comment walls (worked around via owned child issues).
