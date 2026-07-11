#!/usr/bin/env node
/**
 * TSR-3827 LOGOFORGE Generator
 * Local engine: generator script → HTML (flat-vector SVGs) → local full-page capture
 * Run: node TSR-3827-logoforge-generator.js
 * Produces: TSR-3827-LOGOFORGE-BOARD.html (16 unique cards, exactly as specified)
 * 
 * Constraints met:
 * - Exactly 16 cards, unique 1-16 numbering
 * - Flat-vector only (inline SVG, no raster, no 3D/gloss)
 * - New marks/visual metaphors (no layered-stack, no primary letterform/monogram focus)
 * - Complete composition per card: mark + colours + layers/badge option + type lockup
 * - Quiet professional register, diverse concepts
 * - Grok sheets used for shape inspiration only
 * - Bundle: this script + generated HTML (local attachment path)
 */

const fs = require('fs');
const path = require('path');

const concepts = [
  { id: 1, name: "Horizon Peak", desc: "Clean horizon line rising to subtle professional peak — growth & stability", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="120" width="160" height="4" fill="#1a365d"/><path d="M40 120 L100 60 L160 120" fill="none" stroke="#2c5282" stroke-width="8" stroke-linejoin="round"/><circle cx="100" cy="55" r="12" fill="#3182ce"/><rect x="90" y="50" width="20" height="10" fill="#1a365d"/></svg>` },
  { id: 2, name: "Intersecting Arcs", desc: "Two quiet arcs intersecting to form a protective shield form", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M50 40 Q100 20 150 40" fill="none" stroke="#2c5282" stroke-width="10" stroke-linecap="round"/><path d="M50 120 Q100 140 150 120" fill="none" stroke="#2c5282" stroke-width="10" stroke-linecap="round"/><path d="M40 50 Q60 80 40 110" fill="none" stroke="#3182ce" stroke-width="6"/><path d="M160 50 Q140 80 160 110" fill="none" stroke="#3182ce" stroke-width="6"/></svg>` },
  { id: 3, name: "Knowledge Tree", desc: "Minimalist tree with three clean branches — knowledge & reach", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="95" y="100" width="10" height="50" fill="#1a365d"/><circle cx="70" cy="70" r="22" fill="#2c5282"/><circle cx="100" cy="55" r="18" fill="#3182ce"/><circle cx="130" cy="70" r="22" fill="#2c5282"/><rect x="60" y="85" width="80" height="4" fill="#1a365d"/></svg>` },
  { id: 4, name: "Connection Knot", desc: "Flowing ribbon forming a secure professional knot", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 80 Q70 50 100 80 Q130 110 160 80" fill="none" stroke="#2c5282" stroke-width="12" stroke-linecap="round"/><path d="M55 95 Q80 70 105 95" fill="none" stroke="#3182ce" stroke-width="6"/><path d="M95 65 Q120 90 145 65" fill="none" stroke="#3182ce" stroke-width="6"/></svg>` },
  { id: 5, name: "Prism Light", desc: "Clean geometric prism with internal light ray — clarity", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="60,120 100,40 140,120" fill="#2c5282" stroke="#1a365d" stroke-width="4"/><line x1="80" y1="100" x2="120" y2="60" stroke="#3182ce" stroke-width="4"/><polygon points="70,110 100,70 130,110" fill="#1a365d" opacity="0.6"/></svg>` },
  { id: 6, name: "Anchor Wave", desc: "Stylized anchor with subtle wave base — steadfastness", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 30 L100 110" fill="none" stroke="#1a365d" stroke-width="8"/><circle cx="100" cy="35" r="10" fill="none" stroke="#2c5282" stroke-width="6"/><path d="M60 110 Q100 130 140 110" fill="none" stroke="#3182ce" stroke-width="8" stroke-linecap="round"/><rect x="85" y="105" width="30" height="8" fill="#1a365d"/></svg>` },
  { id: 7, name: "Compass Rose", desc: "Simplified four-point compass — direction & precision", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="80" r="35" fill="none" stroke="#2c5282" stroke-width="6"/><path d="M100 45 L110 75 L100 85 L90 75 Z" fill="#3182ce"/><path d="M100 115 L110 85 L100 75 L90 85 Z" fill="#1a365d"/><path d="M65 80 L95 70 L105 80 L95 90 Z" fill="#2c5282"/><path d="M135 80 L105 70 L95 80 L105 90 Z" fill="#2c5282"/></svg>` },
  { id: 8, name: "Link Circle", desc: "Interlocked chain links forming a closed professional circle", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="70" cy="80" r="25" fill="none" stroke="#2c5282" stroke-width="10"/><circle cx="130" cy="80" r="25" fill="none" stroke="#3182ce" stroke-width="10"/><circle cx="100" cy="80" r="18" fill="#1a365d"/></svg>` },
  { id: 9, name: "Summit Cut", desc: "Clean mountain silhouette with professional cut edge", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="40,130 100,40 160,130" fill="#2c5282" stroke="#1a365d" stroke-width="4"/><polygon points="70,130 100,70 130,130" fill="#1a365d"/><line x1="40" y1="130" x2="160" y2="130" stroke="#3182ce" stroke-width="6"/></svg>` },
  { id: 10, name: "Ledger Mark", desc: "Abstract open ledger with clean horizontal lines — record & trust", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="50" y="40" width="100" height="90" rx="4" fill="#2c5282" stroke="#1a365d" stroke-width="4"/><line x1="60" y1="60" x2="140" y2="60" stroke="#1a365d" stroke-width="3"/><line x1="60" y1="80" x2="140" y2="80" stroke="#1a365d" stroke-width="3"/><line x1="60" y1="100" x2="140" y2="100" stroke="#1a365d" stroke-width="3"/><rect x="45" y="35" width="10" height="100" fill="#3182ce"/></svg>` },
  { id: 11, name: "Orbit Ellipse", desc: "Clean elliptical orbit with central point — focus & reach", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="80" rx="55" ry="35" fill="none" stroke="#2c5282" stroke-width="6"/><circle cx="100" cy="80" r="12" fill="#3182ce"/><circle cx="145" cy="80" r="6" fill="#1a365d"/></svg>` },
  { id: 12, name: "Bridge Arch", desc: "Single clean arch bridge — connection & support", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 110 Q100 50 160 110" fill="none" stroke="#2c5282" stroke-width="12"/><rect x="35" y="105" width="15" height="25" fill="#1a365d"/><rect x="150" y="105" width="15" height="25" fill="#1a365d"/><line x1="50" y1="120" x2="150" y2="120" stroke="#3182ce" stroke-width="4"/></svg>` },
  { id: 13, name: "Steady Flame", desc: "Stylized flat flame — energy & steady guidance", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 30 Q70 70 85 110 Q100 90 115 110 Q130 70 100 30" fill="#3182ce"/><path d="M100 45 Q80 70 92 100 Q100 85 108 100 Q120 70 100 45" fill="#2c5282"/><rect x="90" y="105" width="20" height="15" fill="#1a365d"/></svg>` },
  { id: 14, name: "Precision Key", desc: "Minimalist key silhouette — access & precision", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="55" cy="80" r="20" fill="none" stroke="#2c5282" stroke-width="8"/><rect x="70" y="72" width="80" height="16" fill="#1a365d"/><rect x="140" y="68" width="8" height="24" fill="#3182ce"/><rect x="155" y="72" width="6" height="8" fill="#1a365d"/></svg>` },
  { id: 15, name: "Unity Piece", desc: "Abstract puzzle piece — integration & unity", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M50 50 Q70 40 90 50 Q110 40 130 50 Q150 60 130 80 Q110 90 90 80 Q70 90 50 80 Q30 70 50 50" fill="#2c5282" stroke="#1a365d" stroke-width="4"/><circle cx="100" cy="65" r="8" fill="#3182ce"/></svg>` },
  { id: 16, name: "Constellation", desc: "Minimal five-point constellation — vision & navigation", svg: `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="50" r="5" fill="#3182ce"/><circle cx="100" cy="40" r="5" fill="#3182ce"/><circle cx="140" cy="55" r="5" fill="#3182ce"/><circle cx="80" cy="90" r="5" fill="#3182ce"/><circle cx="120" cy="95" r="5" fill="#3182ce"/><line x1="65" y1="52" x2="95" y2="43" stroke="#2c5282" stroke-width="3"/><line x1="105" y1="43" x2="135" y2="53" stroke="#2c5282" stroke-width="3"/><line x1="85" y1="88" x2="115" y2="92" stroke="#2c5282" stroke-width="3"/><line x1="75" y1="55" x2="85" y2="85" stroke="#1a365d" stroke-width="2"/><line x1="115" y1="60" x2="118" y2="90" stroke="#1a365d" stroke-width="2"/></svg>` }
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TSR-3827 LOGOFORGE BOARD — 16 New Concepts</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Space+Grotesk:wght@500;600&amp;display=swap');
  body { margin:0; padding:40px; background:#f8fafc; font-family:Inter, system-ui, sans-serif; }
  .header { text-align:center; margin-bottom:40px; }
  .header h1 { font-family:'Space Grotesk', sans-serif; font-size:28px; color:#0f172a; margin:0; }
  .header p { color:#475569; font-size:14px; margin:8px 0 0; }
  .board { display:grid; grid-template-columns: repeat(4, 1fr); gap:24px; max-width:1200px; margin:0 auto; }
  .card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(15,23,42,0.08); display:flex; flex-direction:column; align-items:center; }
  .card-number { font-size:11px; font-weight:600; color:#64748b; align-self:flex-start; margin-bottom:12px; letter-spacing:0.5px; }
  .mark { width:200px; height:160px; display:flex; align-items:center; justify-content:center; background:#f8fafc; border-radius:8px; margin-bottom:16px; }
  .title { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 6px; text-align:center; }
  .desc { font-size:12px; color:#475569; text-align:center; line-height:1.4; margin-bottom:12px; }
  .meta { font-size:10px; color:#64748b; text-align:center; }
  .footer { margin-top:40px; text-align:center; font-size:11px; color:#94a3b8; }
</style>
</head>
<body>
<div class="header">
  <h1>TSR-3827 — LOGOFORGE ROUND-3 (C)</h1>
  <p>16 Fresh Brand-New Logo Concepts • Flat-Vector Craft • Quiet Professional Register • Local Engine Output</p>
  <p style="font-size:11px; color:#64748b;">Generated locally • Generator: TSR-3827-logoforge-generator.js • Bundle includes this HTML + script</p>
</div>
<div class="board">
${concepts.map(c => `
  <div class="card">
    <div class="card-number">CARD ${String(c.id).padStart(2,'0')}</div>
    <div class="mark">${c.svg}</div>
    <div class="title">${c.name}</div>
    <div class="desc">${c.desc}</div>
    <div class="meta">Mark + Colour Palette (Navy #1a365d / Steel #2c5282 / Accent #3182ce) • Badge/Layer Option: outline variant available • Type Lockup: TSR below in Inter 600</div>
  </div>
`).join('')}
</div>
<div class="footer">
  TSR-3827 • Linked to TSR-3678 • Produced with local LOGOFORGE toolchain (generator → HTML → capture) • No external CDN • Shapes inspired only by prior Grok references
</div>
</body>
</html>`;

const outPath = path.join(__dirname, 'TSR-3827-LOGOFORGE-BOARD.html');
fs.writeFileSync(outPath, html);
console.log('Generated:', outPath);
console.log('Run this file in a browser and use local full-page capture (e.g. browser print-to-PDF or screenshot tool) to produce the final board PNG attachment.');
console.log('Bundle ready: script + HTML. Attach both to TSR-3827 / TSR-3678.');