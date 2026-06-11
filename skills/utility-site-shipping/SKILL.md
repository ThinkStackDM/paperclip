---
name: utility-site-shipping
description: ThinkStack KISS playbook for shipping and monetizing single-purpose utility sites under brighttoolstudio.com. Use for "Ship Site #N", "Scaffold P1 Utility Site - <name>", SEO wave work ("SEO W1.2 — Rewrite titles + meta-descriptions", "SEO Content Update"), AdSense/GA4 wiring, or domain-binding issues ("Bind the N utility sites to brighttoolstudio.com"). Encodes the create-site scaffold, the W0–W4 SEO bundle, smoke-check verification, CF Pages deploy, and the MC-owned DNS zone gotcha.
---

# Utility Site Shipping

KISS ships small, pure client-side utility sites (13 live at last count: JSON formatter, password generator, QR generator, amortization calculator, PDF→Markdown, image compressor, Pomodoro, decision wheel, calorie/TDEE, image cropper, word counter, CRON helper, age calculator) on Cloudflare Pages, monetized via AdSense under the **brighttoolstudio.com** umbrella. Marginal cost per site must stay near zero — everything below exists so site #N+1 reuses site #N's pipeline.

## Shipping a new site ("Ship Site #N" / "Scaffold P1 Utility Site - X")

1. **Scaffold with the shared tooling**: `tools/create-site` CLI + shared `_chrome.css` + `_reporter.js` (extracted on THIAAA "Extract shared scaffold"). The scaffold now inherits the **full SEO bundle** (post site-#9 fix) — robots.txt, sitemap.xml, canonical, OG/Twitter tags, JSON-LD `SoftwareApplication`, content + FAQ blocks, trust badge. If a new site is missing any of these, the scaffold regressed; fix the scaffold, not just the site.
2. **Build pure client-side** (vanilla HTML + ES modules). Privacy is the moat: "no data leaves your browser" is both a trust badge and an engineering constraint. Heavy work goes off-main-thread (the image cropper's `OffscreenCanvas` worker is the precedent); large wasm deps are vendored + lazy-loaded.
3. **Smoke checks are the done gate.** Every site ships with scripted smoke checks and the done comment states the count ("13/13 smoke checks passing") plus the live URL. "Works locally" is not done.
4. **Deploy via CI to CF Pages** (`<site>-xxx.pages.dev` first). CI needs repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — their absence has silently broken deploys before; if CI deploys fail, check secrets first.
5. **Verify live, not just built**: view-source the deployed URL for the title/meta/JSON-LD you shipped (the W1.2 pattern — a per-site verification table in the done comment).

## SEO waves (apply to every site; the scaffold carries them for new ones)

Numbered waves from the Book-of-record issues: **W0** CWV baseline + GSC verification + sitemaps → **W1** robots/sitemap, keyword titles + meta-descriptions, OG/Twitter + templated OG image, canonical + JSON-LD → **W2** "what it does + how to use it" content block, FAQ block + FAQPage JSON-LD → **W3** "no data leaves your browser" trust badge → **W4** free-tool directory submissions. Content refreshes ("SEO Content Update: Improved Title/Meta/Intro") batch the top sites first, then the remainder — one PR per batch.

## Monetization prerequisites (AdSense)

Before submission, every site needs: **privacy page, about page, ads.txt**, contact details (info@brighttoolstudio.com), and GA4 + AdSense **build-time plumbing** (wired across all sites in a single PR — "Wire GA4 + AdSense build-time plumbing"). The apex must be a real umbrella landing page, **not the noindex placeholder** (the 869B `noindex` shell sat on the apex blocking AdSense readiness — check `curl -s https://brighttoolstudio.com | grep robots`).

## Domain binding — the MC zone gotcha (THIAAA-892)

The brighttoolstudio.com **DNS zone lives in the MC/GLaD0S Cloudflare account** (zone `20584e2e0aa18375e4104d53c19bd628`), NOT in KISS's account. KISS's CF token is **Pages-scoped only** — it can register custom domains on Pages projects but cannot write DNS records. Binding a site therefore has two halves:

1. **KISS side (do immediately)**: register `<tool>.brighttoolstudio.com` as a custom domain on the CF Pages project. It will sit `pending` ("CNAME record not set") — that is expected, not an error.
2. **MC side (relay, don't poll)**: request the proxied CNAME via the GLaD0S/MC intake channel — ask for **Option A** (a DNS:Edit-scoped token for the zone, preferred) or **Option B** (MC adds the records). Then mark the bind issue `blocked` with unblock owner = GLaD0S (MC) and the exact records needed. Do NOT burn heartbeats re-checking DNS that hasn't changed — the continuation path is: MC callback → MCInboundHandler → CEO → re-wake the bind issue, then run the verify sweep (resolve + TLS + Pages status flips to active) in one pass.

Prep/relay child issues closing does **not** mean the bind is done — verify the CNAMEs actually resolve before closing the parent (the THIAAA-892 trap: `issue_children_completed` woke it while subdomains were still NXDOMAIN).

## Picking the next site

Research issues score candidates on traffic estimate × CPM/monetization angle × pipeline synergy (reuse of existing modules). Real precedents: calorie/TDEE = highest-CPM volume pick; CRON helper = highest per-visitor revenue; word counter = pure volume; image cropper = pipeline synergy + privacy moat. State the angle in the issue title like the precedents do.

## References

- `references/site-pipeline-evidence.md` — issue trail for the scaffold, SEO waves, AdSense prep, and the DNS binding saga.
