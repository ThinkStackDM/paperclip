#!/usr/bin/env python3
"""
Focused TSBC local-model benchmark for TSBC-727.

Runs the minimum required task types with n>=3 repeats while reusing the normal
TSBC suites, adapters, and judge. Two modes:

  python3 local_ollama_eval.py baseline
  python3 local_ollama_eval.py local qwen3:8b --compare-to results/<baseline>/summary.json
  python3 local_ollama_eval.py local gemma3:12b --compare-to results/<baseline>/summary.json
"""

import argparse
import json
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import benchlib
from adapters import run_model
from scoring import score_run


ROOT = Path(__file__).resolve().parent

SKILL_PREAMBLE = """You have access to the following operating skill. Read it and apply its guidance where relevant.

--- BEGIN SKILL: {name} ---
{body}
--- END SKILL ---

Now complete the task below. Apply the skill's method; do not mention the skill in your answer.

=== TASK ===
{task}
"""

PROFILES = {
    "shared": [
        {
            "taskType": "classification/triage",
            "role": "intake",
            "baselineModelId": "grok-4.1-fast",
            "skillFile": "variants/minimal/intake.md",
            "taskIds": [
                "intake-real-directive",
                "intake-wrong-parent-trap",
                "intake-priority-misclassify",
            ],
        },
        {
            "taskType": "extraction+summarization",
            "role": "summarize-extract",
            "baselineModelId": "gemini-flash",
            "skillFile": "variants/minimal/researcher.md",
            "taskIds": [
                "sum-faithful-tldr",
                "extract-missing-field-null",
                "summarize-keep-caveat",
            ],
        },
        {
            "taskType": "short content drafting",
            "role": "content",
            "baselineModelId": "gemini-flash",
            "skillFile": "variants/minimal/content.md",
            "taskIds": [
                "content-kdp-blurb",
                "content-exact-structure",
                "content-compliance-no-claims",
            ],
        },
        {
            "taskType": "judgment/eval",
            "role": "auditor",
            "baselineModelId": "grok-4.1-fast",
            "skillFile": "variants/minimal/auditor.md",
            "taskIds": [
                "aud-ac-idempotency-miss",
                "aud-disposition-false-success",
                "aud-portfolio-token-injection",
            ],
        },
        {
            "taskType": "light coding",
            "role": "engineer",
            "baselineModelId": "codex-gpt-5.4",
            "skillFile": "variants/minimal/engineer.md",
            "taskIds": [
                "eng-token-normalizer",
                "eng-sql-injection",
                "eng-stale-reap-default-bug",
            ],
        },
    ],
    "qwen_strengths": [
        {
            "taskType": "classification/triage",
            "role": "intake",
            "baselineModelId": "grok-4.1-fast",
            "skillFile": "variants/minimal/intake.md",
            "taskIds": [
                "intake-real-directive",
                "intake-wrong-parent-trap",
                "intake-priority-misclassify",
            ],
        },
        {
            "taskType": "extraction+summarization",
            "role": "summarize-extract",
            "baselineModelId": "gemini-flash",
            "skillFile": "variants/minimal/researcher.md",
            "taskIds": [
                "sum-faithful-tldr",
                "extract-missing-field-null",
                "summarize-keep-caveat",
            ],
        },
        {
            "taskType": "constrained mechanical rewrite",
            "role": "content",
            "baselineModelId": "gemini-flash",
            "skillFile": "variants/minimal/content.md",
            "taskIds": [
                "content-exact-structure",
                "content-compliance-no-claims",
                "content-tighten-rewrite",
            ],
        },
    ],
    "gemma_strengths": [
        {
            "taskType": "short content drafting",
            "role": "content",
            "baselineModelId": "gemini-flash",
            "skillFile": "variants/minimal/content.md",
            "taskIds": [
                "content-kdp-blurb",
                "content-exact-structure",
                "content-compliance-no-claims",
            ],
        },
        {
            "taskType": "judgment/eval",
            "role": "auditor",
            "baselineModelId": "grok-4.1-fast",
            "skillFile": "variants/minimal/auditor.md",
            "taskIds": [
                "aud-ac-idempotency-miss",
                "aud-disposition-false-success",
                "aud-portfolio-token-injection",
            ],
        },
        {
            "taskType": "light coding",
            "role": "engineer",
            "baselineModelId": "codex-gpt-5.4",
            "skillFile": "variants/minimal/engineer.md",
            "taskIds": [
                "eng-token-normalizer",
                "eng-sql-injection",
                "eng-stale-reap-default-bug",
            ],
        },
    ],
}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def run_id(prefix):
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{prefix}-{stamp}"


