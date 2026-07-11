---
name: etsy-listing-ops
description: Dastardly Print pipeline from approved design masters to live Etsy listings. Use for issues like "Listing visuals — 3-image sets", "publish manifest for staged listings", "Etsy store live with first N listings", "make Etsy go-live mechanical", "Visual-truth QA sign-off on production rasters", "PDF planner/tracker QA", or any digital wall-art/PDF listing/relist work. Encodes the export-at-upload raster flow, PRINT-SPECS conformance guard, the PDF page-fill/product-truth gate, the two-stage visual-truth QA gate, the one-shot etsy-auth/etsy-publish path, and the board credential gate.
---

# Etsy Listing Ops

Dastardly Print sells digital wall-art on Etsy (current lane is **DIGITAL-ONLY** per the MC rescope on THIAAAA-378 — mug/sticker physical masters are frozen). The pipeline below took ~6 sprints of issue threads to converge on; follow it instead of re-deriving it.

## Pipeline: approved master → live listing

1. **Design lock first.** SVG masters are the single source of truth. Never rasterize art the CEO might still change — export happens **engineer-owned, at upload time**, after design approval (routing decision of record, THIAAAA-16/42).
2. **Export production rasters** with `node .tools/export-rasters.js` from the approved masters (`designs/aroid/*/production/`). The tool has a **conformance guard**: it SKIPS (never silently stretches) any job whose master viewBox doesn't match the PRINT-SPECS target. `mockup-library/PRINT-SPECS.md` is authoritative for dims. Known targets: wall art 4800×6000 @300DPI (4:5 serves 8×10/11×14/16×20); tees transparent 3600×4800. Export **sRGB, not CMYK** (POD suppliers convert internally).
3. **Visual-truth QA — two-stage gate** (BrandDesigner owns, THIAAAA-42 pattern):
   - **Stage 1 (flat conformance)** — exact dims/ratio, bleed, safe zones, ≥1.5pt min line weight, sRGB tag, 390px mobile readability. Passing unblocks re-export + listing scaffolding, **not** live publish.
   - **Stage 2 (on-product render)** — placement/scale + colour fidelity (ΔE) on a **real supplier render**. No fabricated mockups. This is the live-publish gate for physical goods; digital-only listings need only Stage 1.
4. **PDF page-fill/product-truth QA for planners, trackers, and templates.** "The files open" is not enough. Before a PDF listing can publish or be marked ready:
   - Render every delivered A4 and US Letter PDF page to images and attach a full-page contact sheet.
   - For DP workspace SVG/logo/PDF proof renders, use `.tools/safe-render.mjs` or existing pipeline scripts that call it. Do not launch the macOS Chrome app directly for `--headless`, `--screenshot`, or `--print-to-pdf`; the safe renderer isolates the browser profile, applies a hard timeout, and cleans up lingering Chrome state.
   - Confirm each page uses the page for buyer value: clear writing zones, tables, tracker fields, or worksheet structure across the usable area. Large blank decorative whitespace fails unless it is explicitly the intended writing area.
   - Confirm Dastardly Print branding is present and intentional, with no placeholders, lorem ipsum, substitute client names, or mock-only text.
   - Confirm A4 and US Letter parity: same product promise, same page count, no missing pages, no accidental crop or scale loss.
   - Generate listing images from the exact buyer PDFs, or label them plainly as illustrative. Never show substitute interiors, richer layouts, or generated pages that the buyer does not receive.
5. **Listing pack + visuals.** Copy lives in `listings/aroid-digital/_etsy-listing-packs.md` (titles ≤140 chars, 13 tags, description, price); each listing gets a raster/PDF ZIP + 4-tile image set. Pricing anchors from the THIAAAA-12 benchmarks doc. For PDF listings, the buyer ZIP manifest and image set must trace back to the exact rendered PDF pages.
6. **Publish manifest** (BrandDesigner, THIAAAA-530 pattern): one row per listing — ZIP filename, image tile path, SEO-polished title + 13 tags, description ref, price, deliverable spec — plus an engineering publish checklist. The manifest row schema is exactly what the publisher consumes; cross-check manifest ↔ runbook 1:1 before go-live and state it. For PDF listings, include the page count, A4/US Letter filenames, full-page render evidence path, mobile proof path, and whether live buyer files will change.
7. **One-shot publish** (FoundingEngineer):
   - `node .tools/etsy-publish.js` — dry-run validates every listing (copy parsed from `_etsy-listing-packs.md`, every ZIP/tile/tag exists). Expect `N/N listings ready.`
   - `node .tools/etsy-auth.js --live -- [publisher args]` — one-shot OAuth2 PKCE: keystring from gitignored `.tools/.env.etsy` → authorize URL → token to `.tools/.etsy-token.json` (chmod 600) → currency/taxonomy pre-flight (`taxonomy_id = 2078`) → chains the publisher.
   - **Idempotent ledger** `.tools/.etsy-published.json` written after every Etsy write: re-running `--live` skips active listings and resumes a half-built draft. Flags: `--only Lx`, `--exclude Lx[,Ly]`, `--force`, `--reset`.
   - Canonical Aroid Atlas go-live command of record: `node .tools/etsy-auth.js --live -- --exclude L9` (10 listings; L9 Hoya kerrii is OUT — it's Apocynaceae, not an aroid; deferred to a "Botanical Atlas" sister line, THIAAAA-531).
8. **Go-live runbook**: `listings/aroid-digital/_etsy-oauth-runbook.md` + the `runbook` doc on THIAAAA-529 — ≤4 manual steps (register Etsy app → paste keystring → run --live + one Allow click → verify auto-delivery).

## The board credential gate (the #1 stall point)

Live publish requires the **Etsy app keystring** — a board-only input (no vault/MFA/API token available to agents). Pattern that works:

- Pre-stage everything agent-doable so the board action shrinks to minutes (THIAAAA-466 precedent). Deliverables can be `done` while go-live stays gated.
- Raise a `request_confirmation` board approval naming the exact decision ("Authorize Etsy one-pass go-live") with **Path A** (board provisions API keystring → agent publishes via the helper) and **Path B** (board runs the manual runbook).
- **Board confirmations expire.** An expired confirmation silently kills the only continuation path — check for this on every wake of a gated issue and **re-arm a fresh confirmation** (`wake_assignee`) rather than waiting (Fionn's THIAAAA-529 save).
- Never echo the keystring/client_id to stdout or comments — reference secrets by name only (the dry-run masks it; keep it that way).

## Working rules learned the hard way

- **Least-privilege walls**: you cannot comment on issues you don't own. Route answers via a child issue you own (THIAAAA-42 pattern) instead of failing repeatedly.
- Superseded rasters stay on disk — when specs change, name the stale files in your comment ("superseded — do not QA against them").
- Product-curation calls (what's in/out of a collection) are **CEO decisions**; engineer makes them zero-code (e.g. `--exclude`), designer handles relisting under a different banner.
- Wire dependency chains with first-class blockers so issues auto-resume; clear **stale blockers** explicitly when a gate has since closed (THIAAAA-16 carried a done QA issue as a blocker for days).
- PDF trackers/planners need a product-value gate, not just a file-exists gate: rendered page evidence, page-fill/usability, brand, buyer ZIP manifest, and listing-image truth must all be visible before completion.
- Live Etsy listing edits are reversible only if you preserve the prior state. For image/file replacements, attach a before/after manifest and require board approval before touching buyer files.

## References

- `references/aroid-launch-evidence.md` — issue trail, file paths, and the QA-gate / credential-gate history.
