"""Shared logic for the lane-fallback registry unification.

Single source of truth = the `agent_fallback_sisters` DB table (lane membership,
one Crown "primary" per lane). The watcher's flat `fallback-registry-*.json`
files are a DERIVED ARTIFACT produced by `generate.py` from that table.

Failover ORDER is computed here from adapter model-tier (claude -> codex ->
gemini/antigravity -> hermes/grok), NOT from the table's `priority` column
(which is UI/Crown ordering only). This matches the watcher's own
MODEL_FAMILY_ORDER and reproduces the historical hand-maintained flat files.

Pure, dependency-free (stdlib only) so it is trivially unit-testable.
"""
from __future__ import annotations

import os
import subprocess
from typing import Iterable

# Suffixes that mark a fallback "sister" clone of a base agent (e.g.
# "GLaD0S-Codex" is a sister of "GLaD0S"). Mirrors ui/src/lib/agent-lanes.ts.
SUFFIXES = ("-Codex", "-Grok", "-Hermes", "-Gemini")

# Lower rank = preferred/earlier in the failover chain. hermes/grok are the
# cheap bottom tier; unknown adapters sort last (stable).
FAMILY_RANK = {
    "claude_local": 0,
    "codex_local": 1,
    "gemini_local": 2,
    "antigravity_local": 2,
    "hermes_local": 3,
    "grok_local": 3,
}
UNKNOWN_RANK = 9

# Companies that run a session-limit watcher (one flat file each). slug is the
# env/launchd suffix; the default TSMC watcher uses the bare fallback-registry.json.
COMPANIES = [
    {"slug": "tsmc",    "name": "TSMC",                  "company_id": "e6361895-a6a4-438d-bb76-b17a0ad026cb", "filename": "fallback-registry.json"},
    {"slug": "capital", "name": "ThinkStack Capital",    "company_id": "211e0f96-ecd2-4fe0-81f8-72059bc6ed46", "filename": "fallback-registry-capital.json"},
    {"slug": "media",   "name": "ThinkStack Media",      "company_id": "d71c9e82-1a4b-497f-9bbc-5b9dd028c367", "filename": "fallback-registry-media.json"},
    {"slug": "tsb",     "name": "ThinkStack Books",      "company_id": "baba1235-7f5b-4555-aed8-c06efa095125", "filename": "fallback-registry-tsb.json"},
    {"slug": "pod",     "name": "Dastardly Print",       "company_id": "e7507bfa-ecfd-4dde-bd2a-7b19947ffdde", "filename": "fallback-registry-pod.json"},
    {"slug": "kiss",    "name": "ThinkStack KISS",       "company_id": "6d2c1656-dabd-4aa1-b45a-0f5aedea3092", "filename": "fallback-registry-kiss.json"},
    {"slug": "recruit", "name": "ThinkStack Recruitment","company_id": "cefbbf68-0ca7-4383-967e-03bc1b037ae7", "filename": "fallback-registry-recruit.json"},
]

# Where the watcher reads its flat registries (the agent instructions dir).
DEFAULT_OUT_DIR = (
    "/Users/glad0s/.paperclip/instances/default/companies/"
    "e6361895-a6a4-438d-bb76-b17a0ad026cb/agents/"
    "3733fb01-0791-442c-83d0-eb69a5c6602b/instructions"
)

DEFAULT_DB_URL = os.environ.get(
    "DATABASE_URL", "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip"
)

# created_by tag stamped on backfilled rows so they can be audited / reverted.
BACKFILL_TAG = "lane-unify-2026-06-23"


def base_of(name: str) -> str:
    """Lane base name: strip a single recognised sister suffix, else the name."""
    for suffix in SUFFIXES:
        if name.endswith(suffix) and len(name) > len(suffix):
            return name[: -len(suffix)]
    return name


def is_suffixed(name: str) -> bool:
    return base_of(name) != name


def family_rank(adapter: str) -> int:
    return FAMILY_RANK.get((adapter or "").strip().lower(), UNKNOWN_RANK)