def mean(xs):
    xs = [x for x in xs if x is not None]
    return statistics.mean(xs) if xs else None


def pstdev(xs):
    xs = [x for x in xs if x is not None]
    return statistics.pstdev(xs) if len(xs) > 1 else 0.0 if len(xs) == 1 else None


def fmt(x, digits=3):
    return "—" if x is None else f"{x:.{digits}f}"


def fmt_pct(x):
    return "—" if x is None else f"{x*100:.0f}%"


def fmt_int(x):
    return "—" if x is None else f"{int(round(x)):,}"


def load_roster(cfg):
    rows = {}
    for row in cfg.get("models", []) + cfg.get("models_catalog", []):
        rows[row["id"]] = row
    return rows


def skill_name(body, fallback):
    first = (body or "").splitlines()[0].strip()
    if first.startswith("#"):
        return first.lstrip("#").strip()
    return fallback


def inject_skill(prompt, skill_body, skill_label):
    return SKILL_PREAMBLE.format(name=skill_label, body=skill_body, task=prompt)


def load_cases(profile_name, with_skills):
    try:
        specs = PROFILES[profile_name]
    except KeyError as exc:
        raise SystemExit(f"unknown profile: {profile_name}") from exc

    cases = []
    for spec in specs:
        suite = benchlib.load_suite(spec["role"])
        by_id = {task["id"]: task for task in suite["tasks"]}
        skill_body = None
        skill_label = None
        skill_path = None
        if with_skills:
            skill_file = spec.get("skillFile")
            if not skill_file:
                raise SystemExit(f"profile {profile_name} missing skillFile for {spec['taskType']}")
            skill_path = ROOT / skill_file
            skill_body = skill_path.read_text()
            skill_label = skill_name(skill_body, skill_path.stem)
        for task_id in spec["taskIds"]:
            if task_id not in by_id:
                raise KeyError(f"missing task {task_id!r} in role {spec['role']!r}")
            task = dict(by_id[task_id])
            prompt = task["prompt"]
            if skill_body:
                prompt = inject_skill(prompt, skill_body, skill_label)
            cases.append(
                {
                    "taskType": spec["taskType"],
                    "role": spec["role"],
                    "baselineModelId": spec["baselineModelId"],
                    "task": task,
                    "prompt": prompt,
                    "skillLabel": skill_label,
                    "skillPath": str(skill_path) if skill_path else None,
                }
            )
    return cases


def filter_cases(cases, task_types=None, limit_cases=None):
    if task_types:
        want = {item.strip() for item in task_types.split(",") if item.strip()}
        cases = [case for case in cases if case["taskType"] in want]
    if limit_cases is not None:
        cases = cases[:limit_cases]
    if not cases:
        raise SystemExit("no cases selected")
    return cases


def throughput_tokens_per_sec(raw):
    if raw.get("decodeTokensPerSec") is not None:
        return raw.get("decodeTokensPerSec")
    out = raw.get("outputTokens")
    wall = raw.get("wallMs")
    if out and wall:
        return out / (wall / 1000.0)
    return None


