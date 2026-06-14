#!/usr/bin/env python3
"""Generate idempotent company_skills upserts for new bundled skills, all 7 companies.
Mirrors the exact field pattern of existing paperclipai/paperclip/* rows."""
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

SKILLS = {
    "make-a-skill": "Create, benchmark (#16 skillbench), and roll out an agent skill that earns its tokens; avoid skills that hurt strong models.",
    "escalate-platform-work-to-tsmc": "Scope rule for non-TSMC companies: build on Paperclip, don't modify the platform; escalate platform work to TSMC.",
    "content-book-craft": "Draft book chapters/sections that read like published prose first-pass; hook-first, concrete, no AI tells. Validated cheap-lane lift.",
}

SKILLS_DIR = Path("/Users/glad0s/paperclip/skills")


def dq(s, tag):  # dollar-quote
    assert f"${tag}$" not in s, f"delimiter collision for {tag}"
    return f"${tag}${s}${tag}$"


out = ["BEGIN;"]
for slug, desc in SKILLS.items():
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
Path("/tmp/register_skills.sql").write_text("\n".join(out) + "\n")
print(f"wrote /tmp/register_skills.sql: {len(SKILLS)} skills x {len(COMPANIES)} companies = {len(SKILLS)*len(COMPANIES)} upserts")
