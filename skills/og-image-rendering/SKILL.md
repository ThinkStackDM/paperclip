---
name: og-image-rendering
description: >
  Render branded thumbnails, OG/social cards and promo tiles with crisp, LEGIBLE text — which
  image-gen (grok/flux) garbles — from a reusable template. Use for YouTube thumbnails, link/OG
  cards, Etsy/book promo tiles, or any asset where words must be readable. Free, local, $0 API.
---

# OG / Thumbnail Image Rendering (legible text)

Image-gen mangles text. For anything with words on it — a thumbnail headline, an OG card, a price
tile — render the **text layer with a real text renderer**, not the diffusion model. Best results:
gen the *background/illustration* with image-gen, render the *text* with this, composite the two.

## Path A — inside a Next.js app (`next/og`)
Best for TSK utility-site OG cards and any app route. `app/og/route.tsx`:
```tsx
import { ImageResponse } from "next/og";
export function GET(req: Request) {
  const title = new URL(req.url).searchParams.get("title") ?? "Untitled";
  return new ImageResponse(
    (<div style={{height:"100%",width:"100%",display:"flex",flexDirection:"column",
      justifyContent:"center",padding:80,background:"#0B1020",color:"#fff",fontSize:64,fontWeight:700}}>
      {title}</div>), { width: 1200, height: 630 });
}
```

## Path B — standalone CLI (any company, no app): satori + resvg
For thumbnails/tiles outside Next. One small Node script per template:
```bash
npm i satori @resvg/resvg-js   # local, free
```
```js
// render.mjs — node render.mjs "Your Headline" out.png
import satori from "satori"; import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const font = readFileSync(process.env.BRAND_TTF);              // a real .ttf (next/font or Google Fonts dl)
const svg = await satori(
  { type:"div", props:{ style:{height:"100%",width:"100%",display:"flex",alignItems:"flex-end",
      padding:72,background:"#0B1020",color:"#fff"},
    children:{ type:"div", props:{ style:{fontSize:120,fontWeight:800,lineHeight:1.05}, children: process.argv[2] }}}},
  { width:1280, height:720, fonts:[{ name:"Brand", data:font, weight:800, style:"normal" }] });
writeFileSync(process.argv[3], new Resvg(svg).render().asPng());
```

## Template discipline (one template per asset type)
- Sizes: **YouTube thumb 1280×720**, **OG/social 1200×630**, **Etsy/book tile 2000×2000**.
- Brand font (one .ttf), the deliberate 1-accent palette from **web-design-polish** — never browser-default.
- **Big, mobile-legible headline:** 3–5 words; must read at the 120px thumbnail size (the youtube-packaging-ctr test). Safe margins; high contrast text-on-bg.
- Composite over a gen'd background with `npx sharp-cli` (or sharp in-script) when you want art + clean text.

## Verify
Open the PNG and shrink it: headline still readable at ~120px wide? If not, fewer/bigger words. Check brand/price/number spelling — this is the asset buyers judge in 1 second.