def execute(args, cfg, roster, cases, mode, subject_model_id, out_dir):
    timeout_sec = int(cfg["run"]["timeout_sec"])
    adapters_cfg = cfg["adapters"]
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    started_at = now_iso()
    total = len(cases) * args.reps
    done = 0
    runs = []

    for rep in range(1, args.reps + 1):
        for case in cases:
            model_id = case["baselineModelId"] if mode == "baseline" else subject_model_id
            model_row = roster[model_id]
            tag = f"{case['taskType']} :: {case['task']['id']} @ {model_id} (rep {rep}/{args.reps})"
            raw = run_model(case["prompt"], model_row, adapters_cfg, timeout_sec)
            serving = benchlib.serving_truth(model_row.get("model_arg") or model_row["id"],
                                             raw.get("model"), raw.get("modelSource"))
            scored = score_run(case["task"], raw, cfg, adapters_cfg, timeout_sec)
            rec = {
                "mode": mode,
                "rep": rep,
                "profile": args.profile,
                "withSkills": bool(args.with_skills),
                "taskType": case["taskType"],
                "role": case["role"],
                "baselineModelId": case["baselineModelId"],
                "task_id": case["task"]["id"],
                "task_title": case["task"].get("title"),
                "skillLabel": case.get("skillLabel"),
                "skillPath": case.get("skillPath"),
                "model_id": model_id,
                "model_label": model_row.get("label", model_id),
                "lane": model_row.get("lane"),
                "ok": raw.get("ok"),
                "error": raw.get("error"),
                "output": raw.get("output"),
                "model_reported": raw.get("model"),
                "requestedModel": serving["requestedModel"],
                "responseModel": serving["responseModel"],
                "responseModelSource": serving["responseModelSource"],
                "servingConfirmed": serving["servingConfirmed"],
                "servingMatchedRequest": serving["servingMatchedRequest"],
                "servingValid": serving["servingValid"],
                "servingInvalidReason": serving["servingInvalidReason"],
                "inputTokens": raw.get("inputTokens"),
                "outputTokens": raw.get("outputTokens"),
                "totalTokens": raw.get("totalTokens"),
                "tokensEstimated": raw.get("tokensEstimated"),
                "costUsd": raw.get("costUsd"),
                "wallMs": raw.get("wallMs"),
                "stderrTail": raw.get("stderrTail"),
                "decodeTokensPerSec": raw.get("decodeTokensPerSec"),
                "promptTokensPerSec": raw.get("promptTokensPerSec"),
                "throughputTokPerSec": throughput_tokens_per_sec(raw),
            }
            rec.update(scored)
            runs.append(rec)
            done += 1
            fname = (
                f"rep-{rep:02d}__{benchlib.slugify(case['taskType'])}"
                f"__{benchlib.slugify(case['task']['id'])}"
                f"__{benchlib.slugify(model_id)}.json"
            )
            with open(raw_dir / fname, "w") as f:
                json.dump(rec, f, indent=2)
            quality = rec.get("quality")
            print(
                f"[{done:>3}/{total}] "
                f"{'ok ' if rec['ok'] else 'FAIL'} "
                f"q={fmt(quality, 2):>4} "
                f"out={fmt_int(rec.get('outputTokens')):>6} "
                f"tok/s={fmt(rec.get('throughputTokPerSec'), 1):>6} "
                f"{fmt_int(rec.get('wallMs')):>8}ms  {tag}"
                + (f"  !! {rec['error']}" if rec.get("error") else ""),
                flush=True,
            )

    meta = {
        "runId": out_dir.name,
        "mode": mode,
        "subjectModelId": subject_model_id,
        "profile": args.profile,
        "withSkills": bool(args.with_skills),
        "reps": args.reps,
        "startedAt": started_at,
        "finishedAt": now_iso(),
        "nRuns": len(runs),
        "nFail": sum(1 for r in runs if not r.get("ok")),
        "taskTypes": [spec["taskType"] for spec in PROFILES[args.profile]],
    }
    return runs, meta


def summarize_runs(runs, meta):
    task_type_rows = {}
    task_rows = {}

    by_task_type = defaultdict(list)
    by_task = defaultdict(list)
    for run in runs:
        by_task_type[run["taskType"]].append(run)
        by_task[(run["taskType"], run["task_id"])].append(run)

    for task_type, rows in by_task_type.items():
        errors = Counter(r["error"] for r in rows if r.get("error"))
        task_type_rows[task_type] = {
            "baselineModelId": rows[0]["baselineModelId"],
            "modelId": rows[0]["model_id"],
            "modelLabel": rows[0]["model_label"],
            "skillLabel": rows[0].get("skillLabel"),
            "reps": meta["reps"],
            "cases": len(rows),
            "successRate": sum(1 for r in rows if r.get("ok")) / len(rows) if rows else None,
            "meanQuality": mean([r.get("quality") for r in rows]),
            "qualityStddev": pstdev([r.get("quality") for r in rows]),
            "meanOutputTokens": mean([r.get("outputTokens") for r in rows]),
            "meanInputTokens": mean([r.get("inputTokens") for r in rows]),
            "meanWallMs": mean([r.get("wallMs") for r in rows]),
            "meanTokPerSec": mean([r.get("throughputTokPerSec") for r in rows]),
            "tokPerSecStddev": pstdev([r.get("throughputTokPerSec") for r in rows]),
            "errors": dict(errors),
        }

    for (task_type, task_id), rows in by_task.items():
        task_rows[f"{task_type}::{task_id}"] = {
            "taskType": task_type,
            "taskId": task_id,
            "taskTitle": rows[0]["task_title"],
            "role": rows[0]["role"],
            "modelId": rows[0]["model_id"],
            "skillLabel": rows[0].get("skillLabel"),
            "reps": len(rows),
            "successRate": sum(1 for r in rows if r.get("ok")) / len(rows) if rows else None,
            "meanQuality": mean([r.get("quality") for r in rows]),
            "qualityStddev": pstdev([r.get("quality") for r in rows]),
            "meanTokPerSec": mean([r.get("throughputTokPerSec") for r in rows]),
            "meanOutputTokens": mean([r.get("outputTokens") for r in rows]),
            "meanWallMs": mean([r.get("wallMs") for r in rows]),
            "errors": dict(Counter(r["error"] for r in rows if r.get("error"))),
        }

    return {"meta": meta, "taskTypes": task_type_rows, "tasks": task_rows}


