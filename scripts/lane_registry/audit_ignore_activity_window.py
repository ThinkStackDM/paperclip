#!/usr/bin/env python3
"""Audit registry primaries that still ignore company activity windows.

Reports justification classes instead of mutating the fleet. Use this after
lane-primary flips/promotions to spot primaries that retained the sister-only
24/7 exemption.
"""
from __future__ import annotations

import json
import sys
from typing import Any

import lib


IGNORE_KEY = "ignoreActivityWindow"
EXCEPTION_KEY = "ignoreActivityWindowException"


def _psql_json(sql: str, db_url: str) -> list[dict[str, Any]]:
    rows = lib._psql(db_url, sql)
    out: list[dict[str, Any]] = []
    for row in rows:
        if not row:
            continue
        out.append(json.loads(row[0]))
    return out


def load_company_windows(db_url: str) -> dict[str, dict[str, Any]]:
    rows = _psql_json(
        """
        select json_build_object(
          'id', id,
          'name', name,
          'issuePrefix', issue_prefix,
          'activityWindow', activity_window
        )::text
        from companies
        where status <> 'archived';
        """,
        db_url,
    )
    return {row["id"]: row for row in rows}


def load_agents_with_runtime(db_url: str) -> dict[str, dict[str, Any]]:
    rows = _psql_json(
        """
        select json_build_object(
          'id', id,
          'companyId', company_id,
          'name', name,
          'role', role,
          'status', status,
          'adapterType', adapter_type,
          'runtimeConfig', runtime_config
        )::text
        from agents
        where status not in ('terminated', 'archived');
        """,
        db_url,
    )
    return {row["id"]: row for row in rows}


def classify(agent: dict[str, Any], company: dict[str, Any] | None) -> tuple[str, str]:
    runtime = agent.get("runtimeConfig") or {}
    exception = runtime.get(EXCEPTION_KEY)
    if isinstance(exception, dict):
        klass = str(exception.get("class") or "").strip()
        if klass:
            return klass, "runtime_config_exception"
    if not company or company.get("activityWindow") is None:
        return "always_on_company", "company_activity_window"
    role = str(agent.get("role") or "").lower()
    name = str(agent.get("name") or "")
    adapter = str(agent.get("adapterType") or "")
    company_name = str(company.get("name") or "")
    if role == "ceo":
        return "permanent_portfolio_ceo_coverage", "role_inference"
    if role == "cto":
        return "window_flipped_cto", "role_inference"
    if adapter == "paperclip_shell_handler" or name in {"RoutingPA", "MC-Compiler", "Fallback-Compiler"}:
        return "approved_control_or_routine_lane", "lane_inference"
    if company_name == "ThinkStack Capital" or any(token in name for token in ("Quant", "Polymarket", "Market")):
        return "market_24_7_operations", "lane_inference"
    return "violation_needs_clear_or_exception", "audit_finding"


def main(argv: list[str]) -> int:
    as_json = "--json" in argv
    db_url = lib.DEFAULT_DB_URL
    agents = load_agents_with_runtime(db_url)
    rows = lib.load_active_fallback_rows(db_url)
    companies = load_company_windows(db_url)
    primary_ids = sorted({row["primary"] for row in rows})
    findings: list[dict[str, Any]] = []
    for primary_id in primary_ids:
        agent = agents.get(primary_id)
        if not agent:
            continue
        runtime = agent.get("runtimeConfig") or {}
        if runtime.get(IGNORE_KEY) is not True:
            continue
        company = companies.get(agent.get("companyId", ""))
        justification_class, source = classify(agent, company)
        findings.append({
            "company": company.get("name") if company else agent.get("companyId"),
            "issuePrefix": company.get("issuePrefix") if company else None,
            "agentId": primary_id,
            "agentName": agent.get("name"),
            "role": agent.get("role"),
            "adapterType": agent.get("adapterType"),
            "companyWindow": company.get("activityWindow") if company else None,
            "justificationClass": justification_class,
            "classificationSource": source,
        })

    if as_json:
        print(json.dumps(findings, indent=2, sort_keys=True))
        return 0

    if not findings:
        print("No registry primaries currently retain ignoreActivityWindow=true.")
        return 0

    print("Registry primaries with ignoreActivityWindow=true")
    print("")
    for finding in findings:
        company = finding["company"]
        agent_name = finding["agentName"]
        role = finding["role"]
        klass = finding["justificationClass"]
        source = finding["classificationSource"]
        print(f"- {company}: {agent_name} ({role}) -> {klass} [{source}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
