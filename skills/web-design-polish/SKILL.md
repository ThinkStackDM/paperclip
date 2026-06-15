---
name: web-design-polish
description: >
  House style for making websites, landing pages, and site UI look professional. Use whenever
  building or editing ANY web page, landing page, or web UI. The rule: never ship flat,
  default-Tailwind, unstyled pages. All tools below are free and installable on demand.
---

# Web Design Polish

Good-looking beats clever. A page that looks trustworthy converts; a flat default-Tailwind
page reads as a scam. Apply this every time you build or touch a page.

## Components (don't hand-roll)
- **Next.js / React sites:** use **shadcn/ui** — `npx shadcn@latest init` then
  `npx shadcn@latest add button card …`. Accessible, themeable, production-grade. **Use the shadcn
  MCP** to pull production blocks by name instead of hand-rolling: `search_items_in_registries` →
  `view_items_in_registries` → `get_add_command_for_items`, then `get_audit_checklist` after generating.
- **Vanilla HTML sites (e.g. KISS utility sites):** use **daisyUI** via CDN (no build) for
  buttons/cards/navbars, or copy free Tailwind blocks from HyperUI / Meraki UI.

## The polish checklist (every page)
1. **Type:** one tasteful Google Fonts pairing (`next/font/google`, or `<link>` for HTML). Never browser-default.
2. **Icons:** Lucide (`lucide-react`, or `unpkg.com/lucide` for HTML). Never emoji as UI.
3. **Palette:** a deliberate 1-accent palette (Realtime Colors / Coolors) — not raw Tailwind primary.
4. **Depth:** one subtle background (Hero Patterns or a Haikei SVG wave/blob) + real shadows
   (shadows.brumm.af) so it isn't flat.
5. **Layout:** generous spacing, a clear hero, consistent section rhythm. Free full templates:
   vercel.com/templates, HTML5 UP, Cruip free.
6. **Illustration (non-photoreal):** unDraw / Open Doodles SVGs.

## Assets & verify (free CLIs + MCPs, install on demand)
- Compress images: `npx sharp-cli` (resize/WebP/AVIF), `npx svgo file.svg` for SVGs.
- Templated OG/social/thumbnail images with **legible text** (image-gen garbles text): `@vercel/og` — see **og-image-rendering**.
- **See it rendered before you call it done** — drive the **Playwright MCP** against the running/deployed
  URL: `browser_navigate` → `browser_take_screenshot` (and `browser_resize` to 390px to check mobile).
  Never ship a page you've only seen as code.
- **Hard ship-gate:** audit the deployed URL — `npx lighthouse <url> --output=json` (single page) or
  `npx unlighthouse --site <url>` (whole site). Fix perf/a11y/SEO regressions; don't mark done on a red Lighthouse.