def load_summary(path_str):
    path = Path(path_str)
    if path.is_dir():
        path = path / "summary.json"
    with open(path) as f:
        return json.load(f)


def compare_to_baseline(summary, baseline):
    baseline_tasks = {
        row["taskId"]: row
        for row in baseline.get("tasks", {}).values()
        if isinstance(row, dict) and row.get("taskId")
    }
    tasks_by_type = defaultdict(list)
    for row in summary.get("tasks", {}).values():
        tasks_by_type[row["taskType"]].append(row)

    rows = []
    for task_type, local_tasks in tasks_by_type.items():
        covered_local = [row for row in local_tasks if row["taskId"] in baseline_tasks]
        covered_base = [baseline_tasks[row["taskId"]] for row in local_tasks if row["taskId"] in baseline_tasks]
        missing = [row["taskId"] for row in local_tasks if row["taskId"] not in baseline_tasks]
        if not covered_local:
            rows.append(
                {
                    "taskType": task_type,
                    "localModelId": local_tasks[0]["modelId"],
                    "baselineModelId": baseline.get("meta", {}).get("subjectModelId") or "base",
                    "coveredTasks": 0,
                    "totalTasks": len(local_tasks),
                    "missingTaskIds": missing,
                    "localQuality": None,
                    "baselineQuality": None,
                    "qualityDelta": None,
                    "successDelta": None,
                }
            )
            continue
        local_quality = mean([row["meanQuality"] for row in covered_local])
        baseline_quality = mean([row["meanQuality"] for row in covered_base])
        local_success = mean([row["successRate"] for row in covered_local])
        baseline_success = mean([row["successRate"] for row in covered_base])
        rows.append(
            {
                "taskType": task_type,
                "localModelId": covered_local[0]["modelId"],
                "baselineModelId": baseline.get("meta", {}).get("subjectModelId") or "base",
                "coveredTasks": len(covered_local),
                "totalTasks": len(local_tasks),
                "missingTaskIds": missing,
                "localQuality": local_quality,
                "baselineQuality": baseline_quality,
                "qualityDelta": (
                    local_quality - baseline_quality
                    if local_quality is not None and baseline_quality is not None
                    else None
                ),
                "successDelta": (
                    local_success - baseline_success
                    if local_success is not None and baseline_success is not None
                    else None
                ),
            }
        )
    return rows


