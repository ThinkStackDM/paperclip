---
name: creative-stack
description: >
  The full creative-generation stack available to EVERY team — both self-serve generation
  and premium tools the human operator runs by hand. Use whenever you need an image, video,
  voiceover, deep research, or any media asset. Covers what you can run now vs what to request.
---

# Creative Stack

Every team can now generate images and video. Use this whenever a deliverable needs media —
don't ship a blank placeholder or skip the asset.

## Self-serve — run these yourself, $0 (needs a hermes lane in your company)
- **Image:** `hermes -z "Generate an image: <detailed prompt>" -t image_gen` — grok-imagine,
  ~13s, production-quality (logos, hero art, book covers, thumbnails, infographics, mascots).
  It renders structured/infographic text cleanly but garbles small text in photoreal scenes —
  so overlay real copy in the layout for photoreal heroes.
- **Video:** `hermes -z "Generate a video: <prompt with camera direction>" -t video_gen` —
  grok-imagine-video, ~8s, 720p, follows camera direction (push-in, pan). Good B-roll.
- **Offline/logos:** local FLUX (`scripts/imagegen/generate-image.sh`) when offline — free but
  slow (~5 min) and HW-heavy, so off-peak only.

## Premium — human-in-the-loop (the operator runs these by hand; raise a request)
These tools are part of our stack but run by the human operator, who copy-pastes your prompt
and returns the output:
- **Flow** and **Veo** — high-end video generation.
- **NotebookLM** — research synthesis + audio overviews.
- **NanoBanana** — advanced image generation/editing.
- **ChatGPT Image creation** — image generation.
- **Perplexity Pro** — deep research with citations.

### How to request one
Create a board ask / human request titled **`[CREATIVE REQUEST] <tool>: <one-line need>`** that contains:
1. the **exact prompt** to paste (self-contained — the operator won't add context),
2. **what output you need back** (format, count, dimensions) and **where it should go**,
3. why it needs the premium tool vs self-serve grok-imagine.

The operator pastes the prompt, runs the tool, and returns the asset/text; you then integrate
it into the deliverable. Batch related requests into one ask to save the operator's time.
