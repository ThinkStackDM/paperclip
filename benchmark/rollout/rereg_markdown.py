#!/usr/bin/env python3
"""Re-sync the markdown column of already-registered company_skills from skills/<slug>/SKILL.md.
Markdown-only update (preserves description/metadata) for edits to EXISTING bundled skills whose
description we don't want to overwrite. Usage: rereg_markdown.py web-design-polish [more-slugs...]"""
import sys
from pathlib import Path

SKILLS_DIR = Path("/Users/glad0s/paperclip/skills")


def dq(s, tag):
    assert f"${tag}$" not in s, f"delimiter collision for {tag}"
    return f"${tag}${s}${tag}$"


slugs = sys.argv[1:]
if not slugs:
    sys.exit("usage: rereg_markdown.py <slug> [slug...]")
out = ["BEGIN;"]
for slug in slugs:
    md = (SKILLS_DIR / slug / "SKILL.md").read_text()
    key = f"paperclipai/paperclip/{slug}"
    out.append(f"UPDATE company_skills SET markdown={dq(md,'md')}, updated_at=now() WHERE key='{key}';")
out.append("COMMIT;")
Path("/tmp/rereg_markdown.sql").write_text("\n".join(out) + "\n")
print(f"wrote /tmp/rereg_markdown.sql: {len(slugs)} skill(s)")