def to_markdown(summary, compare_rows=None):
    meta = summary["meta"]
    lines = []
    title = meta["subjectModelId"] or "role incumbents"
    lines.append(f"# TSBC Local Model Benchmark — `{title}`\n")
    lines.append(
        f"_Generated {meta['finishedAt']}. "
        f"Mode: **{meta['mode']}**. "
        f"Profile: **{meta['profile']}**. "
        f"Skills: **{'on' if meta.get('withSkills') else 'off'}**. "
        f"Repetitions: **{meta['reps']}**. "
        f"Runs: **{meta['nRuns']}**, failures: **{meta['nFail']}**._\n"
    )
    skill_column = meta.get("withSkills")
    lines.append("## Matrix\n")
    lines.append("| Task type | Role | Tasks | Baseline incumbent | Skill |")
    lines.append("|---|---|---|---|---|")
    for spec in PROFILES[meta["profile"]]:
        lines.append(
            f"| {spec['taskType']} | `{spec['role']}` | "
            f"{', '.join(f'`{task_id}`' for task_id in spec['taskIds'])} | "
            f"`{spec['baselineModelId']}` | "
            f"`{Path(spec['skillFile']).stem if skill_column else 'none'}` |"
        )

    lines.append("\n## Task-Type Summary\n")
    lines.append("| Task type | Skill | Model | Quality | σ quality | Tok/s | σ tok/s | Success | out toks | wall ms |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for task_type, row in summary["taskTypes"].items():
        lines.append(
            f"| {task_type} | `{row.get('skillLabel') or 'none'}` | `{row['modelId']}` | {fmt(row['meanQuality'])} | "
            f"{fmt(row['qualityStddev'])} | {fmt(row['meanTokPerSec'], 1)} | "
            f"{fmt(row['tokPerSecStddev'], 1)} | {fmt_pct(row['successRate'])} | "
            f"{fmt_int(row['meanOutputTokens'])} | {fmt_int(row['meanWallMs'])} |"
        )

    if compare_rows:
        lines.append("\n## Lift vs Base\n")
        lines.append("| Task type | Local | Base | Coverage | Δ quality | Local q | Base q | Δ success | Missing base tasks |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
        for row in compare_rows:
            missing = ", ".join(f"`{task_id}`" for task_id in row["missingTaskIds"]) or "—"
            lines.append(
                f"| {row['taskType']} | `{row['localModelId']}` | `{row['baselineModelId']}` | "
                f"{row['coveredTasks']}/{row['totalTasks']} | "
                f"{fmt(row['qualityDelta'])} | {fmt(row['localQuality'])} | "
                f"{fmt(row['baselineQuality'])} | {fmt_pct(row['successDelta'])} | {missing} |"
            )

    lines.append("\n## Task Detail\n")
    lines.append("| Task type | Task | Skill | Quality | σ quality | Tok/s | Success |")
    lines.append("|---|---|---|---|---|---|---|")
    for key, row in summary["tasks"].items():
        lines.append(
            f"| {row['taskType']} | `{row['taskId']}` | `{row.get('skillLabel') or 'none'}` | {fmt(row['meanQuality'])} | "
            f"{fmt(row['qualityStddev'])} | {fmt(row['meanTokPerSec'], 1)} | "
            f"{fmt_pct(row['successRate'])} |"
        )

    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Focused TSBC local Ollama benchmark")
    ap.add_argument("--config", default=None)
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument(
        "--profile",
        default="shared",
        choices=sorted(PROFILES),
        help="task/skill profile to run",
    )
    ap.add_argument(
        "--with-skills",
        action="store_true",
        help="inject the role skill into the generation prompt only",
    )
    ap.add_argument("--task-types", default=None, help="comma list to filter selected profile task types")
    ap.add_argument("--limit-cases", type=int, default=None, help="truncate the selected case list")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("baseline", help="run role-appropriate incumbents on the local-model matrix")

    p_local = sub.add_parser("local", help="run one local model on the matrix")
    p_local.add_argument("model_id", help="qwen3:8b or gemma3:12b")
    p_local.add_argument("--compare-to", default=None, help="baseline summary.json or run dir")

    args = ap.parse_args()
    if args.reps < 3:
        raise SystemExit("--reps must be >= 3 for variance reporting")

    cfg = benchlib.load_config(args.config)
    roster = load_roster(cfg)
    cases = filter_cases(load_cases(args.profile, args.with_skills), args.task_types, args.limit_cases)

    if args.cmd == "baseline":
        mode = "baseline"
        subject_model_id = None
        prefix = "ollama-baseline"
        compare_summary = None
    else:
        mode = "local"
        subject_model_id = args.model_id
        if subject_model_id not in roster:
            raise SystemExit(f"unknown model id: {subject_model_id}")
        prefix = "ollama-" + benchlib.slugify(subject_model_id)
        compare_summary = load_summary(args.compare_to) if args.compare_to else None

    out_dir = benchlib.RESULTS_DIR / run_id(prefix)
    out_dir.mkdir(parents=True, exist_ok=True)

    runs, meta = execute(args, cfg, roster, cases, mode, subject_model_id, out_dir)
    summary = summarize_runs(runs, meta)
    compare_rows = compare_to_baseline(summary, compare_summary) if compare_summary else None

    with open(out_dir / "runs.json", "w") as f:
        json.dump(runs, f, indent=2)
    with open(out_dir / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    report_md = to_markdown(summary, compare_rows)
    with open(out_dir / "report.md", "w") as f:
        f.write(report_md)

    print("\n" + "=" * 60, flush=True)
    print(report_md, flush=True)
    print(f"wrote: {out_dir / 'report.md'}", flush=True)
    print(f"       {out_dir / 'summary.json'}", flush=True)
    print(f"       {out_dir / 'runs.json'}", flush=True)


if __name__ == "__main__":
    main()
