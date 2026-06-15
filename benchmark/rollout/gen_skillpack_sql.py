#!/usr/bin/env python3
"""Generate idempotent company_skills upserts for the 2026-06-16 skill pack, all 7 companies.
Mirrors the exact field pattern of gen_skill_sql.py / existing paperclipai/paperclip/* rows.

Usage:
  gen_skillpack_sql.py runbooks   # the 10 runbook/checklist skills (safe broad rollout)
  gen_skillpack_sql.py knowledge  # the 3 knowledge skills (only after the skillbench gate passes)
  gen_skillpack_sql.py all        # both sets
"""
import sys
from pathlib import Path

COMPANIES = [
    "e7507bfa-ecfd-4dde-bd2a-7b19947ffdde",  # Dastardly Print
    "e6361895-a6a4-438d-bb76-b17a0ad026cb",  # TSMC
    "baba1235-7f5b-4555-aed8-c06efa095125",  # ThinkStack Books
    "211e0f96-ecd2-4fe0-81f8-72059bc6ed46",  # ThinkStack Capital
    "6d2c1656-dabd-4aa1-b45a-0f5aedea3092",  # ThinkStack KISS
    "d71c9e82-1a4b-497f-9bbc-5b9dd028c367",  # ThinkStack Media
    "cefbbf68-0ca7-4383-967e-03bc1b037ae7",  # ThinkStack Recruitment
]

RUNBOOKS = {
    "ship-it-qa-checklist": "Universal pre-publish QA gate — the last-look checklist before any deliverable is marked done or sent to the board to publish.",
    "launch-gtm-checklist": "Go-to-market checklist for any launch so what ships is findable, measured, and converts on day one — not published into the void.",
    "video-editing": "TSM ffmpeg editing reference: join/trim/transition/audio-mix/caption/overlay/scale/thumbnail and export YouTube-ready 1080p video.",
    "video-assembly-pipeline": "End-to-end driver: script + clips + audio -> finished spec-conformant YouTube-ready 1080p MP4; orchestrates the video-editing recipes.",
    "auto-captions": "Generate accurate SRT captions for TSM videos on-device with whisper.cpp (free, no API); ship as soft captions or burn in with ffmpeg.",
    "youtube-packaging-ctr": "Title + thumbnail packaging optimization for faceless YouTube — the single biggest lever on views. Package first, script to the package.",
    "kdp-keyword-category-research": "Pre-publish KDP discoverability research — the 7 keyword slots, 3 BISAC categories, and subtitle that decide if a book is findable. $0 tools.",
    "etsy-seo-pricing-photography": "Etsy titles/tags/price/listing imagery that rank and convert; the conversion craft behind etsy-listing-ops' publish mechanics.",
    "seo-keyword-research-no-tools": "Find what people search and how to win it with only free first-party signals — Search Console, autocomplete, People-Also-Ask, related searches.",
    "customer-feedback-loop": "Turn reviews, refund reasons, support messages and ratings into a ranked backlog of product/listing fixes; closes the loop analytics-finops opens.",
    "og-image-rendering": "Render branded thumbnails / OG cards / promo tiles with crisp legible text (which image-gen garbles), from a reusable template — next/og in-app or satori+resvg standalone. Free, local.",
}

KNOWLEDGE = {
    "landing-page-cro": "Conversion-rate optimization for any page with a goal (buy/upload/subscribe); structure + copy through to the click. [skillbench-gated -> cheap/weak lanes]",
    "ab-testing-discipline": "Design, run, and read a fair A/B or before/after experiment so the verdict is real, not noise — the rigor under marketing-ops. [skillbench-gated -> cheap/weak lanes]",
    "pricing-strategy": "Set/revise prices to maximize profit not just sales — anchor to the competitive band, know royalty/fee math, change like an experiment. [skillbench-gated -> cheap/weak lanes]",
}

SKILLS_DIR = Path("/Users/glad0s/paperclip/skills")


def dq(s, tag):  # dollar-quote
    assert f"${tag}$" not in s, f"delimiter collision for {tag}"
    return f"${tag}${s}${tag}$"


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    skills = {}
    if which in ("runbooks", "all"):
        skills.update(RUNBOOKS)
    if which in ("knowledge", "all"):
        skills.update(KNOWLEDGE)
    if not skills:
        sys.exit("usage: gen_skillpack_sql.py runbooks|knowledge|all")

    out = ["BEGIN;"]
    for slug, desc in skills.items():
        md = (SKILLS_DIR / slug / "SKILL.md").read_text()
        key = f"paperclipai/paperclip/{slug}"
        locator = str(SKILLS_DIR / slug)
        meta = '{"skillKey": "%s", "sourceKind": "paperclip_bundled"}' % key
        inv = '[{"kind": "skill", "path": "SKILL.md"}]'
        for cid in COMPANIES:
            out.append(
                "INSERT INTO company_skills "
                "(id, company_id, key, slug, name, description, markdown, source_type, "
                " source_locator, source_ref, trust_level, compatibility, file_inventory, metadata, created_at, updated_at) "
                f"VALUES (gen_random_uuid(), '{cid}', '{key}', '{slug}', '{slug}', "
                f"{dq(desc,'dd')}, {dq(md,'md')}, 'local_path', '{locator}', NULL, "
                f"'markdown_only', 'compatible', '{inv}'::jsonb, '{meta}'::jsonb, now(), now()) "
                "ON CONFLICT (company_id, key) DO UPDATE SET "
                "markdown=EXCLUDED.markdown, name=EXCLUDED.name, description=EXCLUDED.description, "
                "file_inventory=EXCLUDED.file_inventory, metadata=EXCLUDED.metadata, updated_at=now();"
            )
    out.append("COMMIT;")
    Path("/tmp/register_skillpack.sql").write_text("\n".join(out) + "\n")
    print(f"wrote /tmp/register_skillpack.sql: {len(skills)} skills x {len(COMPANIES)} companies = {len(skills)*len(COMPANIES)} upserts ({which})")


if __name__ == "__main__":
    main()
