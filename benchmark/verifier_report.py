#!/usr/bin/env python3
"""
verifier_report.py — summarize one or more qa-verifier runs into verifier-specific metrics.

Usage:
  python3 verifier_report.py results/run-<ts>
  python3 verifier_report.py results/run-<ts> results/run-<ts-2> results/run-<ts-3>
  python3 verifier_report.py results/run-<ts> --json

This keeps the generic bench engine intact while emitting the metrics TSBC-997
actually needs: detection rate, false-pass rate, refusal discipline, control
pass rate, evidence quality, and a recommendation biased against false passes.
When multiple runs are supplied, metrics aggregate across all repeats and the
per-task breakdown collapses each repeated task into one summary row.
"""

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import benchlib


def load_runs(path_args):
    all_rows = []
    run_paths = []
    for path_str in path_args:
        path = Path(path_str)
        if path.is_dir():
            path = path / "runs.json"
        with open(path) as f:
            all_rows.extend(json.load(f))
        run_paths.append(path)
    return all_rows, run_paths


def suite_meta():
    suite = benchlib.load_suite("qa-verifier")
    out = {}
    for task in suite.get("tasks", []):
        case = (((task.get("metadata") or {}).get("verifierCase")) or {}).copy()
        case["title"] = task.get("title") or task["id"]
        out[task["id"]] = case
    return out


def safe_mean(values):
    vals = [v for v in values if isinstance(v, (int, float))]
    return (sum(vals) / len(vals)) if vals else None


def parse_verdict(run):
    parsed = benchlib.extract_json(run.get("output") or "")
    if isinstance(parsed, dict):
        verdict = parsed.get("verdict")
        if isinstance(verdict, str):
            return verdict.strip().lower()
    return None


def pct(numerator, denominator):
    if denominator == 0:
        return None
    return numerator / denominator


def summarize_errors(rows):
    counts = Counter()
    for row in rows:
        err = row.get("error")
        if err:
            counts[err] += 1
    if not counts:
        return "—"
    parts = [f"{count}x {err}" for err, count in counts.most_common()]
    return "; ".join(parts)


def summarize_verdicts(rows):
    verdicts = [parse_verdict(row) for row in rows if parse_verdict(row)]
    if not verdicts:
        return "—"
    counts = Counter(verdicts)
    if len(counts) == 1:
        return next(iter(counts))
    parts = [f"{verdict} ({count})" for verdict, count in counts.most_common()]
    return ", ".join(parts)


def fixture_inventory(meta, rows):
    task_ids = sorted({row.get("task_id") for row in rows if row.get("task_id") in meta})
    status_counts = Counter()
    class_counts = Counter()
    for task_id in task_ids:
        info = meta[task_id]
        status_counts[info.get("fixtureStatus") or "unknown"] += 1
        class_counts[info.get("taskClass") or "unknown"] += 1
    real_count = sum(count for status, count in status_counts.items() if str(status).startswith("real_"))
    synthetic_count = sum(count for status, count in status_counts.items() if str(status).startswith("synthetic_"))
    return {
        "uniqueTaskCount": len(task_ids),
        "realTaskCount": real_count,
        "syntheticTaskCount": synthetic_count,
        "fixtureStatusCounts": dict(status_counts),
        "taskClassCounts": dict(class_counts),
    }


