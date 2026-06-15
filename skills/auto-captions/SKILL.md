---
name: auto-captions
description: >
  Generate accurate captions/subtitles for TSM videos from a voiceover or finished cut using
  whisper.cpp (free, on-device, no API) → a clean SRT to ship as soft captions or burn in with
  ffmpeg. Use whenever a video needs captions, an SRT for upload, or burned-in captions for Shorts.
---

# Auto-Captions (whisper.cpp + ffmpeg)

Captions are a retention + accessibility requirement on every TSM video. Generate on-device with
**whisper.cpp** — free, no API key (portfolio guardrail: no paid transcription APIs).

## Source of truth (cleanest audio wins)
1. VO file (`assets/audio/vo.wav`) — best. 2. pre-mix cut. 3. finished MP4 (extract audio, music degrades accuracy).
whisper wants 16kHz mono:
```bash
ffmpeg -y -i assets/audio/vo.wav -ac 1 -ar 16000 assets/audio/_vo16.wav
```
## Setup (once, lazy install)
```bash
brew install whisper-cpp     # + fetch ggml-base.en.bin once (small.en/medium.en for accents/technical)
```
## Generate
```bash
whisper-cpp --model models/ggml-base.en.bin --output-srt --output-file assets/audio/captions --max-len 42 assets/audio/_vo16.wav
```
## Quality pass (always — whisper is good, not perfect)
- Fix brand/product names, numbers/currency, acronyms, homophones.
- **YMYL (Cashflow Compass):** any number/% in a caption is an on-screen claim — must match the
  script's declared figure exactly; caption those lines from the script text, not the ASR.
- Spot-check timing at first/middle/last cue.
## Ship
- spec `srt` → place `assets/final/<slug>.srt` beside the MP4 (board uploads it). Don't burn in.
- spec `burned` (Shorts/silent autoplay) →
```bash
ffmpeg -y -i cut.mp4 -vf "subtitles=captions.srt:force_style='FontName=Helvetica,FontSize=22,Outline=2,MarginV=60'" -c:v libx264 -crf 18 -c:a copy cut-captioned.mp4
```
For 9:16 bump FontSize ~28, MarginV ~120.
## Limits
Strong on clean English VO; step up the model for accents/overlap/non-English or flag for human review.
Transcribes speech not music/SFX. Never use a paid transcription API.
