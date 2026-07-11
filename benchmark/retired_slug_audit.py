#!/usr/bin/env python3
"""
Audit benchmark ledger rows that relied on xAI slugs retired on 2026-05-15.

TSBC-1000 requires two concrete outcomes:
1. publish an inspectable audit artifact with the affected runs and blast radius
2. invalidate the affected ledger rows through benchmark/ledger/invalidations.jsonl

This script is intentionally idempotent. Re-running it appends only missing
sidecar invalidations and always refreshes the JSON/Markdown report artifacts.
"""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ledger

ISSUE_ID = "TSBC-1000"
OFFICIAL_RETIREMENT_URL = "https://docs.x.ai/developers/migration/may-15-retirement"
RETIREMENT_EFFECTIVE_AT = "2026-05-15T19:00:00+00:00"
DIRECTIVE_CUTOFF_AT = "2026-05-15T00:00:00+00:00"
TARGET_MODELS = ("grok-4-fast", "grok-4.1-fast")
INVALIDATION_REASON = "retired_xai_slug_after_2026_05_15"
ACTIVE_LEDGER = ledger.LEDGER_PATH
ARCHIVAL_LEDGER = ledger.LEDGER_DIR / "results.jsonl.bak-precleanup-20260622"
DEFAULT_REPORT_STEM = "tsbc-1000-retired-slug-audit"
BLAST_RADIUS_DOCS = (
    "benchmark/LANE-HARDENING-READOUT.md",
    "benchmark/PORTFOLIO-LANE-CHARTER.md",
    "benchmark/SISTER-LANE-REDESIGN.md",
    "benchmark/PRODUCTION-TIER-MAP.md",
    "benchmark/results/tsbc-july-2026-lane-placement-sheet.md",
    "benchmark/results/tskb0047-work-class-owner-matrix-20260707.md",
    "benchmark/results/tsbc-940-marketplace-packaging-qa-20260706.md",
    "benchmark/results/tsbc-941-book1-listing-review-funnel-qa-20260706.md",
    "benchmark/results/tsbc-942-distribution-content-20260706.md",
)
REPLACEMENT_EVIDENCE = (
    "benchmark/results/tsbc987-xai-quota-window-synthesis-20260710.md",
    "benchmark/results/tsbc987-eu-watch-addendum-20260710.md",
)
RERUN_FOLLOWUPS = (
    {
        "title": "Rerun June lane-lock and charter decisions invalidated by retired Grok fast rows",
        "scope": "Refresh the June model-eval and config-variant runs that fed lane-lock, charter, and production-tier decisions.",
        "targets": [
            "run-20260626-171210",
            "run-20260627-135511",
            "run-20260627-135813",
            "run-20260627-203407",
            "run-20260627-210236",
            "run-20260627-210254",
            "run-20260627-234713",
            "variants-20260707-232755",
            "variants-20260707-233036",
            "variants-20260707-233305",
        ],
        "replacementModels": ["grok-4.3", "grok-4.20", "grok-4.20-non-reasoning"],
    },
    {
        "title": "Rerun July overlay skill packets invalidated by retired Grok fast rows",
        "scope": "Refresh the skill packets and July overlays that sampled retired Grok fast lanes.",
        "targets": [
            "skill-20260706-110322",
            "skill-20260706-110640",
            "skill-20260706-111930",
            "skill-20260706-113330",
        ],
        "replacementModels": ["grok-4.3", "grok-4.20", "grok-4.20-non-reasoning"],
    },
)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_ts(value):
    if not value:
        return None
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def report_stem(default_date):
    return f"{DEFAULT_REPORT_STEM}-{default_date}"


def default_output_paths(stem):
    root = Path(__file__).resolve().parent / "results"
    return root / f"{stem}.json", root / f"{stem}.md"


def line_key(path, line_number):
    return f"{path.name}:{line_number}"


