---
name: video-editing
description: >
  ThinkStack Media's ffmpeg editing reference — concrete commands for joining, trimming,
  transitioning, audio-mixing, captioning, overlaying, scaling, thumbnailing and exporting
  YouTube-ready 1080p video. Use whenever you have raw clips (grok-imagine-video output,
  b-roll, stills) and need to cut/assemble/finish them locally. ffmpeg is installed; other
  CLIs install on demand. For the full script→clips→finished-MP4 run use video-assembly-pipeline.
---

# Video Editing (ffmpeg)

ffmpeg lives at `/opt/homebrew/bin/ffmpeg` (8.x GPL build: libx264/265, aac, libmp3lame, xfade,
acrossfade, loudnorm, drawtext, subtitles, overlay). `ffprobe` ships with it. This is the editing
reference; **video-assembly-pipeline** drives these steps end-to-end; **video-gen-ops** owns the
generation package + handoff QA.

## TSM house spec (every YouTube deliverable unless the issue overrides)
1920x1080 · 30fps · yuv420p · AAC 48kHz stereo 192kbps · loudness -14 LUFS / -1.5 dBTP · MP4 `+faststart`.
Directory convention: `assets/gen/` (board/grok clips) · `assets/broll/` (sourced) · `assets/_norm/`
(normalized intermediates) · `assets/audio/` (VO+bed) · `assets/final/` (deliverables).

## THE ONE RULE: normalize before you concat
grok-imagine-video clips are ~8s, 720p, no audio, mixed fps. Concatenating mismatched streams
produces broken files. Normalize EVERY input to spec first, then concat is a lossless `-c copy`.

## 0. Inspect first
```bash
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of default=nw=1 assets/gen/clip-01.mp4
```
## 1. Normalize every input (scale+pad, force fps, add silent audio)
```bash
ffmpeg -y -i assets/gen/clip-01.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" \
  -c:v libx264 -preset medium -crf 18 \
  -f lavfi -i anullsrc=r=48000:cl=stereo -shortest -c:a aac -ar 48000 -ac 2 assets/_norm/clip-01.mp4
```
## 2. Trim
```bash
ffmpeg -y -ss 1.5 -i in.mp4 -t 4.0 -c:v libx264 -crf 18 -c:a aac assets/_norm/trim.mp4
```
## 3. Join — hard cuts (lossless, instant)
```bash
printf "file 'clip-01.mp4'\nfile 'clip-02.mp4'\n" > assets/_norm/list.txt
ffmpeg -y -f concat -safe 0 -i assets/_norm/list.txt -c copy assets/_norm/timeline.mp4
```
## 4. Join — crossfade (offset = clipA length − fade)
```bash
ffmpeg -y -i a.mp4 -i b.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=7.5[v];[0:a][1:a]acrossfade=d=0.5[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -c:a aac out.mp4
```
transitions: `fade dissolve fadeblack wipeleft slideup circleopen`.
## 5. Audio — VO over ducked music bed, normalized
```bash
ffmpeg -y -i timeline.mp4 -i assets/audio/vo.wav -i assets/audio/bed.mp3 -filter_complex "\
  [2:a]volume=0.9,afade=t=out:st=28:d=2[bed];\
  [bed][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300[duck];\
  [duck][1:a]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-14:TP=-1.5[a]" \
  -map 0:v -map "[a]" -shortest -c:v copy -c:a aac -b:a 192k assets/final/out.mp4
```
## 6. Captions (burn in from SRT — generate via auto-captions)
```bash
ffmpeg -y -i timeline.mp4 -vf "subtitles=captions.srt:force_style='FontName=Helvetica,FontSize=22,Outline=2,MarginV=60'" -c:v libx264 -crf 18 -c:a copy captioned.mp4
```
Soft captions (spec `srt`): ship the `.srt` beside the MP4, don't burn in. Burn in only for Shorts/silent autoplay.
## 7. Title cards / lower-thirds (timed)
```bash
ffmpeg -y -i timeline.mp4 -vf "drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:text='Title':fontsize=64:fontcolor=white:borderw=3:bordercolor=black@0.8:x=80:y=h-160:enable='between(t,1,5)'" -c:v libx264 -crf 18 -c:a copy titled.mp4
```
## 8. Watermark / logo (PNG alpha)
```bash
ffmpeg -y -i timeline.mp4 -i logo.png -filter_complex "[1]format=rgba,colorchannelmixer=aa=0.7[wm];[0][wm]overlay=W-w-40:H-h-40" -c:v libx264 -crf 18 -c:a copy wm.mp4
```
## 9. Still → motion (Ken Burns)
```bash
ffmpeg -y -loop 1 -i hero.png -t 5 -vf "scale=7680:4320,zoompan=z='min(zoom+0.0015,1.2)':d=150:s=1920x1080:fps=30,format=yuv420p" -c:v libx264 -crf 18 hero-kb.mp4
```
## 10. Thumbnail
```bash
ffmpeg -y -ss 6.0 -i timeline.mp4 -frames:v 1 -vf scale=1920:1080 assets/final/thumb.png
```
## 11. Final YouTube export
```bash
ffmpeg -y -i edit.mp4 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart assets/final/youtube-1080p.mp4
```
9:16 Shorts: scale/pad target `1080:1920`, keep captions burned in.

## QA before handing back
```bash
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of json assets/final/youtube-1080p.mp4
ffmpeg -ss 0 -i out.mp4 -frames:v 1 /tmp/first.png        # not black?
ffmpeg -i out.mp4 -af volumedetect -f null - 2>&1 | grep -E 'mean|max'
```
## Re-encode discipline
Encode once after normalize, once at final export. Use `-c copy` for container-only steps (concat,
watermark-over-encoded-timeline, remux). Never upscale b-roll; pad instead.
## Quality ceiling — when to stop and request premium
grok clips are 8s/720p/no-audio. ffmpeg joins/captions/finishes them into a clean 1080p cut but
can't add detail that isn't there. For shots >8s continuous, photoreal humans, or broadcast
fidelity → raise `[CREATIVE REQUEST] Flow/Veo: …` (see creative-stack) rather than over-process
weak footage. ffmpeg makes good footage finished, not bad footage good.
