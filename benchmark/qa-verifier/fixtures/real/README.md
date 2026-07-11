Real-source verifier bundles exported into TSBC scope on 2026-07-10 for [TSBC-998](/TSBC/issues/TSBC-998).

Bundles

- `double-outro-stale-intro-black-gap/` holds the hardened rerun report and late-tail OCR frames for the rejected cashflow flagship master `67d02eeb...`; the exported bundle proves the double-outro / stale-intro defects, while the bundled black-QA sidecar is already green on that exported master.
- `flat-bars-chart-render/` holds the pre-chartfix opener frame bundle from the superseded cashflow `v2-closeout` body.
- `apple-system-tts-audio/` holds the immutable rejected `TSM-5248` Jessica and James pack plus the staged `jj-sample-vo.wav`.
- `harsh-swoosh-transition/` holds the immutable rejected `TSM-5333` AV proxies and operator review docs from the harsh-transition pass.

Each bundle directory contains a `bundle-manifest.json` with source issue identifiers, copied file list, per-file SHA-256 values, and the primary artifact hash.
