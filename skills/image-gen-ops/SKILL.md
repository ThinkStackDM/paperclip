---
name: image-gen-ops
description: How to produce image assets for issues. Use whenever an issue needs an image (logo, thumbnail, cover, illustration, social card, hero, diagram art). If you have the native image_generate tool (grok-imagine), generate + ATTACH the file directly. If you do NOT have the tool, ROUTE the issue to your company's Designer-Media agent (which generates via grok-imagine) — never curl, never package a board prompt just because you lack the tool. Escalate to the BOARD only when the asset specifically needs Nano Banana (Google Gemini 2.5 Flash Image) or OpenAI image. Never block silently on missing image capability.
---

# Image Gen Ops

## Decision rule (in priority order)

0. **If you have the `image_generate` tool (grok-imagine — the hermes `image_gen`
   toolset), USE IT DIRECTLY. This is the preferred path whenever available** — $0,
   ~13 s, production-quality 1024×1024, no GPU contention. Do NOT curl an external
   image API; you have the native tool. Steps:
   - Call `image_generate` with an art-directed prompt (see "Prompt quality bar").
     For video/B-roll, `video_generate`.
   - The tool writes the file to `~/.hermes/cache/images/xai_grok-imagine-image_*.jpg`
     (video likewise under the hermes cache). **The asset is NOT delivered until you
     ATTACH that file to the issue** — leaving it in the cache is an INCOMPLETE
     disposition. Attach it:
     ```bash
     curl -sS -X POST -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
       -F "file=@<the-generated-file-path>" \
       "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues/<this-issue-id>/attachments"
     ```
   - If the brief is exacting, `vision_analyze` the file first and regenerate if off-brief.
   - Comment the exact prompt used and confirm the attachment, then set the disposition.
   - Text-in-image is still bimodal, but `grok-imagine-image-quality` moved the line:
     it is strong on clean display copy, multilingual tags, and medium-density packaging
     / signage, yet it still breaks on true fine print, legal copy, and dense compliance
     blocks. For mandatory exact typography, keep using `og-image-rendering` or overlay
     real copy in the layout layer.
   - When you request `grok-imagine-image-quality`, record the ACTUAL served `model`
     metadata in the issue. TSBC-986 (July 2026) saw some requests come back as
     `grok-imagine-image`, so do not label the asset by requested slug alone.

   - **Exception:** if the brief *explicitly* requires Nano Banana (Gemini) or OpenAI
     image — capabilities grok-imagine lacks — do NOT force grok-imagine; escalate to the
     board (step 2).

1. **If you do NOT have the `image_generate` tool, ROUTE to the media agent — do NOT
   board it, do NOT curl, do NOT run local generation.** Reassign the issue to your
   company's **Designer-Media** agent (a `hermes_local` agent with the `image_gen`
   toolset that generates natively via grok-imagine and attaches the asset):
   - find it: `GET /api/companies/$PAPERCLIP_COMPANY_ID/agents` → the agent named
     `Designer-Media`, or a `hermes_local` agent whose `adapterConfig.toolsets` includes
     `image_gen`;
   - hand it off: `PATCH /api/issues/<id>` with `{"assigneeAgentId":"<designer-media-id>"}`
     and comment that you routed it for generation.
   - If your company has NO media agent yet, escalate to the board to provision one
     (do not silently block, and do not fall back to a board prompt for a routine asset).

2. **Escalate to the BOARD only for Nano Banana or OpenAI image.** grok-imagine (via the
   Designer-Media agent) covers essentially all assets, so the board is the LAST resort —
   reserved for assets that specifically need **Nano Banana (Google Gemini 2.5 Flash
   Image)** or **OpenAI image (gpt-image / DALL·E)**: the brief explicitly asks for one,
   or it needs photoreal faces/hands with legible in-image text that grok-imagine garbles
   and one of those is the right tool. Package the prompt (see "Prompt package") and mark
   the issue for the board; a human runs it in Nano Banana / OpenAI. Do NOT board a request
   merely because YOU lack the tool — that is what routing to Designer-Media (step 1) is for.

> A local on-device generator (MLX FLUX.1-schnell, `scripts/imagegen/generate-image.sh`,
> `IMAGE_PROVIDER=local|cloudflare|gemini`) exists as a deep OFFLINE fallback only — it is
> slow under fleet load. Use it solely when explicitly told the Mac is idle and the asset is
> low-stakes; otherwise route to Designer-Media (step 1) or, for Nano Banana/OpenAI, the board.

## Prompt package (for board action on hero/brand-critical assets)

Post ONE comment on the issue with, in a single fenced block ready for the board's
"Copy prompt" flow:
- the exact final prompt (subject, style, composition, palette, text verbatim in quotes),
- the spec: dimensions/aspect ratio, format (PNG/JPG), transparency yes/no, placement,
- the output filename/path the asset should land at.
Mark the issue for board action so a human can run it in the appropriate tool.

## Prompt quality bar

- One subject per prompt; state style ("flat vector", "photoreal", "isometric"),
  background, palette (hex if branded), and any text verbatim in quotes.
- For brand assets include the company name and color (e.g. Dastardly Print `#e32400`).
- Request the aspect ratio in the prompt itself (e.g. "16:9 wide banner").
- Never solve this twice ad hoc: if the script is insufficient, file an issue
  proposing the script change rather than hand-rolling REST calls.
