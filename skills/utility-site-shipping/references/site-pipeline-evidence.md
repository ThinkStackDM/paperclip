# KISS utility-site evidence (ThinkStack KISS, company 6d2c1656)

Identifiers are THIAAA-*.

## Sites shipped (Ship Site #1–#13, 2026-05-26..27)
JSON Formatter (#1, with pipeline standup), Password Generator (#2), QR Code Generator (#3), Amortization Calculator (#4), PDF→Markdown (#5), Image Compressor (#6), Pomodoro (#7), Decision Wheel (#8), Calorie/TDEE (#9, "highest-CPM volume pick"), Image Cropper & Resizer (#10, "pipeline synergy + privacy moat"), Word Counter (#11, "biggest pure-volume win"), CRON Builder/Decoder (#12, "highest per-visitor revenue"), Age/Date Calculator (#13, "life-event ad inventory"). New batch 2026-06-11: Epoch Converter, Base64, Text Diff ("Scaffold P1 Utility Site - X").

## Scaffold + pipeline
- "Extract shared scaffold (create-site CLI + _chrome.css + _reporter.js)".
- "Scaffold inheritance: full SEO bundle in tools/create-site for site #9" — the scaffold-regression lesson.
- THIAAA-36 (#10 image cropper) done comment: vanilla HTML + ES modules scaffolded via `tools/create-site`; `OffscreenCanvas` worker; vendored lazy-loaded `libheif-js` wasm (~1.4MB); batch mode.
- THIAAA-38 (#12 cron-helper): "Live: https://cron-helper.pages.dev — 13/13 smoke checks passing" — the smoke-check done shape.
- "CI deploys broken: GitHub repo missing CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID secrets" — the CI-secrets failure.

## SEO waves
- W0.1 CWV baseline + budgets; W0.2 GSC verification + sitemaps (+ follow-up screenshots todo); W1.1 robots/sitemap; W1.2 titles/meta (THIAAA-21 — live view-source verification table per site, commit a20072b); W1.3 OG/Twitter + templated OG image; W1.4+W1.5 canonical + JSON-LD SoftwareApplication; W2.1 content block; W2.2 FAQ + FAQPage JSON-LD; W3.1 trust badge; W4.1 directory submissions (in_review at mining).
- 2026-06-10: "SEO audit + content backlog for top BrightToolStudio sites", "SEO Content Update: Improved Title/Meta/Intro for Top 3 Sites" then "for Remaining 10 Sites" — batch-refresh shape.

## Monetization
- "Wire GA4 + AdSense build-time plumbing across all 8 sites (single PR)" (2026-05-28).
- "Privacy + About pages for Batch 1"; "AdSense submission package draft"; "Finalize AdSense-prerequisite content (privacy/About/ads.txt) for brighttoolstudio.com"; "Provision info@brighttoolstudio.com mailbox + wire final contact details into /privacy + /about" (in_review).
- "Flip apex brighttoolstudio.com to the real umbrella landing page (replace noindex placeholder)" (in_review) — the 869B noindex shell observation is from THIAAA-892's live verification.

## DNS binding saga (THIAAA-892, done after multi-day stall)
- Zone `20584e2e0aa18375e4104d53c19bd628` is in the MC/GLaD0S CF account; KISS account (dc52a361d06fb1c27bd8cd22ea2268bf) has zero zones; KISS token Pages-scoped.
- All 13 custom domains registered on CF Pages → `pending` ("CNAME record not set").
- Relay via THIAAA-897/898 to GLaD0S intake (HTTP 202); Option A = DNS:Edit token, Option B = MC adds records.
- Failure shape: repeated no-change wakes ("DNS unchanged — still pending"), missing-disposition recovery prompts, and an `issue_children_completed` wake while subdomains were still NXDOMAIN. Lesson: blocked-with-owner + single verify sweep on callback.
- "Bind word-counter subdomain + audit unbound live sites" (cancelled dup) — duplicate-bind noise.
