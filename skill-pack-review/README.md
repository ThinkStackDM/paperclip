# Skill Pack + Tools + Weekly Priorities — for review (2026-06-16 session)

Built autonomously overnight 2026-06-15 while you were away. **Nothing here is live yet** —
these SKILL.md files are staged in `skill-pack-review/` for your review. On your OK I register
the approved ones into `company_skills` (the same way the existing skills are live) and attach
them to the right agents. Tools in §2 need you to action a couple of installs (remind me and
I'll wire them).

---

## 1. Top 10 skills (the pack)

Theme: the fleet is great at *producing* but weak at *converting output → outcome*. These 10
fill the highest-leverage gaps — discoverability, conversion, quality gates, and (your ask) TSM
video. Each has a full draft in `skill-pack-review/<name>/SKILL.md`.

| # | Skill | Company | Why it matters |
|---|---|---|---|
| 1 | **video-editing** | TSM | ffmpeg recipes: join grok 8s clips, trim, transitions, audio/music, captions, 1080p YouTube export. Your direct ask. |
| 2 | **video-assembly-pipeline** | TSM | script + clips + audio → finished YouTube-ready MP4, end-to-end. |
| 3 | **youtube-packaging-ctr** | TSM | title + thumbnail optimization — the #1 lever on views. |
| 4 | **kdp-keyword-category-research** | TSB | 7 keywords + 3 categories + subtitle = whether a book is findable (=sales). $0 tools. |
| 5 | **etsy-seo-pricing-photography** | DP | titles/tags/price/photos that rank + convert on Etsy. |
| 6 | **seo-keyword-research-no-tools** | TSK + all | find winnable queries with only Search Console + autocomplete + PAA (no paid tools). |
| 7 | **landing-page-cro** | TSK/TSR + all | turn page traffic into the one action (buy/upload/subscribe). |
| 8 | **ship-it-qa-checklist** | all | universal pre-publish gate — catches the embarrassing misses before "done". |
| 9 | **launch-gtm-checklist** | all | so a launch is "findable + measured + converts", not "published into the void". |
| 10 | **pricing-strategy** | all | the fastest lever on revenue, currently picked by gut. |

**Bonus (also drafted, register if you like):** `auto-captions` (whisper.cpp → SRT for TSM),
`ab-testing-discipline` (run experiments that don't lie), `customer-feedback-loop` (reviews/refunds → ranked fixes).

**Note on rollout:** the knowledge-style ones (CRO, A/B, pricing) should go through the #16
skillbench keep/drop gate + attach to weak/cheap lanes first (per our skill-audit finding that
skills help weak models but can distract strong ones). The checklists + platform research
skills are system-runbooks — safe to attach broadly.

### TSM video — your specific question: **yes, skills help a lot.**
ffmpeg is already installed. Agents can self-serve: concatenate grok's 8s clips into longer
videos, add transitions, lay a voiceover over a ducked music bed, burn in captions
(whisper.cpp, free/on-device), overlay lower-thirds/watermarks, extract thumbnails, and export
proper 1080p YouTube files — all $0, no API. The honest ceiling: grok clips are 8s/720p, so for
*continuous shots >8s, photoreal humans, or talking-head*, the skills route those to a
`[CREATIVE REQUEST]` for Flow/Veo (you copy-paste). Faceless montage, infographic-over-Ken-Burns,
hooks, and listing videos assemble cleanly from grok + ffmpeg. Skills #1, #2, #3 + auto-captions cover this.

---

## 2. Top 5 tools/MCPs to add (excluding web-search — remind me tomorrow to wire these)

All free, mostly zero-account. 3 are CLIs agents already can run; 2 are MCPs added via `hermes mcp add`.

| # | Tool | What it does | How to add | Who benefits |
|---|---|---|---|---|
| 1 | **Playwright MCP** | Headless browser — screenshot + visually QA *deployed* sites (closes "we ship sites we can't see"). | `hermes mcp add playwright --command npx --args -y @playwright/mcp@latest` | TSK, TSR, DP/TSB pages, TSM |
| 2 | **Lighthouse / Unlighthouse CLI** | Perf/SEO/a11y audit of a page (or whole site) as a hard ship-gate. | already a CLI: `npx unlighthouse --site <url>` — bless in ship-it-qa | TSK (CWV=ranking/AdSense), all web |
| 3 | **shadcn MCP** | Pull production-grade UI components/blocks by name into Next.js builds. | `hermes mcp add shadcn --command npx --args -y shadcn@latest mcp` (run in a project) | TSR app, any sales page |
| 4 | **sharp / svgo CLIs** | Image→WebP/AVIF + SVG minify → faster pages, lighter thumbnails/tiles. | CLI: `npx sharp-cli`, `npx svgo` — bless in web-design-polish | TSK, TSM, DP, TSB |
| 5 | **@vercel/og** | Render branded thumbnails/OG cards from a template with **legible text** (which image-gen garbles). | npm lib, local — one template per asset type | TSM thumbnails, TSK OG, DP/TSB social |

(Deliberately excluded the web-search MCPs per your note. PDF/epub + a generic analytics MCP were
assessed and dropped as redundant with the working KDP `epubcheck` flow + `analytics-finops`.)

---

## 3. Five things to focus on this week (before limits reset)

See `WEEKLY-PRIORITIES.md` for the full reasoning. In order of leverage:

1. **Unblock ONE real revenue credential** (KDP or Etsy) — the entire portfolio is "built but $0";
   one live auth turns a whole pipeline from rehearsal into real.
2. **Stand up the finance/analytics loop** — `analytics-finops` + Ledger are in place but
   `finance_events` is still empty; wire even manual outcome recording so we can see what works.
3. **Verify the self-improvement loop actually closes** — the Sleep→Dream fix is in; confirm this
   week's weekly retro runs green and produces a real skill/insight (it's been failing for days).
4. **Register + gate this skill pack** — run the top knowledge skills through skillbench, attach
   the runbooks, so the capability is actually used not just authored.
5. **Harden the platform SPOF** — tonight a fleet engineer editing `server/src` crash-looped the
   whole instance (self-recovered via KeepAlive). One agent can take down all 7 companies; worth a
   guardrail (e.g. platform changes land on a branch + smoke-gate before the live tsx picks them up).

---

## 4. Also done overnight (FYI)
- **8h Claude-window automation** — live. CEO/CTO run on Claude only within sprint±2h; otherwise on
  their codex sister (so ad-hoc tasks to dormant companies don't tie up Claude). Hourly launchd job
  `com.thinkstack.claude-window-flip` (`scripts/claude-window-flip.py`), survives reboot.
- **Rebalance** — 8 volume-role primaries moved to codex/grok sisters; Claude now carries
  leadership + content + design only.
- **One incident** — a transient server crash-loop (~05:26–05:28) when a fleet engineer's git op
  briefly removed `server/src/services/run-gate.ts`; KeepAlive auto-recovered it. (→ priority #5.)
