#!/usr/bin/env python3
"""
tsbc_task_probe.py — bounded repeated probes for a specific role/task subset.

Use this when TSBC needs decision-grade evidence on a weak task cluster without
running a whole role sweep or mutating the benchmark suites.
"""

import argparse
import json
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

import benchlib
import ledger
from adapters import run_model
from scoring import score_run
from variants import build_prompt, resolve_role


def now_run_id():
    return "probe-" + datetime.now().strftime("%Y%m%d-%H%M%S")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def resolve_models(cfg, only):
    roster = {m["id"]: m for m in (cfg.get("models", []) + cfg.get("models_catalog", []))}
    want = [x.strip() for x in only.split(",") if x.strip()]
    missing = [w for w in want if w not in roster]
    if missing:
        raise SystemExit(f"unknown model id(s): {', '.join(missing)}")
    models = [roster[w] for w in want]
    models, held = benchlib.filter_models_for_active_holds(models)
    if held:
        print(benchlib.format_model_hold_skip(held), flush=True)
    if not models:
        raise SystemExit("no probe models remain after active TSBC model holds")
    return models


def resolve_judge(cfg, judge_id):
    if not judge_id:
        return cfg["judge"]
    roster = {m["id"]: m for m in (cfg.get("models", []) + cfg.get("models_catalog", []))}
    row = roster.get(judge_id)
    if not row:
        raise SystemExit(f"unknown judge model id: {judge_id}")
    hold = benchlib.first_active_model_hold(row)
    if hold:
        raise SystemExit(
            "judge model is under active hold: "
            + benchlib.format_model_hold_skip([(row, hold)])
        )
    return {"id": row["id"], "adapter": row["adapter"], "model_arg": row.get("model_arg")}


def select_tasks(role, task_ids):
    suite = benchlib.load_suite(role)
    want = [x.strip() for x in task_ids.split(",") if x.strip()]
    tasks = {t["id"]: t for t in suite.get("tasks", [])}
    missing = [tid for tid in want if tid not in tasks]
    if missing:
        raise SystemExit(f"unknown task id(s) for {role}: {', '.join(missing)}")
    return [tasks[tid] for tid in want]


def power_workers(default=1):
    try:
        data = json.load(open(benchlib.ROOT / ".tsbc-power.json"))
    except Exception:
        return default
    if data.get("paused"):
        raise SystemExit("TSBC SLEEP (paused) — not running.")
    cap = data.get("maxWorkers")
    return min(default, cap) if cap is not None else default


def prompt_parts(role, agent_file, skills):
    rc = json.load(open(benchlib.ROOT / "variants.json"))["roles"].get(role)
    if not rc:
        raise SystemExit(f"role {role!r} missing from variants.json")
    af_bodies, skill_bodies = resolve_role(role, rc)
    if agent_file not in af_bodies:
        raise SystemExit(f"unknown agent-file mode {agent_file!r}")
    if skills not in skill_bodies:
        raise SystemExit(f"unknown skills mode {skills!r}")
    return af_bodies[agent_file], skill_bodies[skills]


def qpk(quality, output_tokens):
    if quality is None or not output_tokens:
        return None
    return quality / (output_tokens / 1000.0)


def mean(xs):
    vals = [x for x in xs if x is not None]
    return statistics.mean(vals) if vals else None


def median(xs):
    vals = [x for x in xs if x is not None]
    return statistics.median(vals) if vals else None


def aggregate(records):
    by = {}
    for r in records:
        by.setdefault((r["model"], r["task_id"]), []).append(r)
    rows = []
    for (model, task_id), rs in sorted(by.items()):
        qualities = [r.get("quality") for r in rs if r.get("quality") is not None]
        outputs = [r.get("outputTokens") for r in rs if r.get("outputTokens") is not None]
        inputs = [r.get("inputTokens") for r in rs if r.get("inputTokens") is not None]
        row = {
            "model": model,
            "task_id": task_id,
            "samples": len(rs),
            "okCount": sum(1 for r in rs if r.get("ok")),
            "meanQuality": mean(qualities),
            "minQuality": min(qualities) if qualities else None,
            "medianOutputTokens": median(outputs),
            "meanOutputTokens": mean(outputs),
            "meanInputTokens": mean(inputs),
            "meanQPer1kOut": mean([qpk(r.get("quality"), r.get("outputTokens")) for r in rs]),
            "runIds": [r["sample_id"] for r in rs],
        }
        rows.append(row)
    return rows


