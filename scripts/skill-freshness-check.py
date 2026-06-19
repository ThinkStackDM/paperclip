#!/usr/bin/env python3
"""Skill-freshness check — flag dead/stale references in the skill pack.

The skill audit (2026-06-19) found skills that silently reference things which
go stale: file paths that move, tickets that close or never existed, links to
sibling skills that get renamed. A one-time audit doesn't stay true. This makes
it ongoing: scan the skill source tree and flag references that no longer
resolve, so the pack stays trustworthy.

It scans the SOURCE tree (`skills/**/*.md`), not the deployed `company_skills.markdown`
in the DB — that's where you edit and re-register from, so that's where you fix.

DESIGN — low false-positive by construction. Skills legitimately reference paths
and tickets from OTHER contexts (plugin scaffolds like `src/ui/index.tsx`, the
polymarket project's `scripts/poly_paper_eval.py`, upstream `PAP-*` issues on the
public paperclip.ai tracker). Flagging those as "dead" is noise. So the default
tier only reports references that are unambiguously ours and unambiguously broken.

Severities:
  ERROR  (fails the run)  — definitely broken:
    - broken-skill-link : a relative `](…​.md)` link or `[[wikilink]]` that resolves
                           (relative to its own skill dir) to a file/skill that
                           does not exist.
    - missing-ticket    : an INTERNAL-tracker ticket id (a company issue_prefix)
                           that is absent from the issues DB — a typo / dead ref.
    - broken-repo-path  : a backticked path rooted at a conservative, unambiguous
                           paperclip dir (server/ packages/ cli/ doc/ ui/src/)
                           that does not exist in the repo.
  WARN  (shown; fails only with --strict):
    - fragile-abspath   : a real-looking absolute /Users/… path (not a placeholder)
                          that does not exist on this host.
  INFO  (only with the matching flag):
    - closed-ticket     : --flag-closed-tickets — ref to a done/cancelled ticket
                          (usually provenance, occasionally stale).
    - stale-date        : --max-date-age-days N — an "(YYYY-MM-DD)"/"as of …" claim
                          older than N days.
    - external-ticket   : --verbose — a ref to a non-internal tracker (e.g. PAP-*),
                          left unverified by design.

Ticket checks need the DB (psql). They self-skip cleanly if it is unreachable, so
link/path checks still work offline. Internal prefixes are read live from
`companies.issue_prefix`, so the check configures itself.

Usage:
  skill-freshness-check.py                      # default tier, human report
  skill-freshness-check.py --json               # machine-readable
  skill-freshness-check.py --skill paperclip    # scope to one skill
  skill-freshness-check.py --flag-closed-tickets --max-date-age-days 180 --strict
  skill-freshness-check.py --no-tickets         # skip DB entirely

Exit: 0 clean · 1 ERROR findings (or WARN under --strict) · 2 usage error.

Intended to run periodically (cron / a paperclip routine) and on skill edits;
the non-zero exit makes it gate-able.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass, asdict, field

# Paperclip dirs that are unambiguously THIS repo (so a missing path under one is
# a real break). Deliberately excludes ambiguous roots that skills use for other
# contexts: scripts/ (also the polymarket project + operator-instructions dir),
# bare ui/ , src/ , app/ , assets/ , listings/ , data/ (scaffolds / generated).
CONSERVATIVE_REPO_ROOTS = ("server/", "packages/", "cli/", "doc/", "ui/src/")

# Absolute-path shapes that are obviously illustrative, never flagged.
ABS_PLACEHOLDER_RE = re.compile(r"/Users/(me|you|user|example)\b|\.\.\.|<[^>]+>|\$\{?\w")

TICKET_RE = re.compile(r"\b([A-Z][A-Z]{1,8})-(\d+)\b")
MD_LINK_RE = re.compile(r"\]\(([^)]+)\)")
WIKILINK_RE = re.compile(r"\[\[([a-z0-9][a-z0-9-]*)\]\]")
BACKTICK_PATH_RE = re.compile(r"`([A-Za-z0-9_][A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`")
ABS_PATH_RE = re.compile(r"(/Users/[^\s)`\"'<>]+)")
DATE_RE = re.compile(r"(?:as of\s+|[(\[])\s*(\d{4})-(\d{2})-(\d{2})")
URL_RE = re.compile(r"https?://[^\s)`\"'<>]+")

SEV_ERROR, SEV_WARN, SEV_INFO = "ERROR", "WARN", "INFO"


@dataclass
class Finding:
    severity: str
    kind: str
    skill: str
    file: str
    line: int
    ref: str
    detail: str = ""


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)
    scanned_files: int = 0
    scanned_skills: int = 0
    tickets_checked: bool = False
    notes: list[str] = field(default_factory=list)

    def add(self, **kw) -> None:
        self.findings.append(Finding(**kw))


def iter_md_files(root: str, only_skill: str | None):
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if not name.endswith(".md"):
                continue
            full = os.path.join(dirpath, name)
            skill = os.path.relpath(full, root).split(os.sep)[0]
            if only_skill and skill != only_skill:
                continue
            yield skill, full


def read_lines(path: str):
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.readlines()


def check_links(report: Report, root: str, skill: str, path: str, lines: list[str]) -> None:
    d = os.path.dirname(path)
    for i, line in enumerate(lines, 1):
        for m in MD_LINK_RE.finditer(line):
            target = m.group(1).strip().split()[0].split("#")[0]
            if not target or target.startswith(
                ("http://", "https://", "mailto:", "agent://", "#", "/TSMC/", "/api/")
            ):
                continue
            # Only verify links that name a local doc; bare anchors/externals skip.
            if not target.endswith(".md"):
                continue
            cand = target if target.startswith(root + os.sep) else os.path.normpath(os.path.join(d, target))
            if not os.path.exists(cand):
                report.add(severity=SEV_ERROR, kind="broken-skill-link", skill=skill,
                           file=path, line=i, ref=target, detail="link target does not exist")
        for m in WIKILINK_RE.finditer(line):
            name = m.group(1)
            if not os.path.isdir(os.path.join(root, name)):
                report.add(severity=SEV_ERROR, kind="broken-wikilink", skill=skill,
                           file=path, line=i, ref=f"[[{name}]]",
                           detail=f"no {root}/{name}/ skill dir")


def check_repo_paths(report: Report, repo_root: str, skill: str, path: str, lines: list[str], seen: set) -> None:
    for i, line in enumerate(lines, 1):
        for m in BACKTICK_PATH_RE.finditer(line):
            p = m.group(1)
            if not p.startswith(CONSERVATIVE_REPO_ROOTS):
                continue
            key = (skill, p)
            if key in seen:
                continue
            seen.add(key)
            if not os.path.exists(os.path.join(repo_root, p)):
                report.add(severity=SEV_ERROR, kind="broken-repo-path", skill=skill,
                           file=path, line=i, ref=p, detail="path absent from repo")


def check_abspaths(report: Report, skill: str, path: str, lines: list[str]) -> None:
    for i, line in enumerate(lines, 1):
        for m in ABS_PATH_RE.finditer(line):
            p = m.group(1).rstrip(".,);:")
            if ABS_PLACEHOLDER_RE.search(p):
                continue
            if not os.path.exists(p):
                report.add(severity=SEV_WARN, kind="fragile-abspath", skill=skill,
                           file=path, line=i, ref=p, detail="absolute path missing on this host")


def check_dates(report: Report, skill: str, path: str, lines: list[str], max_age_days: int, today: dt.date) -> None:
    cutoff = today - dt.timedelta(days=max_age_days)
    for i, line in enumerate(lines, 1):
        for m in DATE_RE.finditer(line):
            try:
                d = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                continue
            if d < cutoff:
                report.add(severity=SEV_INFO, kind="stale-date", skill=skill, file=path, line=i,
                           ref=d.isoformat(), detail=f"dated claim older than {max_age_days}d")


def collect_tickets(root: str, only_skill: str | None) -> dict:
    """ref-id -> list of (skill, file, line)."""
    refs: dict[str, list] = {}
    for skill, path in iter_md_files(root, only_skill):
        for i, line in enumerate(read_lines(path), 1):
            for m in TICKET_RE.finditer(line):
                tid = f"{m.group(1)}-{m.group(2)}"
                refs.setdefault(tid, []).append((skill, path, i))
    return refs


def psql(database_url: str, query: str) -> list[str] | None:
    try:
        out = subprocess.run(
            ["psql", database_url, "-tAc", query],
            capture_output=True, text=True, timeout=20,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None
    return [ln for ln in out.stdout.splitlines() if ln.strip()]


def check_tickets(report: Report, refs: dict, database_url: str, flag_closed: bool, verbose: bool) -> None:
    prefixes = psql(database_url, "select distinct issue_prefix from companies where issue_prefix is not null;")
    if prefixes is None:
        report.notes.append("tickets: SKIPPED (DB unreachable — link/path checks still ran)")
        return
    internal = {p.strip() for p in prefixes}
    ids = sorted(refs)
    in_list = ",".join("'" + i.replace("'", "") + "'" for i in ids) or "''"
    rows = psql(database_url, f"select identifier,status from issues where identifier in ({in_list});")
    if rows is None:
        report.notes.append("tickets: SKIPPED (DB query failed)")
        return
    report.tickets_checked = True
    status = {}
    for row in rows:
        ident, _, st = row.partition("|")
        status[ident] = st
    closed = {"done", "cancelled"}
    for tid in ids:
        prefix = tid.split("-", 1)[0]
        loc = refs[tid][0]
        is_internal = prefix in internal
        if tid not in status:
            if is_internal:
                report.add(severity=SEV_ERROR, kind="missing-ticket", skill=loc[0], file=loc[1],
                           line=loc[2], ref=tid, detail="internal ticket id not found in DB")
            elif verbose:
                report.add(severity=SEV_INFO, kind="external-ticket", skill=loc[0], file=loc[1],
                           line=loc[2], ref=tid, detail=f"external tracker ({prefix}) — unverified")
        elif flag_closed and status[tid] in closed:
            report.add(severity=SEV_INFO, kind="closed-ticket", skill=loc[0], file=loc[1],
                       line=loc[2], ref=tid, detail=f"ticket is {status[tid]}")


def check_urls(report: Report, root: str, only_skill: str | None) -> None:
    seen = set()
    for skill, path in iter_md_files(root, only_skill):
        for i, line in enumerate(read_lines(path), 1):
            for m in URL_RE.finditer(line):
                url = m.group(0).rstrip(".,);:")
                if url in seen:
                    continue
                seen.add(url)
                try:
                    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "skill-freshness-check"})
                    with urllib.request.urlopen(req, timeout=10) as r:
                        if r.status >= 400:
                            report.add(severity=SEV_WARN, kind="dead-url", skill=skill, file=path,
                                       line=i, ref=url, detail=f"HTTP {r.status}")
                except Exception as exc:  # noqa: BLE001 - network is best-effort
                    report.add(severity=SEV_WARN, kind="dead-url", skill=skill, file=path,
                               line=i, ref=url, detail=str(exc)[:60])


def render(report: Report) -> str:
    order = {SEV_ERROR: 0, SEV_WARN: 1, SEV_INFO: 2}
    fs = sorted(report.findings, key=lambda f: (order[f.severity], f.skill, f.file, f.line))
    lines = []
    counts = {SEV_ERROR: 0, SEV_WARN: 0, SEV_INFO: 0}
    for f in fs:
        counts[f.severity] += 1
    for f in fs:
        rel = os.path.relpath(f.file)
        lines.append(f"  [{f.severity}] {f.kind:<18} {f.skill}  ({rel}:{f.line})\n"
                     f"           {f.ref}  — {f.detail}")
    head = (f"Skill freshness — {report.scanned_skills} skills, {report.scanned_files} files, "
            f"tickets {'checked' if report.tickets_checked else 'not checked'}")
    summary = f"{counts[SEV_ERROR]} error(s), {counts[SEV_WARN]} warning(s), {counts[SEV_INFO]} info"
    body = "\n".join(lines) if lines else "  no findings — pack is clean ✅"
    notes = ("\n" + "\n".join("  note: " + n for n in report.notes)) if report.notes else ""
    return f"{head}\n{body}\n\n{summary}{notes}"


def main() -> int:
    ap = argparse.ArgumentParser(description="flag dead/stale references in the skill pack")
    ap.add_argument("--root", default="skills", help="skill source dir (default: skills)")
    ap.add_argument("--repo-root", default=".", help="paperclip repo root for path checks")
    ap.add_argument("--skill", default=None, help="scope to a single skill")
    ap.add_argument("--database-url",
                    default=os.environ.get("DATABASE_URL", "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip"))
    ap.add_argument("--no-tickets", action="store_true", help="skip DB ticket checks")
    ap.add_argument("--flag-closed-tickets", action="store_true", help="also report done/cancelled ticket refs")
    ap.add_argument("--check-urls", action="store_true", help="HEAD-check external URLs (network, slow)")
    ap.add_argument("--max-date-age-days", type=int, default=0, help="flag dated claims older than N days (0=off)")
    ap.add_argument("--strict", action="store_true", help="WARN findings also fail the run")
    ap.add_argument("--verbose", action="store_true", help="also list external/unverified ticket refs")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    if not os.path.isdir(args.root):
        print(f"error: skills dir not found: {args.root}", file=sys.stderr)
        return 2

    report = Report()
    today = dt.datetime.now(dt.timezone.utc).date()
    repo_path_seen: set = set()
    skills_seen: set = set()

    for skill, path in iter_md_files(args.root, args.skill):
        report.scanned_files += 1
        skills_seen.add(skill)
        lines = read_lines(path)
        check_links(report, args.root, skill, path, lines)
        check_repo_paths(report, args.repo_root, skill, path, lines, repo_path_seen)
        check_abspaths(report, skill, path, lines)
        if args.max_date_age_days > 0:
            check_dates(report, skill, path, lines, args.max_date_age_days, today)
    report.scanned_skills = len(skills_seen)

    if not args.no_tickets:
        refs = collect_tickets(args.root, args.skill)
        if refs:
            check_tickets(report, refs, args.database_url, args.flag_closed_tickets, args.verbose)

    if args.check_urls:
        check_urls(report, args.root, args.skill)

    if args.json:
        print(json.dumps({
            "scanned_skills": report.scanned_skills,
            "scanned_files": report.scanned_files,
            "tickets_checked": report.tickets_checked,
            "notes": report.notes,
            "findings": [asdict(f) for f in report.findings],
        }, indent=2))
    else:
        print(render(report))

    errors = [f for f in report.findings if f.severity == SEV_ERROR]
    warns = [f for f in report.findings if f.severity == SEV_WARN]
    if errors or (args.strict and warns):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
