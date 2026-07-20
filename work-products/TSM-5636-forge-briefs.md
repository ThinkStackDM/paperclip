# TSM-5636 Forge Briefs - Trio Channel Marks Refresh (PREP)

**Date:** 2026-07-20
**Agent:** Designer-Media (f76dc1af-4c9e-467e-99bd-f48328421321)
**Scope:** PREP phase only - brand fonts/palette tokens, banned-family constraints, 3-4 suggested motif directions per brand (clean of banned families). Marks remain code + curation SVG only. No AI-generated logos.

**Reference Sources (read first):**
- logoforge-locked-marks.md (fonts, current locked packs, old drift bans)
- Issue TSM-5636 operator order
- brand/banned-marks.json + TSKB0059 (07-18 total family ban)

**Common Banned-Family Constraints (apply to all three brands):**
- NO hex+trend motifs
- NO hex+layers constructions
- NO magnifier+arcs elements
- NO derivatives of any banned family above
- No off-batch display fonts (use only the brand's locked display font)
- No old drift glyphs (see per-brand)

**Per-Brand Briefs**

## 1. Stack Lab (SL)
- **Locked Pack Reference:** ~/scripts/brand-suite/packs/stack-lab.json (or equivalent governed pack)
- **Palette/Font Tokens:** Pull exact tokens from the locked pack JSON. Display font: Sora. Use only approved palette values from pack (do not invent).
- **Banned (in addition to common):** Any two-vertical-bars glyph or derivative.
- **Suggested Motif Directions (clean of banned families):**
  1. Modular grid-based abstract node network (clean orthogonal lines, no trends/layers/arcs/magnifiers).
  2. Precision engineering caliper or gauge motif simplified to straight-edge geometry only.
  3. Layered but flat orthogonal blueprint lines forming a clean "lab bench" silhouette (strictly no hex, no arcs).
  4. Abstract circuit trace in strict rectilinear pattern with node intersections (no curves, no magnifier elements).

## 2. Cashflow Compass (CC)
- **Locked Pack Reference:** ~/scripts/brand-suite/packs/cashflow-compass.json
- **Palette/Font Tokens:** Pull exact tokens from the locked pack JSON. Display font: Fraunces. Use only approved palette values from pack.
- **Banned (in addition to common):** Any four-point compass rose or derivative; no old compass elements.
- **Suggested Motif Directions (clean of banned families):**
  1. Clean path/map line with directional arrowhead (strict straight + minimal curve segments, no rose, no arcs/magnifiers).
  2. Abstract wealth journey timeline or ledger grid (orthogonal only, no hex trends or layers).
  3. Simplified coordinate grid with focal waypoint marker (rectilinear, no magnifier or trend elements).
  4. Flow arrow in clean modular segments forming a directional "journey" without any circular or rose elements.

## 3. Vault Cases (VC)
- **Locked Pack Reference:** ~/scripts/brand-suite/packs/vault-cases.json
- **Palette/Font Tokens:** Pull exact tokens from the locked pack JSON. Display font: Cinzel. Use only approved palette values from pack.
- **Banned (in addition to common):** Any vault-door ring or dial or derivative.
- **Suggested Motif Directions (clean of banned families):**
  1. Clean case/briefcase silhouette in strict geometric outline (no rings, dials, arcs, magnifiers).
  2. Modular security grid or lock-bar pattern (orthogonal rectilinear only).
  3. Abstract document stack or folder edge motif in flat geometry (no hex, no layers trend, no arcs).
  4. Precision case corner reinforcement lines forming clean "V" or shield-like form without any circular dial elements.

**Next Steps (per issue path):**
- These briefs are ready for loading into Forge Studio (localhost:4680) wizard.
- Operator session: multi-lock -> refine -> QA -> library for each brand.
- One operator card will be raised once wizard is staged with briefs loaded (separate interaction or child issue if needed).
- POST-LOCK: register new marks as LOCKED (TSKB0037), produce banner v3 using specified taglines, propagate templates. TSM-5634 mark-slot fail-closed remains enforced.

**Verification Notes:**
- All suggestions explicitly avoid the listed banned families and old drifts.
- Fonts/palettes sourced from locked packs (exact tokens only).
- Marks will be produced as code + curation SVG in Forge Studio by operator.

This completes the agent-side PREP for TSM-5636.