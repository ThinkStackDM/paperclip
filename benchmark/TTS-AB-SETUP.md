# TTS A/B setup — operator steps (do when ready; voice is deferred until the video's in better shape)

Goal: get 3 narration samples of the **same Stack Lab V1 script** so TSBC can score naturalness + cost side-by-side, then you pick the production voice. **Testing costs ~$0–0.25 — no paid plan needed to test.** (Premium plan only comes after you pick a winner.)

## The 3 contenders
| engine | test cost | quality class |
|---|---|---|
| **ElevenLabs** | $0 (free tier, ~10 min/mo — the ~8-min script fits) | premium / most natural |
| **OpenAI tts-1-hd** | ~$0.24 (one script) | clean neural cloud |
| **F5-TTS** (open-source) | $0 (self-hosted, TSBC runs it) | best free option |

## What you need to create (the only friction — we have NO TTS keys today; codex's ChatGPT sub does NOT grant TTS-API access)

### 1. ElevenLabs (free)
1. Sign up at https://elevenlabs.io (free tier).
2. Profile (top-right) → **API Keys** → Create → copy it.
3. Note: free tier is **non-commercial** — fine for this *test*; a paid tier (~$22–99/mo) only when we go live with it.

### 2. OpenAI API key (~$5) — *separate from ChatGPT/codex*
1. https://platform.openai.com → **API keys** → Create new secret key → copy it.
2. Billing → add ~$5 credit (the test spends ~$0.24).
3. *(Zero-spend alternative if you'd rather not use a card: Google Cloud TTS has a free tier — 1M WaveNet chars/mo. More setup. Tell me if you prefer this and I'll write those steps instead.)*

## How to hand them over
Don't paste the keys in chat. Either:
- Drop them in a local file `~/.tts-keys.env` as `ELEVENLABS_API_KEY=...` and `OPENAI_API_KEY=...` (chmod 600), and tell me it's there — I'll load them into the secrets service (never echoed), **or**
- Tell me you've got them and I'll walk you through setting them via the secrets service.

Secret names TSBC's voice-benchmark will read: **`ELEVENLABS_API_KEY`**, **`OPENAI_API_KEY`** (and `GOOGLE_TTS_*` if you go that route).

## Then (my side)
TSBC runs the voice A/B on the SL V1 script → you get **3 audio samples + naturalness + per-video cost** in one comparison → you pick the production voice. We swap it into the render pipeline on top of the improved video.

---
*Status: keys pending (davin, ~next day). Voice work resumes after the video render + brand packs are at a better place.*
