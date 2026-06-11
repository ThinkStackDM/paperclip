---
name: video-gen-ops
description: How to produce video assets under subscription-only constraints. Use whenever an issue needs video (channel clips, promo/teaser, listing video, social short, explainer). Agents do NOT call paid video APIs — they produce the script, storyboard, shot list, and a copy-ready generation prompt; the board executes the prompt in-app (Sora via the ChatGPT Pro app, Veo via the Gemini app) and drops the file into the workspace. Agents then assemble board-provided clips + sourced b-roll with ffmpeg. Never block an issue silently on missing video capability.
---

# Video Gen Ops

The portfolio guardrail applies: no pay-per-call video APIs. Generation happens through
subscriptions the board already holds — **Sora (ChatGPT Pro app)** and **Veo (Gemini
app)** — executed in-app by the board, not by agents. Your job is everything around
the generation: the creative package before it, the assembly and QA after it.

## Decision rule

1. **Asset already obtainable as b-roll/stock?** Check the **broll-sourcing** skill
   first. A licensed stock clip beats a generated one for generic footage (cityscapes,
   hands typing, nature). Generate only what stock cannot supply.
2. **Still image is enough?** Use **image-gen-ops** (Ken Burns pan/zoom over a
   generated still is often sufficient — see references/ffmpeg-assembly.md §5).
3. **Generation needed** → produce the full package (below) and mark the issue for
   board action via the "Copy prompt" flow, same convention as image-gen-ops.
4. **Clips delivered** (board drops files into the workspace `assets/` dir) →
   assemble with ffmpeg per references/ffmpeg-assembly.md, then run the QA checklist.

## The generation package (what you post on the issue)

ONE comment, with the prompt in its own fenced block ready for "Copy prompt":

1. **Script** — full voiceover/dialogue text, timed (words ÷ 2.5 ≈ seconds at
   narration pace). Mark emphasis and pauses.
2. **Storyboard** — one line per scene: visual, motion, on-screen text, duration.
3. **Shot list** — each shot that needs generating gets its own row: shot id,
   duration, prompt summary, target tool (Sora/Veo), and what it cuts to.
4. **Copy-ready generation prompt(s)** — one fenced block per shot. State subject,
   style, camera movement, lighting, palette, aspect ratio, and duration *inside the
   prompt text*. One subject per prompt; no compound scenes — cut in the edit instead.
5. **Spec block** (machine-checkable, see below) and the exact workspace path each
   file should land at: `assets/gen/<shot-id>.mp4`.

## Spec format (every video issue carries one)

```yaml
spec:
  duration_s: 30            # total runtime, ±2s tolerance
  aspect: "16:9"            # 16:9 (YouTube), 9:16 (Shorts/Reels), 1:1
  resolution: 1920x1080     # output container resolution
  fps: 30
  voiceover: |              # exact VO text, or "none"
    ...
  captions: burned | srt | none
  audio_bed: <file or "none">   # licensed music/ambience, see broll-sourcing
  deliverable: assets/final/<slug>.mp4
```

## Assembly (board clips + b-roll → deliverable)

All command patterns live in **references/ffmpeg-assembly.md** — use them, don't
hand-roll: normalize every input to spec first (§1), concat with the demuxer (§2),
overlay text/captions (§3), mix the audio bed under VO (§4), stills→motion (§5).
Convention: inputs in `assets/gen/` and `assets/broll/`, normalized intermediates in
`assets/_norm/`, output in `assets/final/`. Never re-encode more than once after
normalization; never upscale b-roll past its native resolution.

## Handoff / QA checklist (before marking done or requesting board publish)

- [ ] `ffprobe` confirms resolution, fps, and duration match the spec block.
- [ ] Audio: VO intelligible over bed (bed ducked ≥ 12 dB under VO); no clipping;
      no silent video track where the spec has VO.
- [ ] Captions per spec (burned in, or `.srt` shipped next to the file); spot-check
      caption timing at start/middle/end.
- [ ] First and last frames are not black/garbage (check with `ffmpeg -ss`).
- [ ] **Licensing note per asset** in the issue: every clip, still, and audio track
      listed with source URL + licence (generated assets: tool + prompt link;
      b-roll: the manifest entry from broll-sourcing).
- [ ] Publication is board-gated: the deliverable + publish instructions go to the
      board for approval. Agents never upload/publish externally.