def compute(rows, run_paths):
    meta = suite_meta()
    models = {}
    for row in rows:
        if row.get("role") != "qa-verifier":
            continue
        info = meta.get(row.get("task_id"))
        if not info:
            continue
        bucket = models.setdefault(row["model_id"], {
            "modelId": row["model_id"],
            "modelLabel": row.get("model_label") or row["model_id"],
            "rows": [],
        })
        bucket["rows"].append((row, info))

    summaries = []
    for model_id, bucket in models.items():
        defect_total = refusal_total = control_total = 0
        defect_detect = refusal_correct = control_pass = 0
        false_passes = 0
        ok_runs = 0
        evidence_quality = []
        posture_quality = []
        table_quality = []
        verdict_quality = []
        out_tokens = []
        total_tokens = []
        task_groups = defaultdict(list)

        for row, info in bucket["rows"]:
            if row.get("ok"):
                ok_runs += 1
            verdict = parse_verdict(row)
            task_class = info.get("taskClass")

            if task_class == "defect":
                defect_total += 1
                if verdict == "reject":
                    defect_detect += 1
            elif task_class == "refusal":
                refusal_total += 1
                if verdict == "refuse":
                    refusal_correct += 1
            elif task_class == "control":
                control_total += 1
                if verdict == "pass":
                    control_pass += 1

            if task_class in {"defect", "refusal"} and verdict == "pass":
                false_passes += 1

            per = (((row.get("judgeDetail") or {}).get("perCriterion")) or {})
            evidence_quality.append(per.get("evidence_quality"))
            posture_quality.append(per.get("verifier_posture"))
            table_quality.append(per.get("a1_g6_coverage"))
            verdict_quality.append(row.get("quality"))
            out_tokens.append(row.get("outputTokens"))
            total_tokens.append(row.get("totalTokens"))

            task_groups[row["task_id"]].append((row, info))

        task_breakdown = []
        for task_id in sorted(task_groups):
            entries = task_groups[task_id]
            first_info = entries[0][1]
            task_rows = [row for row, _ in entries]
            task_breakdown.append({
                "taskId": task_id,
                "title": first_info.get("title") or task_id,
                "taskClass": first_info.get("taskClass"),
                "fixtureStatus": first_info.get("fixtureStatus"),
                "expectedVerdict": str(first_info.get("expectedVerdict") or "").lower(),
                "runs": len(task_rows),
                "observedVerdicts": summarize_verdicts(task_rows),
                "meanQuality": safe_mean([row.get("quality") for row in task_rows]),
                "meanOutputTokens": safe_mean([row.get("outputTokens") for row in task_rows]),
                "errorSummary": summarize_errors(task_rows),
            })

        summary = {
            "modelId": model_id,
            "modelLabel": bucket["modelLabel"],
            "cases": len(bucket["rows"]),
            "okRuns": ok_runs,
            "successRate": pct(ok_runs, len(bucket["rows"])),
            "defectCases": defect_total,
            "refusalCases": refusal_total,
            "controlCases": control_total,
            "detectionRate": pct(defect_detect, defect_total),
            "refusalDisciplineRate": pct(refusal_correct, refusal_total),
            "controlPassRate": pct(control_pass, control_total),
            "falsePassRate": pct(false_passes, defect_total + refusal_total),
            "meanEvidenceQuality": safe_mean(evidence_quality),
            "meanVerifierPosture": safe_mean(posture_quality),
            "meanTableCoverage": safe_mean(table_quality),
            "meanQuality": safe_mean(verdict_quality),
            "meanOutputTokens": safe_mean(out_tokens),
            "meanTotalTokens": safe_mean(total_tokens),
            "taskBreakdown": task_breakdown,
        }
        summaries.append(summary)

    summaries.sort(
        key=lambda s: (
            -(s["successRate"] or 0),
            99 if s["falsePassRate"] is None else s["falsePassRate"],
            -(s["detectionRate"] or 0),
            -(s["refusalDisciplineRate"] or 0),
            -(s["controlPassRate"] or 0),
            -(s["meanEvidenceQuality"] or 0),
            s["meanOutputTokens"] or float("inf"),
        )
    )

    recommendation = None
    eligible = [s for s in summaries if s.get("successRate") == 1]
    if eligible:
        perfect = [
            s for s in eligible
            if s.get("falsePassRate") == 0
            and s.get("detectionRate") == 1
            and s.get("refusalDisciplineRate") == 1
            and s.get("controlPassRate") == 1
        ]
        if len(perfect) >= 2:
            evidence_leader = max(perfect, key=lambda s: (s.get("meanEvidenceQuality") or 0))
            cheapest = min(perfect, key=lambda s: (s.get("meanOutputTokens") or float("inf")))
            recommendation = {
                "pick": cheapest["modelId"],
                "pickLabel": cheapest["modelLabel"],
                "reason": (
                    "Multiple models finished with perfect safety metrics on the current verifier suite. "
                    "Hold the cheapest fully-safe finisher unless the board explicitly prefers the higher-evidence model enough to justify the cost."
                ),
                "evidenceLeader": evidence_leader["modelId"],
                "evidenceLeaderLabel": evidence_leader["modelLabel"],
            }
        else:
            pick = eligible[0]
            recommendation = {
                "pick": pick["modelId"],
                "pickLabel": pick["modelLabel"],
                "reason": (
                    "Only models with 100% suite completion are eligible. Among them, lowest false-pass rate wins first; ties break on detection rate, refusal discipline, clean-control pass rate, evidence quality, then output tokens."
                ),
            }
    elif summaries:
        recommendation = {
            "pick": None,
            "pickLabel": None,
            "reason": "No model completed the suite successfully in this aggregate."
        }

    run_names = [path.parent.name for path in run_paths]
    report = {
        "suite": "qa-verifier",
        "models": summaries,
        "recommendation": recommendation,
        "meta": {
            "runCount": len(run_paths),
            "runNames": run_names,
            "totalRows": len(rows),
            **fixture_inventory(meta, rows),
        },
    }
    return report