def load_existing_invalidations():
    seen = set()
    for rec in ledger.read_invalidations():
        ledger_file = rec.get("ledgerFile")
        try:
            line_number = int(rec.get("lineNumber"))
        except (TypeError, ValueError):
            continue
        seen.add(f"{ledger_file}:{line_number}")
    return seen


def collect_candidates(path, cutoff):
    rows = []
    if not path.exists():
        return rows
    with open(path) as f:
        for line_number, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("model") not in TARGET_MODELS:
                continue
            ts = parse_ts(row.get("ts"))
            if ts is None or ts < cutoff:
                continue
            rows.append(
                {
                    "ledgerFile": path.name,
                    "lineNumber": line_number,
                    "ts": ts.isoformat(),
                    "company": row.get("company"),
                    "kind": row.get("kind"),
                    "testClass": row.get("test_class"),
                    "model": row.get("model"),
                    "runId": row.get("run_id"),
                    "source": row.get("source"),
                    "nTasks": row.get("n_tasks"),
                    "metrics": row.get("metrics") or {},
                    "existingValidity": row.get("validity"),
                    "existingInvalidReason": row.get("invalid_reason"),
                }
            )
    return rows


def summarize_candidates(rows):
    by_model = Counter(row["model"] for row in rows)
    by_kind = Counter(row.get("kind") for row in rows)
    by_test_class = Counter(row.get("testClass") for row in rows)
    run_groups = defaultdict(
        lambda: {
            "runId": None,
            "rowCount": 0,
            "firstTs": None,
            "lastTs": None,
            "models": Counter(),
            "kinds": Counter(),
            "testClasses": set(),
            "lineNumbers": [],
            "ledgerFiles": set(),
        }
    )
    for row in rows:
        key = row.get("runId") or f"{row['ledgerFile']}:{row['lineNumber']}"
        group = run_groups[key]
        group["runId"] = row.get("runId")
        group["rowCount"] += 1
        group["models"][row["model"]] += 1
        group["kinds"][row.get("kind")] += 1
        group["testClasses"].add(row.get("testClass"))
        group["lineNumbers"].append(row["lineNumber"])
        group["ledgerFiles"].add(row["ledgerFile"])
        if group["firstTs"] is None or row["ts"] < group["firstTs"]:
            group["firstTs"] = row["ts"]
        if group["lastTs"] is None or row["ts"] > group["lastTs"]:
            group["lastTs"] = row["ts"]
    runs = []
    for key, group in sorted(run_groups.items(), key=lambda item: (item[1]["firstTs"], item[0])):
        runs.append(
            {
                "runId": group["runId"],
                "rowCount": group["rowCount"],
                "firstTs": group["firstTs"],
                "lastTs": group["lastTs"],
                "models": dict(sorted(group["models"].items())),
                "kinds": dict(sorted(group["kinds"].items())),
                "testClasses": sorted(x for x in group["testClasses"] if x),
                "lineNumbers": sorted(group["lineNumbers"]),
                "ledgerFiles": sorted(group["ledgerFiles"]),
            }
        )
    return {
        "rowCount": len(rows),
        "runCount": len(runs),
        "byModel": dict(sorted(by_model.items())),
        "byKind": dict(sorted((k or "unknown", v) for k, v in by_kind.items())),
        "topTestClasses": dict(sorted(by_test_class.items(), key=lambda item: (-item[1], item[0]))[:12]),
        "runs": runs,
    }


def build_invalidation_records(rows, existing_keys, generated_at):
    to_write = []
    already_present = 0
    for row in rows:
        key = line_key(Path(row["ledgerFile"]), row["lineNumber"])
        if key in existing_keys:
            already_present += 1
            continue
        to_write.append(
            {
                "ts": generated_at,
                "issue": ISSUE_ID,
                "reason": INVALIDATION_REASON,
                "ledgerFile": row["ledgerFile"],
                "lineNumber": row["lineNumber"],
                "model": row["model"],
                "kind": row.get("kind"),
                "testClass": row.get("testClass"),
                "runId": row.get("runId"),
                "cutoff": DIRECTIVE_CUTOFF_AT,
                "retirementEffectiveAt": RETIREMENT_EFFECTIVE_AT,
                "retirementSourceUrl": OFFICIAL_RETIREMENT_URL,
            }
        )
    return to_write, already_present


