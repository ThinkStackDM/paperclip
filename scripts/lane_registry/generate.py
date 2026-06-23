#!/usr/bin/env python3
"""Generate the watcher's flat fallback-registry-*.json files FROM the
agent_fallback_sisters DB table (the single source of truth).

Per company, each DB lane (one primary + its sisters) is a star; we take the
member set, order it by model-tier (lib.order_members), and emit transitive
failover chains in the flat `{agentId: [sisterId, ...]}` shape the watcher's
`load_registry()` already consumes. Failover order comes from model-tier, NOT
the table's `priority` column (which is UI/Crown ordering).

Usage:
  generate.py --dry-run                 # semantic diff vs live files (no writes)
  generate.py --write                   # regenerate files atomically
  generate.py --rows-file R --agents-file A --dry-run   # offline/test inputs
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402


def build_registry(company_id: str, member_sets: dict, agents: dict) -> dict[str, list[str]]:
    """Flat registry for one company from its star lanes."""
    registry: dict[str, list[str]] = {}
    for _primary, members in member_sets.get(company_id, {}).items():
        for aid, chain in lib.lane_chains(members, agents).items():
            # Each agent belongs to exactly one lane post-normalization, so a
            # collision here means malformed data — surface it loudly.
            if aid in registry and registry[aid] != chain:
                raise SystemExit(
                    f"agent {aid} appears in two lanes for company {company_id}; "
                    f"DB table has overlapping membership"
                )
            registry[aid] = chain
    # Stable key order (tier, name) so re-runs are byte-identical.
    ordered = lib.order_members(registry.keys(), agents)
    return {aid: registry[aid] for aid in ordered}


def load_current(path: str) -> dict:
    try:
        with open(path) as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {}


def semantic_diff(old: dict, new: dict) -> list[str]:
    """Order-insensitive per-root diff lines (empty == identical)."""
    lines = []
    for root in sorted(set(old) | set(new)):
        o, n = old.get(root), new.get(root)
        if o == n:
            continue
        if o is None:
            lines.append(f"  + ADD  {root} -> {n}")
        elif n is None:
            lines.append(f"  - DROP {root} -> {o}")
        else:
            lines.append(f"  ~ CHG  {root}: {o} -> {n}")
    return lines


def atomic_write(path: str, payload: dict) -> None:
    text = json.dumps(payload, indent=2) + "\n"
    d = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".fallback-registry.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(text)
        os.replace(tmp, path)  # atomic on POSIX; watcher never sees a partial file
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db-url", default=lib.DEFAULT_DB_URL)
    ap.add_argument("--out-dir", default=lib.DEFAULT_OUT_DIR)
    ap.add_argument("--rows-file", help="TSV of company,primary,sister,priority (instead of DB)")
    ap.add_argument("--agents-file", help="TSV of id,adapter,name,status[,company] (instead of DB)")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="diff only, no writes")
    mode.add_argument("--write", action="store_true", help="regenerate files atomically")
    ap.add_argument("--max-drops", type=int, default=6,
                    help="abort --write if more than this many roots would be dropped "
                         "(guards against generate-before-backfill); override with --force")
    ap.add_argument("--force", action="store_true", help="bypass the --max-drops safety guard")
    args = ap.parse_args()

    agents = lib.load_agents_from_tsv(args.agents_file) if args.agents_file else lib.load_agents(args.db_url)
    rows = lib.load_rows_from_tsv(args.rows_file) if args.rows_file else lib.load_active_fallback_rows(args.db_url)
    member_sets = lib.company_member_sets(rows)

    # Compute every company's new registry + diff first; only write after the
    # safety check passes, so we never write a partial/gutted set.
    plan = []
    changed = total_drops = 0
    for company in lib.COMPANIES:
        cid = company["company_id"]
        path = os.path.join(args.out_dir, company["filename"])
        new = build_registry(cid, member_sets, agents)
        cur = load_current(path)
        diff = semantic_diff(cur, new)
        drops = sum(1 for line in diff if line.lstrip().startswith("- DROP"))
        total_drops += drops
        plan.append((company, path, new, diff))
        print(f"[{'CHANGED' if diff else 'ok'}] {company['name']:<22} {company['filename']} "
              f"({len(new)} roots, {len(member_sets.get(cid, {}))} lanes)")
        for line in diff:
            print(line)
        if diff:
            changed += 1

    if args.write and total_drops > args.max_drops and not args.force:
        print(f"\nABORTED: would drop {total_drops} roots (> --max-drops={args.max_drops}). "
              f"This usually means the DB table is not backfilled yet — run backfill.py first. "
              f"Pass --force to override.", file=sys.stderr)
        return 2

    if args.write:
        for _company, path, new, _diff in plan:
            atomic_write(path, new)

    print(f"\n{'WROTE' if args.write else 'DRY-RUN'}: "
          f"{changed} file(s) {'changed' if changed else 'identical'}, {total_drops} root(s) dropped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
