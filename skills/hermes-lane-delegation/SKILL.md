---
name: hermes-lane-delegation
description: >
  How and when to delegate work to your company's cheap grok "hermes" agents
  (Designer-Media + specialists) to get $0 creative generation, content
  repurposing, de-AI'ing, diagramming, and bulk work OFF the expensive
  claude/codex lanes. Use when you are a CEO/CTO/CMO/manager/strategist planning
  or assigning work and any part of it is asset generation, content repurposing,
  humanizing prose, diagram/mockup creation, or high-volume/mechanical content.
---

# Delegating to your hermes lane

Your company runs **hermes agents** (grok models, **$0 per call**) alongside the
strong claude/codex lanes. They now carry a powerful free skill set. Reserve the
expensive lanes for **judgment, strategy, and code**; push **generation,
repurposing, and bulk work** to the hermes lane. Doing a thumbnail, infographic,
or transcript-repurpose on a premium lane — or boarding a paid tool — when the
hermes lane could do it for free is wasted budget.

## Who's on your hermes lane
Find them: `GET /api/companies/$PAPERCLIP_COMPANY_ID/agents` → the `hermes_local` agents.
- **Designer-Media** (every company) — creative & media generation.
- **Content-Repurposing-Hermes** (ThinkStack Media) — bulk content repurposing.
- More specialists per company as the lane grows — check the live list.

## What to delegate, and the trigger
| If the work is… | Route to | They use |
|---|---|---|
| an image / logo / hero / thumbnail / mascot | Designer-Media | image-gen-ops (grok-imagine) |
| an infographic / data-viz from text | Designer-Media | baoyu-infographic |
| an explainer / knowledge comic | Designer-Media | baoyu-comic |
| generative / motion / animated visuals (MP4·GIF·SVG) | Designer-Media | p5js |
| retro / pixel art | Designer-Media | pixel-art |
| a polished landing/product page mockup | Designer-Media | claude-design · popular-web-designs |
| a diagram (architecture / flow) | Designer-Media | excalidraw · architecture-diagram |
| a short video / b-roll clip | Designer-Media | video-gen-ops |
| prose that reads AI-ish → de-AI it | hermes lane | humanizer |
| repurpose a video/transcript → script · thread · blog | Content-Repurposing (TSM) / hermes lane | media (youtube-content) |
| bulk / mechanical / repetitive content | hermes lane | (the relevant skill) |

(The catalogue of every self-serve tool lives in the **creative-stack** skill.)

## How to delegate
- **Reassign the issue:** `PATCH /api/issues/<id>` with
  `{"assigneeAgentId":"<hermes-agent-id>"}` plus a one-line brief — *what* you
  need and *where it goes*.
- **For a batch** (e.g. "repurpose these 10 videos", "10 listing thumbnails"),
  create one **child issue per asset** and assign each, rather than one mega-task.
- They produce + attach the asset, run the quality gates (humanizer on prose,
  og-image-rendering for legible on-image text), and hand back. **External
  publish stays board-gated** — the hermes lane drafts and prepares; it does not
  publish.

## The discipline
Default routing: **generation + repurposing + bulk → hermes lane.** Reserve
premium operator-run tools (Veo / Flow / Sora / NanoBanana — see creative-stack)
for what grok-imagine genuinely can't do, and the strong claude/codex lanes for
strategy, code, and decisions. A good plan names the hermes lane explicitly when
it hands off — don't leave generation work sitting on an expensive lane by default.
