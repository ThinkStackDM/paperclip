---
name: image-gen-ops
description: How to produce image assets for issues. Use whenever an issue needs an image (logo, thumbnail, cover, illustration, social card, hero, diagram art). DEFAULT to producing a copy-ready prompt for board action; local on-device generation exists but is slow under fleet load, so only use it when explicitly told the Mac is idle. Never block an issue silently on missing image capability.
---

# Image Gen Ops

Default path: **package a copy-ready prompt for board action** (a human runs it in
the appropriate tool and drops the file in the workspace). A local on-device
generator exists (Apple-Silicon MLX FLUX.1-schnell, free/unlimited) but it shares
the GPU with the agent fleet — it is **slow under load (minutes per image) and
memory-heavy**, so it is OPT-IN, not the autonomous default.

## Decision rule

1. **Any image asset, by default** → produce the prompt package for **board action**
   (see "Prompt package" below) and mark the issue for the board. Do NOT fire local
   generation on your own during a sprint — it competes with live agents for the GPU.

2. **Local generation — only when explicitly authorized** (the issue or operator says
   "the Mac is idle / generate it locally"), and best for low-stakes draft/iteration
   art (backgrounds, mockups, thumbnails):
   ```bash
   bash ~/paperclip/scripts/imagegen/generate-image.sh "PROMPT" /path/to/out.png
   # optional: --steps N (2-4) --size WxH --seed N
   ```
   - First time on a fresh host: run `bash ~/paperclip/scripts/imagegen/setup-local.sh`
     once (needs Python 3.10-3.13; weights ~9.6 GB download once).
   - Expect ~5 min/image while the fleet runs (peak ~8 GB), faster when idle. Attach
     the file and note prompt + `local FLUX-schnell` in a comment.

3. **Hero / brand-critical or photoreal assets** → always board action (never local).
   Local FLUX-schnell can't do photoreal faces/hands, legible in-image text, or
   brand-exact logos.

## Local FLUX-schnell — what it is and isn't for

Good for (when run on an idle Mac): flat-vector/illustrative art, backgrounds,
mockups, thumbnails, social cards, abstract/branded compositions, diagram-style art.

Not good for: photoreal human faces/hands, fine legible text rendered in-image,
brand-exact logos — and not for time-sensitive work (minutes per image under load).
Route those to board action.

## Providers (env IMAGE_PROVIDER)

- `local` (default in the script) — MLX FLUX-schnell, free/unlimited/on-device, but
  slow under fleet load. Prefer the offloaded `cloudflare` option below for
  unattended programmatic generation if a token is configured.
- `cloudflare` — Workers AI `@cf/black-forest-labs/flux-1-schnell`. Opt-in only:
  requires a DEDICATED `CF_IMAGE_API_TOKEN` + `CF_ACCOUNT_ID` you set explicitly.
  The script will NOT reuse the instance `CLOUDFLARE_API_TOKEN` (that's for DNS).
- `gemini` — Google Gemini image API. **Paid-only as of 2026-06** (free tier
  limit is 0). Only usable if billing is enabled; needs `GEMINI_API_KEY`.

If local isn't set up yet the script tells you exactly what to run:
`run scripts/imagegen/setup-local.sh once … or set IMAGE_PROVIDER=cloudflare with CF_IMAGE_API_TOKEN`.

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