def markdown_run_table(runs):
    lines = [
        "| Run | Rows | Kinds | Models | Window |",
        "| --- | ---: | --- | --- | --- |",
    ]
    for run in runs:
        run_id = run["runId"] or "(missing run_id)"
        kinds = ", ".join(f"{key}={value}" for key, value in run["kinds"].items())
        models = ", ".join(f"{key}={value}" for key, value in run["models"].items())
        window = run["firstTs"] if run["firstTs"] == run["lastTs"] else f"{run['firstTs']} to {run['lastTs']}"
        lines.append(f"| `{run_id}` | {run['rowCount']} | {kinds} | {models} | {window} |")
    return "\n".join(lines)


def write_report(report, json_path, md_path):
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2, sort_keys=True)
        f.write("\n")

    active = report["ledgers"][ACTIVE_LEDGER.name]
    archival = report["ledgers"][ARCHIVAL_LEDGER.name]
    invalidations = report["invalidations"]
    md = [
        f"# {ISSUE_ID} Retired Slug Audit",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "## Directive",
        "",
        "- Audit benchmark rows that used xAI slugs retired on 2026-05-15.",
        f"- Official retirement notice: {OFFICIAL_RETIREMENT_URL}",
        f"- xAI retirement effective time: `{RETIREMENT_EFFECTIVE_AT}`",
        f"- Operator audit cutoff for this issue: `{DIRECTIVE_CUTOFF_AT}`",
        f"- Target model ids: `{TARGET_MODELS[0]}`, `{TARGET_MODELS[1]}`",
        "",
        "## Verdict",
        "",
        f"- Active ledger rows invalidated: `{active['rowCount']}`",
        f"- Archival backup rows invalidated: `{archival['rowCount']}`",
        f"- Total audited rows invalidated: `{report['totals']['rowCount']}` across `{report['totals']['runCount']}` runs",
        f"- Matching sidecar invalidations currently present: `{invalidations['currentTotal']}`",
        f"- Matching sidecar invalidations already present at script start: `{invalidations['alreadyPresentAtStart']}`",
        f"- Missing invalidations detected at script start: `{invalidations['missingAtStart']}`",
        f"- Invalidations appended by this execution: `{invalidations['appendedByThisExecution']}`",
        "",
        "## Breakdown",
        "",
        f"- Active ledger by model: `{json.dumps(active['byModel'], sort_keys=True)}`",
        f"- Active ledger by kind: `{json.dumps(active['byKind'], sort_keys=True)}`",
        f"- Archival ledger by model: `{json.dumps(archival['byModel'], sort_keys=True)}`",
        f"- Archival ledger by kind: `{json.dumps(archival['byKind'], sort_keys=True)}`",
        "",
        "## Active Ledger Runs",
        "",
        markdown_run_table(active["runs"]) if active["runs"] else "_None_",
        "",
        "## Archival Backup Runs",
        "",
        markdown_run_table(archival["runs"]) if archival["runs"] else "_None_",
        "",
        "## Blast Radius",
        "",
    ]
    for path in report["blastRadius"]["documents"]:
        md.append(f"- `{path}`")
    md.extend(
        [
            "",
            "## Replacement Evidence",
            "",
        ]
    )
    for path in report["replacementEvidence"]:
        md.append(f"- `{path}`")
    md.extend(
        [
            "",
            "## Delegated Rerun Plan",
            "",
        ]
    )
    for item in report["rerunFollowUps"]:
        md.append(f"- **{item['title']}**")
        md.append(f"  Scope: {item['scope']}")
        md.append(f"  Targets: {', '.join(f'`{target}`' for target in item['targets'])}")
        md.append(f"  Replacement models: {', '.join(f'`{model}`' for model in item['replacementModels'])}")
    md.append("")
    with open(md_path, "w") as f:
        f.write("\n".join(md))


