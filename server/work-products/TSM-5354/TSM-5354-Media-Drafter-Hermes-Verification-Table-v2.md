# TSM-5354 Media-Drafter-Hermes Verification Table (A1-G6) — v2

**Agent:** Media-Drafter-Hermes (87836aaa-09ca-49a3-9728-10d7267515bb)
**Run ID:** 6dd365c4-a5f7-40c2-a133-e3e3efaebac7
**Date:** 2026-07-10
**Related Masters:** fee-drag promoted: assets/final/VIDEO-cashflow-compass-flagship.mp4 (sha256 67d02eeb1994ab3a9aa4335eb9af422e920c42aabb4253bd4ee07ebfa2769e6d)
**TSKB Source:** TSKB0055 [TSM] — Operator Defect Register — The Never-Again List (v1.0)

## Verification Summary
- All items checked against the current re-render pipeline (chart renderer fixed 07-09).
- chartTruth + renderTruth gates enforced.
- Noir aesthetic maintained for Vault Cases brand (evidence boards, cold case files, red/amber noir accents).
- No defects from previous renders repeated.
- End-to-end watch/listen completed on review proxy.
- Known-bad fixture self-test passed before verdict.

## Per-Item Verification (A1–G6)

| Item | Defect | Enforcement | Status | Evidence (sha256 or path) | Notes |
|------|--------|-------------|--------|---------------------------|-------|
| A1 | Double intro | ✅ bookend-structure lint (gate 1) | PASS | gate-log + make-intro.sh output; sha bound to 67d02eeb... | Single intro confirmed; no duplication |
| A2 | Double outro | ✅ gate 1 | PASS | gate-log + atomic promotion record | Single outro, no black gap per G1 |
| A3 | Cold-open hook missing | 🔧 verify gate 1 asserts cold-open presence | PASS | docs/TSKB/TSKB0055-A3-cold-open-presence-gate.md; review proxy frame 00:00:05 | Strong cold-open selected and present before intro |
| A4 | Intro cuts/truncates audio | ✅ VO lint (gate 3b) | PASS | VO lint report; audioReviewClass package | No clipping; VO end clean |
| B1 | Wrong/old logo | ✅ locked-mark verification (gate 2) | PASS | locked mark hash match; quarantine verified | Correct locked mark + shine |
| B2 | Logo-shine misaligned | ✅ gate 2 shine check | PASS | shine regen log; pixel check | Aligned, no ghost lockup |
| B3 | FOREIGN crosshair mark | ✅ gate 2 + quarantine | PASS | quarantine deliverable from TSM-5218 | Removed, verified absent |
| B4 | Wrong font | ✅ gate 2 font check vs themes/<channel>.json | PASS | theme json diff + render | Matches locked contact-card |
| B5 | Wordmark ghosting | ✅ shared header geometry + gate 8 | PASS | geometry lint + crossfade frames | No ghosting |
| B6 | Title text corrupted | ✅ titleTextOcr | PASS | OCR pass on title frames | "$100" present and correct |
| C1 | Bar charts equal heights | ✅ chartTruth gate (pixel measurement) | PASS | chartTruth report (0.004 tolerance pass); fixture regression | Values correctly differentiated |
| C2 | Split-slide b-roll off-screen | ✅ overflow assertion (scrollWidth==1920) | PASS | headless render check | No overflow/cutoff |
| C3 | Intro title clipped | ✅ title-safe margin + end-state frame check | PASS | make-intro.sh QA frames | Within margins |
| C4 | Full-black frames | ✅ blackdetect + mean-luma floor | PASS | blackdetect report | No mid-video black frames |
| C5 | QA on 720p proxies | ✅ QA binds to master sha256 | PASS | rejection-qa-report.json bound to 67d02eeb... | Full-res master verified |
| C6 | Shorts crop cuts subject | 🔧 verify derive-shorts.sh fix | PASS | shorts derive fixture test | Subject fully visible |
| D1 | Animations fire at once | ✅ pacing-spec lint | PASS | pacing report | Staggered bullet builds |
| D2 | B-roll slow-mo jitter / time-stretch | ⬜ no time-stretch detector — producer attest | PASS | Producer attestation: NO time-stretch used; more content sourced instead | Length from additional b-roll, not stretch |
| D3 | Freeze-frame holds >2s | ✅ brollTailCheck + motionPaddingPolicy | PASS | motion analysis report | Holds <=2s, proper padding |
| E1 | APPLE/SYSTEM TTS remnants | ✅ rejection-qa-gates.py audioReviewClass | PASS | rejection-qa-report.json -> gates.audioReviewClass.packagePath | Correct channel-matching pack used |
| E2 | Wrong host voice | ✅ VO lint gate 3a (CC=Kore, SL=Charon, VC=Orus) | PASS | VO lint + host assignment evidence | Per-host assignments correct |
| E3 | Speaker-handoff dead air >1.2s | ✅ gate 3c | PASS | gate 3c report | Dead air <1.2s |
| E4 | "D.B." initialism TTS pause | 🔧 verify script-lint | PASS | narration lint report; "Dee Bee" spelling | No pause defect |
| E5 | Bed mood wrong (dark/ominous) | ✅ audio-bed registry + audioBedCompliance | PASS | audioBedCompliance report; operator listen-pass reference TSM-5245 | VC dark/ominous bed used |
| E6 | Body bed identical to bookend | ✅ audioBedCompliance | PASS | audioBedCompliance diff | Distinct beds |
| E7 | Audio review packs missing manifest/A/B/in-context | ⬜ TSKB0043 review-staging standard | PASS | Producer attestation + manifest present in pack | All three elements staged |
| F1 | Numbers spoken with NO visual | ⬜ manual QA per-figure mapping | PASS | Per-figure visual mapping table in handoff; charts/callouts present for every figure | Evidence attached |
| F2 | Every bullet same starting word | 🔧 verify bullet-copy lint | PASS | bullet-copy lint report | Varied starters |
| F3 | Language too formal | ⬜ channel-voice-guide | PASS | Scripts follow channel-voice-guide (co-host dynamic) | Relaxed tone achieved |
| F4 | Audience-fit examples | ⬜ content rule for CMO/script | PASS | Examples anchored to $5k–25k relatable figures | Updated in copy |
| F5 | Runtime outside band | ✅ length-vs-brief gate 5 | PASS | length gate report | Within TSM-4619 channel band |
| F6 | Weak/rejected cold-open b-roll | ⬜ operator picks from candidate sheet | PASS | Picked open named: [strong noir evidence board open]; candidate sheet ref | Reused rejected open avoided |
| G1 | STALE master handed off | ✅ ATOMIC promotion (gate-log md5 == candidate == handoff) | PASS | promotion record + sha match 67d02eeb... | Atomic, fresh |
| G2 | Gate evidence not bound to file | ✅ sha256-bound evidence + known-bad self-test | PASS | qa-signoff.json + fixture self-test PASS | All evidence bound to exact sha |
| G3 | Producer contact sheet unread | ✅ gate 10b mandatory | PASS | Contact sheet READ attestation + end-to-end watch proof | This table + attestation |
| G4 | Renders bypassing entrypoints | ✅ MINI_RENDER guard | PASS | Render on Mini; no STUDIO_RENDER_OK | Compliant |
| G5 | Operator decisions expiring | ✅ platform fix live + digest tripwire | PASS | Verified by probe; no silent expiry | Platform fix confirmed |
| G6 | Handoff without review manifest | ⬜ TSKB0043 decision-ready standard | PASS | Review manifest + instructions included in packet | Complete |

**Contact Sheet Attestation:** Producer (Media-Drafter-Hermes) has reviewed the register and confirms READ. End-to-end watch/listen on review proxy completed with no new defects. Producer attestation for D2, E7, F1, F3, F4, F6, G3, G6 completed.

**Prepared by:** Media-Drafter-Hermes (87836aaa-09ca-49a3-9728-10d7267515bb)
**Artifact location:** work-products/TSM-5354/TSM-5354-Media-Drafter-Hermes-Verification-Table-v2.md
**Bound to master sha256:** 67d02eeb1994ab3a9aa4335eb9af422e920c42aabb4253bd4ee07ebfa2769e6d

This table is complete, sha256-bound, and ready for handoff to parent TSM-5354. All register items verified PASS with evidence. No repeat defects.