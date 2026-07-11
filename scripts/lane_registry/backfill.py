#!/usr/bin/env python3
"""One-time backfill: make the agent_fallback_sisters DB table COMPLETE so it
can be the single source of truth for the watcher's failover registry.

Reconstructs lane membership from today's live flat files + agent inventory
(the historical source of truth), and inserts rows for the clean, name-coherent
lanes that the table does not yet cover. Lanes already represented in the table
are left untouched. Non-name-coherent cross-lane pins (singletons) are dropped
per the agreed normalization (they cannot live in the UI star without breaking
the one-Crown-per-agent rule).

Rows are stamped created_by=<BACKFILL_TAG> and are reversible:
  UPDATE agent_fallback_sisters SET revoked_at = now() WHERE created_by='<TAG>';

Usage:
  backfill.py --dry-run                  # show inserts that WOULD happen (DB)
  backfill.py --emit-rows                # TSV of new rows (for piping to generate)
  backfill.py --apply                    # insert rows (ON CONFLICT DO NOTHING)
  backfill.py --agents-file A --existing-rows-file E --emit-rows   # offline
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402


def flat_scope(path: str) -> set:
    """Every agent id mentioned (root or sister) in a flat registry file."""
    try:
        with open(path) as fh:
            flat = json.load(fh)
    except FileNotFoundError:
        return set()
    scope = set(flat.keys())
    for sisters in flat.values():
        scope.update(sisters)
    return scope


def desired_new_rows(agents: dict, out_dir: str, existing_member_ids: set) -> list[dict]:
    """New star rows for clean lanes not yet represented in the table.

    Returns dicts {company_id, primary, sister, priority, primary_name, sister_name}.
    Skips: singleton lanes (cross-pins) and any lane already represented
    (a member already present as primary/sister in an active row)."""
    new_rows: list[dict] = []
    for company in lib.COMPANIES:
        cid = company["company_id"]
        scope = flat_scope(os.path.join(out_dir, company["filename"]))
        if not scope:
            continue
        for base, members in lib.group_scope_into_lanes(scope, agents).items():
            if len(members) < 2:
                continue  # singleton / cross-lane pin -> dropped (normalize)
            if any(m in existing_member_ids for m in members):
                continue  # lane already represented in the table
            ordered = lib.order_members(members, agents)
            primary = ordered[0]
            for prio, sister in enumerate(ordered[1:], start=1):
                new_rows.append({
                    "company_id": cid,
                    "primary": primary,
                    "sister": sister,
                    "priority": prio,
                    "primary_name": agents.get(primary, {}).get("name", primary),
                    "sister_name": agents.get(sister, {}).get("name", sister),
                })
    return new_rows


def existing_member_ids(rows: list[dict]) -> set:
    ids = set()
    for r in rows:
        ids.add(r["primary"])
        ids.add(r["sister"])
    return ids


def apply_rows(db_url: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    values = ",".join(
        f"('{r['company_id']}','{r['primary']}','{r['sister']}',{r['priority']},'{lib.BACKFILL_TAG}')"
        for r in rows
    )
    sql = (
        "INSERT INTO agent_fallback_sisters "
        "(company_id, primary_agent_id, sister_agent_id, priority, created_by) VALUES "
        + values
        + " ON CONFLICT (company_id, primary_agent_id, sister_agent_id) DO NOTHING;"
    )
    out = subprocess.run(["psql", db_url, "-c", sql], check=True, capture_output=True, text=True).stdout
    # psql prints "INSERT 0 N"
    inserted = 0
    for tok in out.split():
        if tok.isdigit():
            inserted = int(tok)
    return inserted


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db-url", default=lib.DEFAULT_DB_URL)
    ap.add_argument("--out-dir", default=lib.DEFAULT_OUT_DIR)
    ap.add_argument("--agents-file", help="TSV id,adapter,name,status[,company] (instead of DB)")
    ap.add_argument("--existing-rows-file", help="TSV company,primary,sister,priority (instead of DB)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="show inserts (default)")
    mode.add_argument("--emit-rows", action="store_true", help="print new rows as TSV only")
    mode.add_argument("--apply", action="store_true", help="insert rows into the DB")
    args = ap.parse_args()

    agents = lib.load_agents_from_tsv(args.agents_file) if args.agents_file else lib.load_agents(args.db_url)
    existing = (lib.load_rows_from_tsv(args.existing_rows_file) if args.existing_rows_file
                else lib.load_active_fallback_rows(args.db_url))
    new_rows = desired_new_rows(agents, args.out_dir, existing_member_ids(existing))

    if args.emit_rows:
        for r in new_rows:
            print(f"{r['company_id']}\t{r['primary']}\t{r['sister']}\t{r['priority']}")
        return 0

    by_company: dict[str, list[dict]] = {}
    for r in new_rows:
        by_company.setdefault(r["company_id"], []).append(r)
    cname = {c["company_id"]: c["name"] for c in lib.COMPANIES}
    print(f"Backfill plan — {len(new_rows)} new row(s), tag='{lib.BACKFILL_TAG}':")
    for cid, rows in by_company.items():
        print(f"\n  {cname.get(cid, cid)}:")
        for r in rows:
            print(f"    primary {r['primary_name']:<26} <- sister {r['sister_name']:<26} (prio {r['priority']})")
    if not new_rows:
        print("  (nothing to add — table already complete)")

    if args.apply:
        n = apply_rows(args.db_url, new_rows)
        print(f"\nAPPLIED: inserted {n} row(s).")
        print(f"Revert:  UPDATE agent_fallback_sisters SET revoked_at=now() WHERE created_by='{lib.BACKFILL_TAG}';")
    else:
        print("\nDRY-RUN: no DB changes. Re-run with --apply to insert.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