def build_report(generated_at, active_rows, archival_rows, to_write, already_present, apply_requested):
    active_summary = summarize_candidates(active_rows)
    archival_summary = summarize_candidates(archival_rows)
    total_summary = summarize_candidates(active_rows + archival_rows)
    existing_total = sum(
        1
        for rec in ledger.read_invalidations()
        if rec.get("reason") == INVALIDATION_REASON and rec.get("ledgerFile") in {ACTIVE_LEDGER.name, ARCHIVAL_LEDGER.name}
    )
    return {
        "issue": ISSUE_ID,
        "generatedAt": generated_at,
        "retirementSourceUrl": OFFICIAL_RETIREMENT_URL,
        "retirementEffectiveAt": RETIREMENT_EFFECTIVE_AT,
        "directiveCutoffAt": DIRECTIVE_CUTOFF_AT,
        "targetModels": list(TARGET_MODELS),
        "invalidations": {
            "reason": INVALIDATION_REASON,
            "currentTotal": existing_total + len(to_write),
            "alreadyPresentAtStart": already_present,
            "missingAtStart": len(to_write),
            "appendedByThisExecution": len(to_write) if apply_requested else 0,
            "applyRequested": apply_requested,
        },
        "ledgers": {
            ACTIVE_LEDGER.name: active_summary,
            ARCHIVAL_LEDGER.name: archival_summary,
        },
        "totals": {
            "rowCount": total_summary["rowCount"],
            "runCount": total_summary["runCount"],
            "byModel": total_summary["byModel"],
            "byKind": total_summary["byKind"],
        },
        "blastRadius": {
            "documents": [path for path in BLAST_RADIUS_DOCS if Path(path).exists()],
        },
        "replacementEvidence": [path for path in REPLACEMENT_EVIDENCE if Path(path).exists()],
        "rerunFollowUps": RERUN_FOLLOWUPS,
        "activeLedgerRows": active_rows,
        "archivalLedgerRows": archival_rows,
    }


def main():
    ap = argparse.ArgumentParser(description="Audit and invalidate retired xAI benchmark slugs")
    ap.add_argument("--apply", action="store_true", help="append missing invalidation records")
    ap.add_argument("--json-out", default=None, help="override JSON report path")
    ap.add_argument("--md-out", default=None, help="override Markdown report path")
    args = ap.parse_args()

    generated_at = now_iso()
    cutoff = parse_ts(DIRECTIVE_CUTOFF_AT)
    active_rows = collect_candidates(ACTIVE_LEDGER, cutoff)
    archival_rows = collect_candidates(ARCHIVAL_LEDGER, cutoff)
    existing_keys = load_existing_invalidations()
    to_write, already_present = build_invalidation_records(active_rows + archival_rows, existing_keys, generated_at)

    report = build_report(generated_at, active_rows, archival_rows, to_write, already_present, args.apply)
    stem = report_stem(datetime.now(timezone.utc).strftime("%Y%m%d"))
    default_json_out, default_md_out = default_output_paths(stem)
    json_out = Path(args.json_out) if args.json_out else default_json_out
    md_out = Path(args.md_out) if args.md_out else default_md_out

    if args.apply and to_write:
        ledger.append_invalidations(to_write)

    write_report(report, json_out, md_out)

    print(json.dumps({
        "issue": ISSUE_ID,
        "applied": bool(args.apply),
        "jsonReport": str(json_out),
        "markdownReport": str(md_out),
        "activeRows": len(active_rows),
        "archivalRows": len(archival_rows),
        "totalRows": len(active_rows) + len(archival_rows),
        "invalidationsWritten": len(to_write) if args.apply else 0,
        "invalidationsPending": 0 if args.apply else len(to_write),
        "invalidationsAlreadyPresent": already_present,
    }, indent=2))


if __name__ == "__main__":
    main()
