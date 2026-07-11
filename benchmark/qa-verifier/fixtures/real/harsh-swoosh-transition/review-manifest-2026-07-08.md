# TSM-5333 review manifest

Decision requested: confirm the recommended in-context audio treatment for CC, SL, JJ, and VC so TSM-5331 can upload the final review set and reopen operator review.

Recommendation summary

- CC: keep the current bed family with the refreshed real-Kore render. Recommendation: approve variant A.
- SL: keep the current bed family with the refreshed real-Charon render. Recommendation: approve variant A.
- JJ: use the documented pilot voice `Aoede` instead of the prior provisional fallback. Recommendation: approve variant A.
- VC: choose between two treatments built from the same transcript and the same newly sourced base bed `dark-ambient-backgrounding-001.mp3`.
- VC recommendation: variant A. It stays lower and more investigative while variant B adds more cinematic lift from the same content base.

What each file is

- `packages/cc-review-pack.json`: Cashflow Compass package manifest with one rendered AV proxy.
- `packages/sl-review-pack.json`: Stack Lab package manifest with one rendered AV proxy.
- `packages/jj-review-pack.json`: Jessica and James package manifest with one rendered AV proxy.
- `packages/vc-review-pack.json`: Vault Cases A/B package manifest with two rendered AV proxies built from the same content base.
- `gate-results/suite-summary.json`: `B-audio` gate-suite result proving the rebuilt pack clears scratch-TTS, A/B integrity, and review-staging checks.

Rendered AV proxies

- CC: `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/cc-sample.mp4` | voice `Kore` | duration `30.0`s | sha256 `cab41dfb58f78be766f099c035fe792e666d3087cb596112896040700ce6b58f`
- JJ: `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/jj-sample.mp4` | voice `Aoede` | duration `30.0`s | sha256 `bb099be4b77bae83c14e01270f9d9593b67b5870f0ad82b81dd5ec9fbd54d516`
- SL: `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/sl-sample.mp4` | voice `Charon` | duration `30.0`s | sha256 `6f1e600f5c36ab9433db32dce3176b7a242b8e0fb5572f821d66f2beb2204d07`
- VC A: `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/vca-sample.mp4` | voice `Orus` | duration `30.0`s | sha256 `ffa93919b5a5af14e91c204b3341873abaa98028b2737378870cfd34bfb91f54`
- VC B: `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/vcb-sample.mp4` | voice `Orus` | duration `30.0`s | sha256 `e86824f027acbbd589d257d5b2e83b1cbe31d879de33b40f932f3f973ccf025c`

Variant differences for VC

- Variant A: same transcript/base bed, `deep-whoosh-1`, heavier ducking (`15.0 dB`), quieter target (`-14.4 LUFS`).
- Variant B: same transcript/base bed, `deep-whoosh-3`, lighter ducking (`11.8 dB`), slightly hotter target (`-13.6 LUFS`).

QA status

- Mechanical gates: pass.
- Human end-to-end listening: not completed in this CLI heartbeat; see `qa-evidence-2026-07-08.md` for the explicit blocker before any restage/upload.