def overall_summary(rows):
    by = {}
    for row in rows:
        by.setdefault(row["model"], []).append(row)
    out = []
    for model, rs in sorted(by.items()):
        out.append({
            "model": model,
            "tasks": len(rs),
            "samples": sum(r["samples"] for r in rs),
            "okCount": sum(r["okCount"] for r in rs),
            "meanQuality": mean([r["meanQuality"] for r in rs]),
            "minQuality": min(r["minQuality"] for r in rs if r["minQuality"] is not None),
            "medianOutputTokens": median([r["medianOutputTokens"] for r in rs]),
            "meanOutputTokens": mean([r["meanOutputTokens"] for r in rs]),
            "meanInputTokens": mean([r["meanInputTokens"] for r in rs]),
            "meanQPer1kOut": mean([r["meanQPer1kOut"] for r in rs]),
        })
    return out


def write_report(out_dir, meta, per_task, overall):
    records_paths = (
        f"`{out_dir / 'report.md'}`, `{out_dir / 'records.json'}`, `{out_dir / 'summary.json'}`"
    )
    environment = (
        f"`TSBC task-probe harness; role={meta['role']}; cell={meta['agentFile']}+{meta['skills']}; "
        f"finished={meta.get('finishedAt', 'unknown')}`"
    )
    lines = [
        f"# TSBC Task Probe — `{meta['run_id']}`",
        "",
        f"- Role: `{meta['role']}`",
        f"- Cell: `{meta['agentFile']} + {meta['skills']}`",
        f"- Tasks: `{', '.join(meta['taskIds'])}`",
        f"- Models: `{', '.join(meta['models'])}`",
        f"- Reps: `{meta['reps']}`",
        f"- Judge: `{meta['judge']}`",
        "",
        "## Overall",
        "",
        "| model | tasks | samples | ok | meanQ | minQ | meanOut | meanIn | q/1k-out |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in overall:
        lines.append(
            "| {model} | {tasks} | {samples} | {okCount} | {meanQuality:.3f} | {minQuality:.3f} | "
            "{meanOutputTokens:.1f} | {meanInputTokens:.1f} | {meanQPer1kOut:.3f} |".format(**row)
        )
    lines.extend([
        "",
        "## Per Task",
        "",
        "| model | task | samples | ok | meanQ | minQ | meanOut | meanIn | q/1k-out |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for row in per_task:
        lines.append(
            "| {model} | {task_id} | {samples} | {okCount} | {meanQuality:.3f} | {minQuality:.3f} | "
            "{meanOutputTokens:.1f} | {meanInputTokens:.1f} | {meanQPer1kOut:.3f} |".format(**row)
        )
    lines.extend([
        "",
        "## TSBC Fairness Closeout (required before recommendation)",
        "",
        f"- Run IDs: `{meta['run_id']}`",
        f"- Repetitions per compared cell: `{meta['reps']}`",
        f"- Scorer lane: `{meta['judge']}`",
        "- Scorer calibration status: `pass` / `pass_with_caveat` / `needs_calibration` / `failed`",
        "- Calibration set: record the known-good / known-bad / borderline anchors, or `not_preserved:<why missing>`.",
        "- Tie-break owner: name the human or agent adjudicator, or `not_preserved:<why missing>`.",
        "- Fairness verdict: `pass` / `pass_with_caveat` / `fail`",
        "- Evidence depth: `directional` / `candidate` / `decision_grade` / `production_locked`",
        "- Low-tail / min-score note: cite the relevant `minQ` values from the tables above and explain any task-level collapse.",
        "- Token / cost / runtime note or caveat: summarize the token movement shown above and record runtime/cost or an explicit caveat if missing.",
        "- Scorer caveat: record scorer separation/calibration status and whether human review is still required.",
        "- Fingerprint: use `<opco-or-portfolio>:<task-surface>:<lane>:<suite-or-run-id>:<date>`, or `not_preserved:<why missing>`.",
        f"- Model version(s): `{', '.join(meta['models'])}`",
        "- Scorer/rubric version: record the exact rubric + judge version, or `not_preserved:<why missing>`.",
        f"- Environment: {environment}",
        f"- Records path: {records_paths}",
        "- Suite hash: record the suite/run packet hash, or `not_preserved:<why missing>`.",
        "- Prompt/system hash: record the prompt/agent/system hash, or `none` / `not_preserved:<why missing>`.",
        "- Failure-library IDs: list created/referenced IDs, or `none` with why that absence is meaningful.",
        "- Any `not_preserved:*` field must explain why the artifact is missing; blank fields are not acceptable.",
        "- Next gate: `catalog_only` / `create_candidate_pack` / `run_opco_live_proof` / `adopt` / `reject` / `rerun` / `supersede`",
        "",
        "> This probe report is evidence, not a finished TSBC closeout. Fill the checklist above in the issue or polished report before updating catalog rows or adoption recommendations.",
    ])
    (out_dir / "report.md").write_text("\n".join(lines) + "\n")


def append_probe_rows(meta, per_task):
    ts = now_iso()
    records = []
    for row in per_task:
        records.append({
            "ts": ts,
            "company": ledger._company(),
            "kind": "task_probe",
            "test_class": f"probe:{meta['role']}:{row['task_id']}:{meta['agentFile']}-{meta['skills']}",
            "model": row["model"],
            "model_class": ledger._model_class(row["model"]),
            "metrics": {
                "quality": ledger._r(row["meanQuality"]),
                "qPer1kOut": ledger._r(row["meanQPer1kOut"]),
                "minQuality": ledger._r(row["minQuality"]),
                "meanOutputTokens": ledger._r(row["meanOutputTokens"], 0),
                "meanInputTokens": ledger._r(row["meanInputTokens"], 0),
                "okRate": ledger._r((row["okCount"] / row["samples"]) if row["samples"] else 0.0),
            },
            "n_tasks": row["samples"],
            "run_id": meta["run_id"],
            "judge": meta["judge"],
            "variant": {"role": meta["role"], "agentFile": meta["agentFile"], "skills": meta["skills"]},
            "probe": {"taskIds": meta["taskIds"], "reps": meta["reps"]},
            "skill": None,
            "source": "tsbc_task_probe.py",
        })
    ledger.append_records(records)
    return len(records)


def main():
    ap = argparse.ArgumentParser(description="TSBC bounded task-cluster probe")
    ap.add_argument("--config", default=None)
    ap.add_argument("--role", required=True)
    ap.add_argument("--task-ids", required=True, help="comma list")
    ap.add_argument("--models", required=True, help="comma list")
    ap.add_argument("--reps", type=int, default=5)
    ap.add_argument("--agent-file", choices=["bare", "minimal", "current"], default="minimal")
    ap.add_argument("--skills", choices=["none", "all"], default="none")
    ap.add_argument("--judge-model", default=None, help="override config judge by model id")
    ap.add_argument("--label", default=None, help="freeform report label")
    args = ap.parse_args()

    cfg = benchlib.load_config(args.config)
    cfg["judge"] = resolve_judge(cfg, args.judge_model)
    models = resolve_models(cfg, args.models)
    tasks = select_tasks(args.role, args.task_ids)
    af_body, skills_body = prompt_parts(args.role, args.agent_file, args.skills)

    workers = power_workers(default=1)
    run_id = now_run_id()
    out_dir = benchlib.RESULTS_DIR / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "run_id": run_id,
        "label": args.label,
        "role": args.role,
        "taskIds": [t["id"] for t in tasks],
        "models": [m["id"] for m in models],
        "reps": args.reps,
        "agentFile": args.agent_file,
        "skills": args.skills,
        "judge": cfg["judge"].get("id"),
        "startedAt": now_iso(),
        "workers": workers,
    }
    print(f"=== TSBC Task Probe · {run_id} ===", flush=True)
    print(f"role   : {args.role}", flush=True)
    print(f"tasks  : {', '.join(meta['taskIds'])}", flush=True)
    print(f"models : {', '.join(meta['models'])}", flush=True)
    print(f"cell   : {args.agent_file}+{args.skills}", flush=True)
    print(f"judge  : {meta['judge']}", flush=True)
    print(f"reps   : {args.reps}", flush=True)
    print(f"power  : {workers} worker(s)", flush=True)
    print("", flush=True)

    adapters_cfg = cfg["adapters"]
    timeout = cfg["run"]["timeout_sec"]
    records = []
    total = args.reps * len(tasks) * len(models)
    idx = 0
    t0 = time.time()

    for rep in range(1, args.reps + 1):
        for task in tasks:
            prompt = build_prompt(af_body, skills_body, task["prompt"])
            for model in models:
                idx += 1
                sample_id = f"rep{rep:02d}"
                try:
                    raw = run_model(prompt, model, adapters_cfg, timeout)
                    scored = score_run(task, raw, cfg, adapters_cfg, timeout)
                except Exception as e:
                    raw = benchlib.empty_result()
                    raw["error"] = f"harness exception: {e}"
                    scored = {
                        "deterministicScore": None,
                        "deterministicDetails": [],
                        "judgeScore": None,
                        "judgeDetail": None,
                        "quality": None,
                        "qualityPer1kTokens": None,
                    }
                rec = {
                    "sample_id": sample_id,
                    "rep": rep,
                    "role": args.role,
                    "task_id": task["id"],
                    "task_title": task.get("title"),
                    "model": model["id"],
                    "lane": model["lane"],
                    "agentFile": args.agent_file,
                    "skills": args.skills,
                    "judge": cfg["judge"].get("id"),
                    "ok": raw.get("ok"),
                    "error": raw.get("error"),
                    "output": raw.get("output"),
                    "model_reported": raw.get("model"),
                    "inputTokens": raw.get("inputTokens"),
                    "outputTokens": raw.get("outputTokens"),
                    "totalTokens": raw.get("totalTokens"),
                    "tokensEstimated": raw.get("tokensEstimated"),
                    "costUsd": raw.get("costUsd"),
                    "wallMs": raw.get("wallMs"),
                    "stderrTail": raw.get("stderrTail"),
                }
                rec.update(scored)
                raw_path = raw_dir / f"{args.role}__{task['id']}__{model['id']}__{sample_id}.json"
                raw_path.write_text(json.dumps(rec, indent=2))
                records.append(rec)
                q = rec.get("quality")
                qtxt = f"{q:.3f}" if isinstance(q, (int, float)) else "—"
                print(
                    f"[{idx:>2}/{total}] {model['id']:<12} {task['id']:<26} {sample_id} "
                    f"ok={str(bool(rec.get('ok'))):<5} q={qtxt:<5} out={rec.get('outputTokens') or '?':>4}",
                    flush=True,
                )

    per_task = aggregate(records)
    overall = overall_summary(per_task)
    meta["finishedAt"] = now_iso()
    meta["elapsedSec"] = round(time.time() - t0, 1)

    (out_dir / "records.json").write_text(json.dumps(records, indent=2))
    (out_dir / "per_task.json").write_text(json.dumps(per_task, indent=2))
    (out_dir / "summary.json").write_text(json.dumps({"meta": meta, "overall": overall}, indent=2))
    write_report(out_dir, meta, per_task, overall)
    n_ledger = append_probe_rows(meta, per_task)

    print("\n" + "=" * 60, flush=True)
    for row in overall:
        print(
            f"{row['model']}: meanQ={row['meanQuality']:.3f} minQ={row['minQuality']:.3f} "
            f"ok={row['okCount']}/{row['samples']} meanOut={row['meanOutputTokens']:.1f}",
            flush=True,
        )
    print(f"wrote {out_dir}/report.md", flush=True)
    print(f"recorded {n_ledger} probe rows to {ledger.LEDGER_PATH}", flush=True)


if __name__ == "__main__":
    main()
