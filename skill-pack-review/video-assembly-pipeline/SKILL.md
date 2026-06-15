---
name: video-assembly-pipeline
description: >
  End-to-end driver: turn a script + generated/b-roll clips + audio into a finished, spec-conformant,
  YouTube-ready 1080p MP4. Use when an issue hands you the creative inputs (timed script,
  grok clips in assets/gen/, optional VO + music) and asks for the final cut. Orchestrates the
  video-editing recipes in order with one normalize pass and a single final encode.
---

# Video Assembly Pipeline

The repeatable run from creative inputs to a finished MP4. Command detail lives in **video-editing**;
generation in **video-gen-ops**; sourcing in **broll-sourcing**; captions in **auto-captions**.

## Inputs
Script with a shot/timing breakdown · clips in `assets/gen/` (grok ~8s) and/or `assets/broll/` ·
audio in `assets/audio/` (`vo.wav`, `bed.mp3`, or "none") · a spec block (duration, aspect,
resolution, fps, voiceover, audio_bed, captions: burned|srt|none, deliverable path).

## The 8 stages (gate each)
1. **Plan timeline vs script** — map each shot to a clip+duration; total clip time must cover the VO
   (VO sec ≈ words ÷ 2.5). Short? generate more (video-gen-ops) or fetch stock (broll-sourcing) — never pad with frozen frames.
2. **Inventory + inspect** every clip (`ffprobe`); flag anything below deliverable resolution — never upscale.
3. **Normalize all inputs** to spec into `assets/_norm/` (video-editing §1; silent-audio track mandatory for grok). Trim here.
4. **Build visual timeline** — default hard cuts (lossless concat); crossfades only at act breaks (chain for 3+ clips). → `assets/_norm/timeline.mp4`.
5. **Layer graphics** — title/lower-thirds + watermark (video-editing §7/§8), batched into few passes.
6. **Captions** per spec — none / srt (ship beside MP4) / burned (Shorts + silent autoplay) via **auto-captions**.
7. **Audio mix + master** — VO over ducked bed → -14 LUFS (video-editing §5); `-c:v copy` so picture isn't re-encoded.
8. **Final export + QA gate** — single faststart encode; then QA: ffprobe matches spec (±2s), VO clear over bed, captions spot-checked start/mid/end, first/last frames clean, **per-asset licence note on the issue**.

## One-encode discipline
Footage encodes exactly twice: normalize (3) + final export (8). Stages 4–7 `-c copy` or fold into one filtergraph.

## When NOT to assemble — kick to premium
If stage 1 shows a continuous shot >8s, photoreal people, lip-sync, or broadcast fidelity, grok won't
carry it — raise `[CREATIVE REQUEST] Flow/Veo: <need>` (creative-stack) and assemble the returned
footage with this same pipeline. Faceless montage / infographic-over-Ken-Burns / hooks assemble fine; hero/talking-head do not.

## Publication is board-gated
Agents never upload. Finished MP4 + thumbnail + caption file + licence table → board for approval + upload.
