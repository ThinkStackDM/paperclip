# JJ Book 1 15s Socials Trailer Prompt Pack
**Issue:** TSM-5635 (parent TSM-5557 priority 6)
**Agent:** Designer-Media (f76dc1af-4c9e-467e-99bd-f48328421321)
**Date:** 2026-07-20
**Status:** Delivered — operator-manual Veo prompt/source pack
**Canon compliance:** All prompts begin with "Do not change the character or style." Jessica (purple flower canon), James canon, bipedal only, silent expressive grunt reactions, narrator-led storytelling visuals, documentary-noir aesthetic. No text overlays, no speech, no off-canon elements. Per TSKB0082: picture-first only; no embedded audio present or claimed safe in any referenced source.
**Sources checked (locked/canon only):** 
- work-products/TSM-5449/jj-authoritative-motion-coverage-recheck-after-tsm-5456-2026-07-14.md (19 canon motion clips, 152s+ total; 7 new staged: viewer-ask-01, search-beat1-02, clue-escalation-03, wrong-guess-04, reveal-reunion-05, close-06, outro-07 — all 720p 16:9 ~8s h264 no audio)
- work-products/TSM-5449/jj-motion-staged-pack-additional/ (source MP4s with SHA256 provenance)
- work-products/TSM-5398/outputs/provenance-manifest.json + scenes/bookends (intro/outro bookends, cold-open-peek, search-path, reveal-reunion stills; all canon prompts prefixed correctly)
- work-products/TSM-5448 references (prior full motion source pack, already validated)
- TSKB0082-jj-authoritative-motion-packs-must-audio-screen-embedded-clip-tracks.md (active law: picture-first)
**Target specs:** 15s total socials trailer (vertical 9:16 preferred for Reels/Shorts/TikTok; fallback 16:9). 720p or 1080p. 3 primary beats (hook 5s + middle 5s + close/CTA 5s). Operator runs Veo manually with these exact prompts + references canon clips/stills for style/pose consistency. No new visual family invented.
**Runnable flags:** All shots runnable-now with current locked assets (no waiting-on-better-assets). Prompts designed for direct Veo use or as style/pose references from existing MP4s/PNGs. Trim/sequence existing 8s clips downstream if preferred over full regen.

## Shot 1: Hook / Opening (0-5s)
**Target filename:** jj-book1-trailer-hook-01.mp4
**Duration/Aspect:** 5s, 9:16 (vertical socials crop; 16:9 safe fallback)
**Source refs:** intro-bookend.mp4 + jj-search-beat1-02.mp4 + jj-demo-intro-master-1080p.png (TSM-5398)
**Intended cut/beat usage:** Cold open tension + partnership establish; quick cut to search phase for social hook.
**Veo prompt (exact, copy-paste ready):**
```
Do not change the character or style. Professional 5-second vertical socials trailer hook for JJ Book 1: wide cinematic opening with Jessica (purple flower canon design, bipedal hiding/peeking pose from locked GOOD tiles 4rb8gk) and James (canon bipedal) side-by-side at field edge, expressive silent surprise/grunt reaction, narrator-led storytelling visual, documentary-noir aesthetic, high quality motion, clean dark gradient background suitable for fast social cut, no text, no speech.
```
**Runnable now:** yes

## Shot 2: Middle Beat (5-10s)
**Target filename:** jj-book1-trailer-middle-02.mp4
**Duration/Aspect:** 5s, 9:16
**Source refs:** jj-clue-escalation-03.mp4 + jj-search-beat1-02.mp4 + jj-demo-scene-search-path.png (TSM-5398)
**Intended cut/beat usage:** Clue escalation and search tension; builds mystery for Book 1 trailer.
**Veo prompt (exact, copy-paste ready):**
```
Do not change the character or style. Professional 5-second vertical socials trailer middle beat for JJ Book 1: dynamic motion of Jessica (purple flower canon, bipedal peeking/search pose) and James tracking clues in noir field setting, clue-escalation beat from locked staged pack, expressive silent reactions only, narrator-led visual storytelling, documentary-noir, high quality 720p motion, no text, no speech.
```
**Runnable now:** yes

## Shot 3: Close / CTA Beat (10-15s)
**Target filename:** jj-book1-trailer-close-03.mp4
**Duration/Aspect:** 5s, 9:16
**Source refs:** jj-reveal-reunion-05.mp4 + jj-close-06.mp4 + jj-outro-07.mp4 + jj-demo-outro-master-1080p.png (TSM-5398)
**Intended cut/beat usage:** Reveal/reunion resolution + positive close for CTA (visual only; narrator sign-off implied, space for end slate text in post).
**Veo prompt (exact, copy-paste ready):**
```
Do not change the character or style. Professional 5-second vertical socials trailer close/CTA beat for JJ Book 1: emotional reveal and reunion of Jessica (purple flower canon, bipedal proud/kind pose from ah907x GOOD) and James, warm resolution in documentary-noir style, expressive silent grunt reactions, narrator-led positive close, high quality motion, clean fade-to-dark gradient for credits/CTA overlay in post, no text on video, no speech.
```
**Runnable now:** yes

## Usage Notes for Operator
- Run each prompt independently in Veo (or equivalent) with temperature/seed consistency for style match to canon sources.
- Reference the listed MP4s/PNGs as visual/style guides or seed images where supported.
- Post-process: trim to exact 5s per beat, vertical crop if needed, sequence with 0.5s crossfades, add Book 1 title/CTA text + licensed music in editor (audio screened separately per TSKB0082).
- Total runtime target: exactly 15s. Provenance preserved via source SHA/manifest refs.
- If vertical crop loses key action, regenerate with explicit "vertical 9:16 composition, centered subjects" added to prompt.
- All generations must remain canon-safe; re-verify against TSM-5449 staged pack before final assembly.

**Deliverable complete.** One governed markdown pack produced under work-products/TSM-5635/. No additional assets generated here (Veo operator-manual per scope). Matches minimum deliverable and binding rules. Ready for TSM-5557 queue advancement.