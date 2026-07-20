# JJ Authoritative Motion Coverage Recheck After TSM-5456
**Issue:** TSM-5457 (restage on served tree for TSM-5449)
**Agent:** Designer-Media (f76dc1af-4c9e-467e-99bd-f48328421321)
**Date:** 2026-07-14
**Run ID:** b18d4c3b-492d-4974-84f9-a097e0a05880
**Previous served total (pre-restage):** 12 clips, 96.500004s (11 in motion/ + 1 in additional-motion-5456/)
**New clips staged:** 7 canon-safe motion MP4s from jj-motion-staged-pack-additional/ (all 8.041667s each)
**New served total:** 19 unique canon-safe motion clips, 152.7916s
**Remaining gap to locked 265s:** 112.2084s (truthfully documented; no still-board fallback or heavy looping used — additional canon motion generations required for full coverage per TSKB0083)
**Canon compliance:** All clips (original + new) match Jessica (purple flower canon), James canon, bipedal only, silent expressive grunt reactions, narrator-led storytelling visuals, documentary-noir aesthetic, no text, no white bg, no off-canon chars. Generated via xAI Grok video model.
**Beats covered (new slugs from TSM-5456 pack):**
- viewer-ask-01: jj-viewer-ask-01.mp4
- search-beat1-02: jj-search-beat1-02.mp4
- clue-escalation-03: jj-clue-escalation-03.mp4
- wrong-guess-04: jj-wrong-guess-04.mp4
- reveal-reunion-05: jj-reveal-reunion-05.mp4
- close-06: jj-close-06.mp4
- outro-07: jj-outro-07.mp4
**Staged locations (served tree source control paths):**
- Main motion/: 11 files under /.../TSM-5449/source/motion/ (intro-bookend.mp4, field-edge-reset.mp4, search-hiding-peeking.mp4, clue-escalation.mp4, clue-escalation-2.mp4, reveal.mp4, search-beat-1.mp4, search-beat-2.mp4, viewer-ask.mp4, wrong-guess-fakeout.mp4, close-outro.mp4) totaling 88.4583s
- Additional 5456/: now 8 files under /.../TSM-5449/source/additional-motion-5456/ (viewer-ask-1.mp4 + the 7 jj-*.mp4) totaling 64.3333s
**Per-file ffprobe summary (new 7):**
- All: h264 1280x720, duration exactly 8.041667s, size varies 2.3M-5.8M bytes
- jj-viewer-ask-01.mp4: sha256 f7e94da314ca4f1540eabec262479230a4857d8087bc109f57d80d0629bd627f
- jj-search-beat1-02.mp4: sha256 9a8b70213c951453f4eb0fcbe38611ac97ea121f6bceb17fcccc3273fbf9cb38
- jj-clue-escalation-03.mp4: sha256 baf3ea6c90852848364e179377dfd3da7484d34c135e439df8d04801294be1c8
- jj-wrong-guess-04.mp4: sha256 10cf9ea94bd02f331f1d02ecaa688030bfeadbff190124f3e6c4a12963f8ce5b
- jj-reveal-reunion-05.mp4: sha256 9803fbe89cca0c12bc2df60c3867dbcc28fde6301e2ff0fe159c9d147aace473
- jj-close-06.mp4: sha256 12c7349b9014c3a65586762a4b224a053f08d3ef183c8b2d28b2022c36e86dc1
- jj-outro-07.mp4: sha256 e0ccc643eb302a4ed4553ab573ba0f8e06fe4b38d2c399a50c6c39f7385e521a
**Source-pack manifest:** Updated by staging bytes; main tsm5448-staged-motion-files.json covers original motion/ pack. New additional files now on-disk in served additional-motion-5456/ matching the jj-motion-staged-pack-additional/ source exactly. No discrepancies.
**Handoff note:** TSM-5449 authoritative assembly can now reference the full 19-clip served pack (152.7916s). Remaining gap requires further canon motion generation (no fallback to stills). Matches TSKB0080/0083 requirements for motion-first authoritative runtime before assembly.
**Status:** Served tree coverage restaged and verified; gap truthfully reduced and documented. Issue complete.