def fmt_pct(value):
    if value is None:
        return "—"
    return f"{value * 100:.0f}%"


def fmt_num(value):
    if value is None:
        return "—"
    return f"{value:.3f}"


def fmt_int(value):
    if value is None:
        return "—"
    return f"{int(round(value)):,}"


def run_title(report):
    run_count = report.get("meta", {}).get("runCount") or 0
    run_names = report.get("meta", {}).get("runNames") or []
    if run_count == 1 and run_names:
        return f"`{run_names[0]}`"
    return f"{run_count}-run aggregate"


def to_markdown(report):
    lines = []
    lines.append(f"# QA Verifier Baseline — {run_title(report)}\n")
    lines.append(
        "This report summarizes the `qa-verifier` suite with verifier-specific metrics. "
        "False-pass rate is treated as the killer metric: a verifier that passes a bad or invalid packet is ranked below one that is merely conservative.\n"
    )

    meta = report.get("meta") or {}
    run_names = meta.get("runNames") or []
    if run_names:
        lines.append(f"**Runs:** {', '.join(f'`{name}`' for name in run_names)}\n")
    lines.append(
        f"**Trap mix:** {meta.get('realTaskCount', 0)} real-source reject fixtures, "
        f"{meta.get('syntheticTaskCount', 0)} synthetic integrity/control fixtures, "
        f"{meta.get('uniqueTaskCount', 0)} unique tasks total.\n"
    )

    if report.get("recommendation"):
        rec = report["recommendation"]
        if rec.get("pick"):
            lines.append(f"**Current recommendation:** `{rec['pick']}` ({rec['pickLabel']})\n")
        else:
            lines.append("**Current recommendation:** none from this aggregate\n")
        lines.append(f"_Rule: {rec['reason']}_\n")
        if rec.get("evidenceLeader"):
            lines.append(
                f"_Highest evidence-quality perfect finisher: `{rec['evidenceLeader']}` ({rec['evidenceLeaderLabel']})._\n"
            )

    lines.append("## Score Table\n")
    lines.append("| Model | Success | Detect bad fixtures | False-pass | Refusal discipline | Clean control pass | Evidence quality | Mean out tokens |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for row in report.get("models", []):
        lines.append(
            f"| {row['modelLabel']} | {fmt_pct(row['successRate'])} | {fmt_pct(row['detectionRate'])} | {fmt_pct(row['falsePassRate'])} | "
            f"{fmt_pct(row['refusalDisciplineRate'])} | {fmt_pct(row['controlPassRate'])} | "
            f"{fmt_num(row['meanEvidenceQuality'])} | {fmt_int(row['meanOutputTokens'])} |"
        )

    lines.append("\n## Notes\n")
    if (meta.get("runCount") or 0) >= 3:
        lines.append("- This is the decision-grade repeat aggregate requested in TSBC-997, not a single directional sweep.")
    else:
        lines.append("- This aggregate is still directional because it contains fewer than the requested 3 repeats.")
    lines.append("- The suite now includes the exported real-source reject bundles for double-outro/stale-intro, flat-bars chart render, Apple/system-TTS audio, and harsh-swoosh transitions.")
    lines.append("- The clean control remains synthetic until a real passing rerender bundle is exported.")
    lines.append("- The cashflow chain's historical late-tail black-gap defect is documented in the manifest, but the exported source-black sidecar is already green, so that exact defect is not scored from the current real bundle.\n")

    lines.append("## Per-Task Breakdown\n")
    for row in report.get("models", []):
        lines.append(f"### `{row['modelId']}`\n")
        lines.append("| Task | Class | Fixture | Runs | Expected | Observed | Mean quality | Mean out tokens | Errors |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
        for task in row.get("taskBreakdown", []):
            lines.append(
                f"| {task['taskId']} | {task['taskClass']} | {task['fixtureStatus']} | {task['runs']} | {task['expectedVerdict']} | "
                f"{task['observedVerdicts']} | {fmt_num(task['meanQuality'])} | {fmt_int(task['meanOutputTokens'])} | {task['errorSummary']} |"
            )
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_paths", nargs="+", help="Path(s) to runs.json files or run directories")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of markdown")
    args = parser.parse_args()

    runs, run_paths = load_runs(args.run_paths)
    report = compute(runs, run_paths)

    if args.json:
        json.dump(report, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return

    sys.stdout.write(to_markdown(report))


if __name__ == "__main__":
    main()