def order_members(member_ids: Iterable[str], agents: dict) -> list[str]:
    """Order lane members for the failover chain: by model-tier, then
    base-before-clone, then name. Deterministic and primary-first.

    `agents` maps id -> {"adapter": str, "name": str}. Unknown ids sort last.
    """
    def key(aid: str):
        info = agents.get(aid, {})
        name = info.get("name", aid)
        return (family_rank(info.get("adapter", "")), is_suffixed(name), name)

    return sorted(dict.fromkeys(member_ids), key=key)


def expand_chains(ordered_members: list[str]) -> dict[str, list[str]]:
    """Transitive failover chains: each member -> everyone after it in the
    ordered lane. Members at the bottom (no one after them) are omitted."""
    out: dict[str, list[str]] = {}
    for i, aid in enumerate(ordered_members):
        chain = ordered_members[i + 1:]
        if chain:
            out[aid] = list(chain)
    return out


def lane_chains(member_ids: Iterable[str], agents: dict) -> dict[str, list[str]]:
    return expand_chains(order_members(member_ids, agents))


def group_scope_into_lanes(scope_ids: Iterable[str], agents: dict) -> dict[str, list[str]]:
    """Group a set of agent ids into name-base lanes. Returns base_name ->
    [member_ids]. Used by the backfill to reconstruct lanes from the historical
    flat files; singleton lanes (a base with no sisters present) are returned
    too so callers can decide to drop them."""
    lanes: dict[str, list[str]] = {}
    for aid in scope_ids:
        name = agents.get(aid, {}).get("name", aid)
        lanes.setdefault(base_of(name), []).append(aid)
    return lanes


# --------------------------------------------------------------------------
# Data access (psql subprocess; no third-party deps required)
# --------------------------------------------------------------------------

def _psql(db_url: str, sql: str) -> list[list[str]]:
    out = subprocess.run(
        ["psql", db_url, "-At", "-F", "\t", "-c", sql],
        check=True, capture_output=True, text=True,
    ).stdout
    rows = []
    for line in out.splitlines():
        if line == "":
            continue
        rows.append(line.split("\t"))
    return rows


def load_agents(db_url: str = DEFAULT_DB_URL) -> dict:
    """id -> {adapter, name, status, company_id}."""
    rows = _psql(db_url, "select id, adapter_type, name, status, company_id from agents;")
    return {
        r[0]: {"adapter": r[1], "name": r[2], "status": r[3], "company_id": r[4]}
        for r in rows if len(r) >= 5
    }


def load_active_fallback_rows(db_url: str = DEFAULT_DB_URL) -> list[dict]:
    """Active agent_fallback_sisters rows: {company_id, primary, sister, priority}."""
    rows = _psql(
        db_url,
        "select company_id, primary_agent_id, sister_agent_id, priority "
        "from agent_fallback_sisters where revoked_at is null;",
    )
    return [
        {"company_id": r[0], "primary": r[1], "sister": r[2], "priority": int(r[3])}
        for r in rows if len(r) >= 4
    ]


def load_agents_from_tsv(path: str) -> dict:
    """Test/offline helper: TSV of id<TAB>adapter<TAB>name<TAB>status[<TAB>company]."""
    agents = {}
    with open(path) as fh:
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if len(p) < 4:
                continue
            agents[p[0]] = {
                "adapter": p[1], "name": p[2], "status": p[3],
                "company_id": p[4] if len(p) > 4 else "",
            }
    return agents


def load_rows_from_tsv(path: str) -> list[dict]:
    """Test/offline helper: TSV of company<TAB>primary<TAB>sister<TAB>priority."""
    rows = []
    with open(path) as fh:
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if len(p) < 4:
                continue
            rows.append({"company_id": p[0], "primary": p[1], "sister": p[2], "priority": int(p[3])})
    return rows


def company_member_sets(rows: list[dict]) -> dict[str, dict[str, set]]:
    """Group star rows -> {company_id: {primary_id: {member_ids incl primary}}}."""
    out: dict[str, dict[str, set]] = {}
    for row in rows:
        lane = out.setdefault(row["company_id"], {}).setdefault(row["primary"], set())
        lane.add(row["primary"])
        lane.add(row["sister"])
    return out
