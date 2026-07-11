# Media Mechanics Execution

These are media-finishing mechanics, not premium-lane strategy work. When the
brief is already scoped and the inputs already exist, the default owner is the
company media-execution lane: `Designer-Media` on `hermes_local / grok-4.3`.

## 1. Render / encode / assembly

- Use local `ffmpeg` / `ffprobe`, not premium video tools, when the task is
  finishing existing assets.
- Inspect every input first with `ffprobe`.
- Normalize every clip before concat to the house spec: `1920x1080`,
  `30fps`, `yuv420p`, `AAC 48kHz stereo`. Grok clips need a silent audio track
  added before they can join cleanly.
- Never upscale weak footage. Scale down or pad instead.
- Build the timeline after normalize. Hard cuts are the default. Crossfades are
  only for real act breaks.
- Keep one-encode discipline: normalize once, final export once. Container-only
  joins and remuxes should stay `-c copy`.
- Finish with VO over a ducked bed and normalize to about `-14 LUFS` /
  `-1.5 dBTP`, then export with `-movflags +faststart`.
- Escalate only when the footage itself exceeds the ceiling: long continuous
  photoreal shots, lip-sync, or broadcast-grade realism.

## 2. Captions / audio-bed mechanics

- Best transcript source is `assets/audio/vo.wav`; use the mixed cut only if
  the clean VO is missing.
- Convert the source to `16kHz` mono, run `whisper-cli` locally, and produce an
  `SRT`.
- Always do a human correction pass for brand names, acronyms, numbers, and
  cue timing.
- Long-form gets a sidecar `SRT`; Shorts and silent-autoplay assets get burned
  captions.
- For `9:16`, increase caption size and bottom margin so the text stays legible.
- Duck the music bed under VO with sidechain compression, then loudness-normalize.
- Do not use paid transcription APIs for this class of work.

## 3. Thumbnail / OG / promo tiles

- Image generation is fine for the background art. It is not the text layer.
- Render words with a real text renderer: `next/og` inside an app, or
  `satori` + `@resvg/resvg-js` in a standalone local script.
- Use the correct export size for the surface: `1280x720` for YouTube
  thumbnails, `1200x630` for OG cards.
- Keep the headline short, high-contrast, and mobile-legible. Prefer `3-5`
  words, safe margins, and one real brand font.
- Composite the clean text over the generated background with `sharp` or an
  equivalent local compositor.

## Output discipline

- Answer with concrete local tools, commands, or a compact operator runbook.
- Prefer deterministic finishing steps over vague creative direction.
- Do not wander into board approval, premium-tool shopping, or brand strategy
  unless the task actually hits the quality ceiling above.
