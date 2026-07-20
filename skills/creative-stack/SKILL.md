---
name: creative-stack
description: >
  Catalogue of the creative-generation tools available to EVERY team — what you can
  self-serve now (and which skill drives each) vs premium tools the human operator runs
  by hand. Use to discover what's available, or to request an operator-run premium tool.
  For HOW to actually produce an image or video, use image-gen-ops / video-gen-ops.
---

# Creative Stack

This is the *catalogue* of what's available — not the production how-to. To actually
produce an asset, use the operational skills:
- **image-gen-ops** — produce + attach an image (the generate / route / board decision tree).
- **video-gen-ops** — produce + attach a video; **video-assembly-pipeline** + **video-editing** drive assembly.
- **og-image-rendering** — render legible text on an image. (grok-imagine garbles small text in
  photoreal scenes — owner of the "never trust the generator's text, overlay real copy" rule.)
- **forge-studio-ops** — create, verify, package and govern complete brand identities and Founder Launch handoffs through the canonical Forge Studio v1.2 renderer and custody model.

## Self-serve — $0, run on a hermes lane in your company
| Tool / skill | What it's for |
|---|---|
| `image_gen` (grok-imagine speed/quality) via **image-gen-ops** | logos, hero art, covers, thumbnails, mascots, clean display-text tiles; `grok-imagine-image-quality` is strong on large/medium text and multilingual tags but still not for tiny legal copy |
| `video_gen` (grok-imagine-video) via **video-gen-ops** | short B-roll / ambience clips, ~8s 720p, follows camera direction; this is the current self-serve stable path while `grok-imagine-video-1.5` stays watchlist until text-to-video actually serves in-lane |
| **baoyu-infographic** (Hermes) | 21-layout infographics from any text/URL/topic — image_gen-backed, $0 |
| **baoyu-comic** (Hermes) | educational / explainer "knowledge comics" — image_gen-backed, $0 |
| **p5js** (Hermes) | generative / motion / audio-reactive visuals → MP4 / GIF / SVG |
| **pixel-art** (Hermes) | image → retro pixel art (NES / Game Boy / PICO-8), animate to GIF / MP4 |
| **claude-design** / **popular-web-designs** (Hermes) | polished on-brand HTML pages / landing / decks (54 real brand systems) |
| **excalidraw** / **architecture-diagram** (Hermes) | hand-drawn / infra diagrams, no API key |
| **humanizer** (Hermes) | strip AI-isms from any prose before it ships |
| local FLUX (`scripts/imagegen/generate-image.sh`) | offline image gen — free but slow (~5 min), off-peak only |
| Forge Studio v1.2 via **forge-studio-ops** | governed SVG identity systems, responsive marks, rich material derivatives, platform/social/print/Office packs, exact meeting backgrounds, contact/capabilities, onboarding and trust templates, Candidate verification, adoption records and drift recovery |

The Hermes skills above are installed + enabled on hermes lanes — call them directly (no install).

TSBC-986 (July 2026) placement note:
- `grok-imagine-image-quality` earned a slot for clean text tiles, multilingual tags, and medium-density packaging/signage comps.
- It did NOT displace **og-image-rendering** for tiny, compliance-critical, or exact-copy overlays.
- `grok-imagine-video-1.5` remains experimental in the current EU/TSBC lane because direct text-to-video requests hard-failed instead of serving clips.

## Premium — human-in-the-loop (operator runs these by hand; raise a request)
Part of our stack but run by the human operator, who pastes your prompt and returns the output:
- **Flow** / **Veo** (Google) — high-end video generation.
- **Sora** (ChatGPT Pro) — high-fidelity / long-form video.
- **NanoBanana** — advanced image generation / editing.
- **ChatGPT Image creation** — image generation.
- **NotebookLM** — research synthesis + audio overviews.
- **Perplexity Pro** — deep research with citations.

### How to request one
Create a board ask titled **`[CREATIVE REQUEST] <tool>: <one-line need>`** containing:
1. the **exact prompt** to paste (self-contained — the operator won't add context),
2. **what output you need back** (format, count, dimensions) and **where it should go**,
3. why it needs the premium tool vs self-serve grok-imagine.

Batch related requests into one ask to save the operator's time.
