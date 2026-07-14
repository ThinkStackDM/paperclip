# LOGOFORGE Locked Marks

Use this whenever work touches a mark or any surface that consumes one.

## Hard law

1. Marks are LOGOFORGE, not image-gen. A grok or media render may inspire a concept, but it never becomes the shipped mark, icon, round mark, favicon, or lockup.
2. Consume the approved slot asset file directly. Never redraw geometry, trace a PNG, or re-render a locked slot from the recipe. Every shipped slot composites the approved file itself; crop or scale only.
3. One locked asset family, many slots. `assets.mark`, `theme.markImg`, `iconSvg`, `roundMarkSvg`, `wordmark*`, favicons, and lockups must all come from the approved locked family, with each surface using its governed slot file instead of a fresh export improvised in the task lane.
4. Exact-dimension rule applies. Mark-facing and text-critical surfaces ship at the target platform size using approved asset files. No stretching. Crop or downscale only after the displayed result is reviewed.
5. If the pack is missing a governed slot, stop and surface a locked-source gap. Never invent replacement geometry or derive a substitute slot.
6. Any validation reference is governed too. `validation.markPngReference` must be a sha-pinned rasterization of the operator-approved asset, generated outside the pipeline under test. Never validate against a file the same pipeline can regenerate.

## Canonical front doors

- Brand pack registry: `~/scripts/brand-suite/packs/*.json`
- Brand asset root: `~/scripts/brand/`
- Brand rules and truth lines: `~/scripts/brand/README.md`
- Exact-dimension renderers: `~/scripts/brand-suite/brandsuite banner`, `avatar`, and `render-pack`
- Ownership gate: `~/scripts/brand-suite/brandsuite validate-packs`

## Canonical exports

Treat the pack JSON as the source of truth. The locked inputs live in the pack slots and the governed outputs come from `brandsuite render-pack --brand <slug>`:

- source slots:
  - `assets.mark` or `theme.iconSvg`
  - `assets.roundMarkSvg` or `theme.roundMarkSvg` when present
  - `theme.markImg` or `assets.markImg` when present for visible composed surfaces
  - `wordmarkDarkSvg`, `wordmarkLightSvg`, `wordmarkMonoBlackSvg`, `wordmarkMonoWhiteSvg`
- render-pack outputs:
  - `logos/vectors/`
  - `logos/mark/`
  - `logos/round-mark/`
  - `logos/wordmark/`
  - `logos/lockup/`
  - `logos/favicon/`

If the pack exposes `theme.markImg` or `assets.markImg`, use that approved locked export directly for the visible mark. `assets.mark` stays the governed geometry source for the pack, but downstream creative lanes do not regenerate slot assets from it ad hoc.

## Current locked brands

- Stack Lab
  - pack: `~/scripts/brand-suite/packs/stack-lab.json`
  - locked mark: `~/scripts/brand/stack-lab/mark.svg`
  - locked raster reference: `~/scripts/brand/stack-lab/mark.png`
  - locked display font: `Sora`
  - banned drift: the two-vertical-bars glyph

- Cashflow Compass
  - pack: `~/scripts/brand-suite/packs/cashflow-compass.json`
  - locked mark: `~/scripts/brand/cashflow-compass/mark.svg`
  - locked raster reference: `~/scripts/brand/cashflow-compass/mark.png`
  - locked display font: `Fraunces`
  - banned drift: the four-point compass rose

- Vault Cases
  - pack: `~/scripts/brand-suite/packs/vault-cases.json`
  - locked mark: `~/scripts/brand/vault-cases/mark.svg`
  - locked raster reference: `~/scripts/brand/vault-cases/mark.png`
  - locked display font: `Cinzel`
  - banned drift: the vault-door ring or dial

- The Aroid Atlas
  - pack: `~/scripts/brand-suite/packs/aroid-atlas.json`
  - locked slots live under `~/scripts/brand/aroid-atlas/logos/`
  - use `icon.svg`, `round-mark.svg`, and the mono wordmarks from that directory

- Dastardly Print
  - pack: `~/scripts/brand-suite/packs/dastardly-print.json`
  - locked slots live under `~/scripts/brand/dastardly-print/logos/`
  - use `icon.svg`, `round-mark.svg`, and the mono wordmarks from that directory
  - do not place the wide wordmark directly into circle-crop avatars

## Required behavior

1. Read the pack before designing. Never guess which asset slot is canonical.
2. `mark.svg` is the geometry truth for pack preparation. Downstream lanes composite the approved slot files: `mark.png`, `theme.markImg`, `iconSvg`, `roundMarkSvg`, favicons, and lockups. Do not re-render those slots from `mark.svg` in the deliverable lane.
3. If a pack exposes `roundMarkSvg`, use it for avatars, profile pics, app icons, and any circle crop.
4. If a pack does not expose a circle-safe approved asset, stop and surface a governed-slot gap; do not derive a round mark, padded square, or substitute icon from the recipe.
5. Mono variants are first-class governed assets. Use `wordmarkMonoBlackSvg` and `wordmarkMonoWhiteSvg` where the pack provides them; do not fake mono by screenshotting a colored asset and desaturating it.
6. For PDFs and letterheads, use the pack's `pdfCss` and `pdfLetterhead` when present. Never paste a rasterized social export in place of the governed mark.
7. Use `brandsuite banner` and `brandsuite avatar` for exact-size profile and shop surfaces. Use `brandsuite render-pack --brand <slug>` only when an operator-approved pack refresh is required; do not use it as cover to regenerate a missing slot in the deliverable lane.
8. If an operator asked for a LOGOFORGE-versus-media comparison, stage both variants at the exact platform size, but keep the final official mark assets on the LOGOFORGE or code path.
9. Media-lane output can be used for backgrounds, scenes, textures, or comparison boards. It must not replace `mark.svg`, `mark.png`, `iconSvg`, `roundMarkSvg`, favicon, or lockup outputs.
10. `validation.markPngReference` is valid only when it is a sha-pinned rasterization of the operator-approved asset generated outside the pipeline under test. A reference the validator can regenerate itself is circular and invalid.

## Required validation

1. Name the pack you used and the exact approved asset file or files you composited, not only the recipe path.
2. Check drift bans for the brand:
   - no compass rose for Cashflow Compass
   - no two-bars glyph for Stack Lab
   - no vault-door ring for Vault Cases
   - no off-batch display font for Cashflow Compass, Stack Lab, or Vault Cases
3. If you changed a pack slot or any mark-facing asset, run `brandsuite validate-packs`.
4. If the brand has `validation.markPngReference`, trust it only when it is a sha-pinned rasterization of the operator-approved asset generated outside the pipeline under test. If the validator is comparing against a file it can regenerate in the same flow, fix the reference before trusting the gate.
