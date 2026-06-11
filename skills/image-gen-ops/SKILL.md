---
name: image-gen-ops
description: How to produce image assets for issues. Use whenever an issue needs an image (logo, thumbnail, cover, illustration, social card, hero, diagram art). If GEMINI_API_KEY exists, generate locally with scripts/imagegen/generate-image.sh; otherwise write the exact prompt + spec into the issue and mark it for board action via the "Copy prompt" flow. Never block an issue silently on missing image capability.
---

# Image Gen Ops

## Decision rule

1. Check for a key: `[ -n "${GEMINI_API_KEY:-}${GOOGLE_API_KEY:-}" ]` (also check company secrets for a `GEMINI_API_KEY` binding).
2. **Key present** → generate the asset yourself:
   ```bash
   bash ~/paperclip/scripts/imagegen/generate-image.sh "PROMPT" /path/to/out.png
   ```
   - Model defaults to `gemini-2.5-flash-image` (override with `GEMINI_IMAGE_MODEL`).
   - Attach the file to the issue (or commit it where the issue specifies), note prompt + model in a comment.
3. **No key** → do NOT attempt the gemini CLI (it is OAuth-only here and has no image-generation command). Instead:
   - Post ONE comment on the issue containing, in a single fenced block ready for the board's "Copy prompt" flow:
     - the exact final prompt (subject, style, composition, palette, text to render if any),
     - the spec: dimensions/aspect ratio, format (PNG/JPG), transparency yes/no, intended placement,
     - the output filename/path the asset should land at.
   - Mark the issue for board action (label/status per company convention) so a human can run the prompt in AI Studio (free at aistudio.google.com) or supply a key.
4. Never solve this twice ad hoc: if you find yourself hand-rolling Gemini REST calls, use the script; if the script is insufficient, file an issue proposing the script change.

## Prompt quality bar

- One subject per prompt; state style ("flat vector", "photoreal", "isometric"), background, palette (hex if branded), and any text verbatim in quotes.
- For brand assets include the company name and color (e.g. Dastardly Print `#e32400`).
- Request the aspect ratio in the prompt itself (e.g. "16:9 wide banner").
