# Creative Tooling Playbook

The free tool stack for creative production (video-gen-ops, broll-sourcing,
image-gen-ops, the Designer role). Everything here is subscription/free-tier only —
no pay-per-call media APIs. Audited on the worker Mac 2026-06-11.

## On this Mac already (use these first)

| Tool | Where | Use for |
|---|---|---|
| ffmpeg 8.1.1 + ffprobe | `/opt/homebrew/bin` | All video assembly, audio mixing, probing — see `skills/video-gen-ops/references/ffmpeg-assembly.md`. Note: ffprobe 8 rejects the `csv=p=0:s=' '` separator syntax; use comma output. |
| sips | `/usr/bin/sips` (macOS built-in) | Quick image resize/convert/crop without installing anything: `sips -Z 1280 in.png --out thumb.png` |
| qlmanage | `/usr/bin/qlmanage` (built-in) | Thumbnail any file type: `qlmanage -t -s 512 -o . file.pdf` |
| Python 3.14 + Pillow 12.2 | `python3` | Compositing, text on images, batch ops when sips is too blunt |
| node 22 | `~/.local/bin/node` | Headless-browser captures if Playwright/Puppeteer get installed per-project |
| jq, curl | `/usr/bin` | The stock-API patterns in `skills/broll-sourcing/references/` |
| Docker Desktop | installed, daemon usually **not running** | The Linux render image (`thinkstack-media-render` `infra/runner/Dockerfile`) needs the daemon started first |
| **Local image gen (FLUX-schnell on Apple MLX)** | `scripts/imagegen/generate-image.sh` (default `IMAGE_PROVIDER=local`) | **The default free, unlimited, on-device image path.** Good for backgrounds/mockups/thumbnails/social cards; not photoreal faces. One-time setup: `bash ~/paperclip/scripts/imagegen/setup-local.sh` (then ~9.6 GB ungated Apache-2.0 weights download on first generation). See `skills/image-gen-ops`. |

## Not installed (decide before brew-installing; disk is fine, ~3.1 TiB free)

- **ImageMagick** (`brew install imagemagick`) — only when sips+Pillow genuinely fall
  short (advanced compositing, SVG raster). Pillow covers most needs already.
- **exiftool** (`brew install exiftool`) — metadata read/strip on delivered assets;
  small install, worth it the first time licensing metadata needs auditing.
- **gifski / pngquant** — GIF quality / PNG compression; install on demand, not preemptively.
- **yt-dlp — do NOT install.** YouTube scraping is banned by broll-sourcing hard rule #1.

## Free-tier APIs (details + exact REST patterns in `skills/broll-sourcing/references/api-reference.md`)

| API | Key | Limits | Licence posture |
|---|---|---|---|
| Pexels photos+videos | `PEXELS_API_KEY` (free) | ~200/hr, 20k/mo | Pexels License, no attribution |
| Pixabay photos+videos | `PIXABAY_API_KEY` (free) | ~100/min | Pixabay Content License, no attribution |
| Openverse (CC index) | none | low anonymous limits | per-asset CC — attribution usually required |
| Wikimedia Commons | none (UA header required) | generous | per-file CC — attribution usually required |
| NASA images-api.nasa.gov | none | generous | US public domain (verify per item) |
| Local FLUX-schnell (MLX) | none | unlimited, on-device | **Default free image path** — `IMAGE_PROVIDER=local scripts/imagegen/generate-image.sh` (image-gen-ops). One-time `setup-local.sh`. |
| Gemini image gen | `GEMINI_API_KEY` | **paid-only (free tier limit:0 as of 2026-06)** | Fallback only if billing enabled: `IMAGE_PROVIDER=gemini`. Pollinations also paywalled (402). |

Video *generation* has no free API lane: Sora (ChatGPT Pro app) and Veo (Gemini app)
are board-executed in-app — see video-gen-ops for the prompt-package flow.

## MCP servers worth connecting

Verified-confident only; a search of the connected MCP registry from this machine
returned no stock-media connectors today, so treat anything beyond this list as
unverified.

- **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`, official reference
  server) — scoped read/write to the workspace `assets/` tree for adapters that lack
  native file tools.
- **Fetch MCP** (`mcp-server-fetch`, official reference server) — URL fetching for
  licence-page verification when an adapter has no web access.
- Stock-media MCPs (Pexels, Unsplash, etc.): community servers exist in various
  registries but none is verified here — **search the MCP registry for "Pexels" /
  "stock media" before assuming one**, and prefer the plain REST patterns in
  broll-sourcing (already working, no extra moving part) unless an MCP demonstrably
  saves work.
- An ffmpeg/video-editing MCP is not needed: agents have shell access and the
  assembly conventions are codified in video-gen-ops.

## Standing conventions

- Workspace layout: `assets/gen/`, `assets/broll/` (+ `manifest.json`),
  `assets/audio/`, `assets/_norm/`, `assets/final/`.
- Every asset carries source URL + licence in the issue (broll-sourcing hard rules).
- Keys live in env/company secrets, never in commits or issue bodies.
- Anything published externally is board-gated, no exceptions.
