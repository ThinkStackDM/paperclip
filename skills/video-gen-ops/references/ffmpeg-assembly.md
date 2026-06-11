# ffmpeg assembly conventions

Concrete command patterns for stitching board-provided generated clips and sourced
b-roll into a spec-conformant deliverable. Tested against ffmpeg 7/8. Directory
convention: `assets/gen/` (board-dropped generated clips), `assets/broll/` (sourced
stock, see broll-sourcing), `assets/_norm/` (normalized intermediates), `assets/audio/`
(VO + bed), `assets/final/` (deliverables).

## 0. Inspect before you touch

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,avg_frame_rate,duration \
  -of json assets/gen/shot-01.mp4
```

Generated clips arrive in mixed resolutions/fps (Sora and Veo defaults differ).
Everything gets normalized before concat — concat of mismatched streams produces
broken files or silent failures.

## 1. Normalize every input to spec

Scale-with-padding (no distortion, letterbox if aspect differs), force fps, pixel
format, and a uniform audio track (concat requires ALL inputs to have the same
stream layout — add silent audio to clips that have none):

```bash
ffmpeg -y -i assets/gen/shot-01.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" \
  -c:v libx264 -preset medium -crf 18 \
  -af "aresample=48000" -c:a aac -ar 48000 -ac 2 \
  assets/_norm/shot-01.mp4
```

Clip with no audio stream — synthesize silence so stream layouts match:

```bash
ffmpeg -y -i assets/broll/city.mp4 -f lavfi -i anullsrc=r=48000:cl=stereo -shortest \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" \
  -c:v libx264 -preset medium -crf 18 -c:a aac -ar 48000 -ac 2 \
  assets/_norm/broll-city.mp4
```

Trim while normalizing (use input seeking for speed, output `-t` for accuracy):

```bash
ffmpeg -y -ss 2.0 -i assets/broll/city.mp4 -t 4.0 ... assets/_norm/broll-city.mp4
```

## 2. Concat (the demuxer, not the filter, for same-spec inputs)

```bash
cat > assets/_norm/concat.txt <<'EOF'
file 'shot-01.mp4'
file 'broll-city.mp4'
file 'shot-02.mp4'
EOF
ffmpeg -y -f concat -safe 0 -i assets/_norm/concat.txt -c copy assets/_norm/timeline.mp4
```

`-c copy` works because §1 made everything identical — this is the whole point of
normalizing first. If you need crossfades instead of hard cuts, use `xfade` between
pairs (re-encodes; keep it to key transitions):

```bash
ffmpeg -y -i a.mp4 -i b.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=3.5[v];[0:a][1:a]acrossfade=d=0.5[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -c:a aac out.mp4
```

## 3. Text overlay / captions

Title card or lower-third with drawtext (escape `:` and `'` in text; on macOS a safe
font path is `/System/Library/Fonts/Helvetica.ttc`):

```bash
ffmpeg -y -i assets/_norm/timeline.mp4 -vf \
  "drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:text='Cashflow Compass':fontsize=72:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,0,3)'" \
  -c:v libx264 -crf 18 -c:a copy assets/_norm/titled.mp4
```

Burned-in captions from an `.srt` (force a readable style):

```bash
ffmpeg -y -i assets/_norm/timeline.mp4 -vf \
  "subtitles=captions.srt:force_style='FontSize=22,Outline=2,MarginV=40'" \
  -c:v libx264 -crf 18 -c:a copy assets/_norm/captioned.mp4
```

Soft captions (spec says `captions: srt`): ship `assets/final/<slug>.srt` next to the
mp4; do not mux mov_text unless the destination platform requires it.

## 4. Audio bed under voiceover

Duck the bed 12+ dB under VO with sidechain compression, trim bed to video length,
2 s fade-out:

```bash
ffmpeg -y -i assets/_norm/captioned.mp4 -i assets/audio/vo.wav -i assets/audio/bed.mp3 \
  -filter_complex "\
    [2:a]volume=0.9,afade=t=out:st=28:d=2[bed];\
    [bed][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300[ducked];\
    [ducked][1:a]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5[a]" \
  -map 0:v -map "[a]" -shortest -c:v copy -c:a aac -b:a 192k \
  assets/final/deliverable.mp4
```

Simpler no-VO case (bed only, normalized to -16 LUFS for web):

```bash
ffmpeg -y -i video.mp4 -i bed.mp3 -map 0:v -map 1:a -shortest \
  -af "loudnorm=I=-16:TP=-1.5" -c:v copy -c:a aac -b:a 192k out.mp4
```

## 5. Stills → motion (Ken Burns), the cheap shot

A generated still (image-gen-ops) becomes a 5 s 1080p pan/zoom clip — render at 4x
and zoompan to avoid jitter:

```bash
ffmpeg -y -loop 1 -i assets/gen/hero.png -t 5 \
  -vf "scale=7680:4320,zoompan=z='min(zoom+0.0015,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1920x1080:fps=30,format=yuv420p" \
  -c:v libx264 -crf 18 assets/_norm/hero-kb.mp4
```

## 6. Final QA probes

```bash
ffprobe -v error -show_entries format=duration:stream=width,height,avg_frame_rate -of json assets/final/deliverable.mp4
ffmpeg -ss 0 -i assets/final/deliverable.mp4 -frames:v 1 /tmp/first.png   # first frame
ffmpeg -sseof -1 -i assets/final/deliverable.mp4 -frames:v 1 /tmp/last.png # last frame
ffmpeg -i assets/final/deliverable.mp4 -af volumedetect -f null - 2>&1 | grep -E 'mean_volume|max_volume'
```
