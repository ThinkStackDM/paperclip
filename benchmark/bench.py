#!/usr/bin/env python3
"""
bench.py — Paperclip model benchmark (#15) orchestrator.

  python3 bench.py all                 # run every role/task/model, score, report
  python3 bench.py all --roles intake  # just one role
  python3 bench.py all --models grok-4.3,grok-4.20
  python3 bench.py all --max-tasks-per-role 1   # smoke: 1 task/role
  python3 bench.py all --dry-run       # print the plan + cost estimate, run nothing
  python3 bench.py report <run-id>     # re-render report from a finished run's runs.json
  python3 bench.py list                # list role suites + task counts

Each (role,task,model) cell = one model CLI call; judged tasks add one judge call
per cell. Cells run concurrently (config.run.max_workers). Raw + scored records
land in results/<run-id>/. A clean abort leaves partial results scored.
"""

import argparse
import concurrent.futures as futures
import json
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import benchlib
import report as report_mod
from adapters import run_model
from scoring import score_run

PRINT_LOCK = threading.Lock()


def log(msg):
    with PRINT_LOCK:
        print(msg, flush=True)


def run_id_now():
    return "run-" + datetime.now().strftime("%Y%m%d-%H%M%S")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def select_models(cfg, only):
    if not only:
        return cfg["models"]
    # resolve --models against the active lineup AND the staged variant catalog
    roster = {m["id"]: m for m in (cfg.get("models", []) + cfg.get("models_catalog", []))}
    want = [x.strip() for x in only.split(",") if x.strip()]
    sel = [roster[w] for w in want if w in roster]
    missing = [w for w in want if w not in roster]
    if missing:
        sys.exit(f"unknown model id(s): {', '.join(missing)}  "
                 f"(known: {', '.join(sorted(roster))})")
    return sel


def select_roles(cfg, only):
    # Agentic roles (e.g. "paperclip") run real agents against live fixture issues,
    # so they are OPT-IN: never part of a default `all` sweep, only when requested
    # explicitly via --roles.
    valid = list(cfg["roles"]) + list(cfg.get("agentic_roles", []))
    if not only:
        return cfg["roles"]
    want = [x.strip() for x in only.split(",") if x.strip()]
    for r in want:
        if r not in valid:
            sys.exit(f"unknown role: {r}")
    return want


def build_cells(suites, roles, models, max_tasks):
    cells = []
    for role in roles:
        tasks = suites[role].get("tasks", [])
        if max_tasks:
            tasks = tasks[:max_tasks]
        for task in tasks:
            judged = bool((task.get("rubric", {}).get("judge", {}) or {}).get("criteria"))
            for m in models:
                cells.append({"role": role, "task": task, "model": m, "judged": judged})
    return cells


def plan_summary(cells, models, judge_id):
    gen_calls = len(cells)
    judge_calls = sum(1 for c in cells if c["judged"])
    by_lane = {}
    for c in cells:
        by_lane[c["model"]["id"]] = by_lane.get(c["model"]["id"], 0) + 1
    lines = [
        f"  generations : {gen_calls} model calls",
        f"  judge calls : {judge_calls} (all via judge={judge_id})",
        f"  total CLI    : {gen_calls + judge_calls} invocations",
        "  per-model generations: " + ", ".join(f"{k}={v}" for k, v in sorted(by_lane.items())),
    ]
    return "\n".join(lines)


def execute(cells, cfg, run_dir):
    raw_dir = run_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    adapters_cfg = cfg["adapters"]
    # Agentic cells are heavy LIVE runs against the shared server; use the lower
    # paperclip-lane concurrency + higher per-cell timeout when any are present.
    pc = cfg.get("paperclip", {}) or {}
    has_agentic = any(c["role"] in set(cfg.get("agentic_roles", [])) for c in cells)
    if has_agentic:
        timeout = pc.get("cellTimeoutSec", cfg["run"]["timeout_sec"])
        workers = pc.get("maxWorkers", cfg["run"].get("max_workers", 4))
        # self-heal: clear any orphan fixtures a prior killed run left behind so
        # they never accumulate / strand board-action cards in the live company.
        try:
            import paperclip_lane
            swept = paperclip_lane.sweep_bench_fixtures(cfg)
            if swept:
                print(f"  pre-run sweep: cancelled {swept} orphan bench fixture(s)", flush=True)
        except Exception as e:
            print(f"  pre-run sweep skipped: {e}", flush=True)
    else:
        timeout = cfg["run"]["timeout_sec"]
        workers = cfg["run"].get("max_workers", 4)
    total = len(cells)
    done = [0]
    runs = []
    runs_lock = threading.Lock()

    def work(cell):
        role, task, m = cell["role"], cell["task"], cell["model"]
        tag = f"{role}/{task['id']} @ {m['id']}"
        try:
            if role in cfg.get("agentic_roles", []):
                import paperclip_lane
                raw = paperclip_lane.run_case(task, m, cfg, timeout)
            else:
                raw = run_model(task["prompt"], m, adapters_cfg, timeout)
            scored = score_run(task, raw, cfg, adapters_cfg, timeout)
        except Exception as e:  # never let one cell kill the sweep
            raw = benchlib.empty_result()
            raw["error"] = f"harness exception: {e}"
            scored = {"quality": None, "qualityPer1kTokens": None,
                      "deterministicScore": None, "judgeScore": None}
        rec = {
            "role": role, "task_id": task["id"], "task_title": task.get("title"),
            "model_id": m["id"], "model_label": m["label"], "lane": m["lane"],
            "ok": raw.get("ok"), "error": raw.get("error"),
            "output": raw.get("output"),
            "model_reported": raw.get("model"),
            "inputTokens": raw.get("inputTokens"), "outputTokens": raw.get("outputTokens"),
            "totalTokens": raw.get("totalTokens"), "tokensEstimated": raw.get("tokensEstimated"),
            "costUsd": raw.get("costUsd"), "wallMs": raw.get("wallMs"),
            "stderrTail": raw.get("stderrTail"),
        }
        rec.update(scored)
        # persist per-cell raw
        fname = f"{benchlib.slugify(role)}__{benchlib.slugify(task['id'])}__{benchlib.slugify(m['id'])}.json"
        with open(raw_dir / fname, "w") as f:
            json.dump(rec, f, indent=2)
        with runs_lock:
            runs.append(rec)
        with PRINT_LOCK:
            done[0] += 1
            q = rec.get("quality")
            qs = f"q={q:.2f}" if isinstance(q, (int, float)) else "q=  — "
            status = "ok " if rec["ok"] else "FAIL"
            tok = rec.get("totalTokens")
            toks = f"{tok}t" if tok else "?t"
            print(f"  [{done[0]:>3}/{total}] {status} {qs} {toks:>8} {rec.get('wallMs') or '?'}ms  {tag}"
                  + (f"  !! {rec['error']}" if rec.get("error") else ""), flush=True)
        return rec

    with futures.ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(work, cells))
    return runs


def finalize(runs, cfg, run_dir, run_id, started):
    runs.sort(key=lambda r: (r["role"], r["task_id"], r["model_id"]))
    with open(run_dir / "runs.json", "w") as f:
        json.dump(runs, f, indent=2)

    rep = report_mod.aggregate(runs, cfg)
    meta = {"finished_at": now_iso(), "started_at": started,
            "n_runs": len(runs), "n_fail": sum(1 for r in runs if not r["ok"]),
            "run_id": run_id}
    rep["meta"] = meta
    with open(run_dir / "recommendations.json", "w") as f:
        json.dump(rep, f, indent=2)
    md = report_mod.to_markdown(rep, run_id, meta)
    with open(run_dir / "report.md", "w") as f:
        f.write(md)
    return rep, md, meta


def cmd_all(args, cfg):
    roles = select_roles(cfg, args.roles)
    models = select_models(cfg, args.models)
    suites = benchlib.load_all_suites(roles)
    cells = build_cells(suites, roles, models, args.max_tasks_per_role)

    run_id = run_id_now()
    log(f"=== Paperclip Model Benchmark · {run_id} ===")
    log(f"roles  : {', '.join(roles)}")
    log(f"models : {', '.join(m['id'] for m in models)}")
    log(f"judge  : {cfg['judge'].get('id')}")
    log("plan:\n" + plan_summary(cells, models, cfg["judge"].get("id")))
    if args.dry_run:
        log("\n(dry run — nothing executed)")
        return
    log(f"\nrunning {len(cells)} cells with {cfg['run'].get('max_workers',4)} workers "
        f"(timeout {cfg['run']['timeout_sec']}s each)…\n")

    started = now_iso()
    run_dir = benchlib.RESULTS_DIR / run_id
    t0 = time.time()
    try:
        runs = execute(cells, cfg, run_dir)
    except KeyboardInterrupt:
        log("\n!! interrupted — finalizing partial results")
        runs = _load_partial(run_dir)
    rep, md, meta = finalize(runs, cfg, run_dir, run_id, started)

    log("\n" + "=" * 60)
    log(md)
    log(f"wrote: {run_dir}/report.md")
    log(f"       {run_dir}/recommendations.json   (machine-readable, for tiering #9)")
    _record_to_ledger(run_id, "bench")
    log(f"elapsed {time.time()-t0:.0f}s, {meta['n_fail']}/{meta['n_runs']} failed")


def _record_to_ledger(run_id, kind):
    """Auto-append this run's findings to the shared cross-company ledger."""
    try:
        import ledger
        n, total = (ledger.record_skill_run(run_id) if kind == "skill"
                    else ledger.record_bench_run(run_id))
        log(f"       recorded {total} result(s) to shared ledger ({ledger._company()})")
    except Exception as e:
        log(f"       (ledger record skipped: {e})")


def _load_partial(run_dir):
    raw_dir = run_dir / "raw"
    runs = []
    if raw_dir.exists():
        for p in raw_dir.glob("*.json"):
            try:
                runs.append(json.load(open(p)))
            except Exception:
                pass
    return runs


def cmd_report(args, cfg):
    run_dir = benchlib.RESULTS_DIR / args.run_id
    runs_path = run_dir / "runs.json"
    if not runs_path.exists():
        sys.exit(f"no runs.json at {runs_path}")
    runs = json.load(open(runs_path))
    rep, md, meta = finalize(runs, cfg, run_dir, args.run_id, now_iso())
    log(md)
    log(f"re-wrote {run_dir}/report.md")


def cmd_list(args, cfg):
    for role in cfg["roles"]:
        try:
            suite = benchlib.load_suite(role)
        except FileNotFoundError:
            log(f"{role:<10} (no suite.json)")
            continue
        tasks = suite.get("tasks", [])
        judged = sum(1 for t in tasks if (t.get("rubric", {}).get("judge", {}) or {}).get("criteria"))
        log(f"{role:<10} {len(tasks)} tasks ({judged} judged, {len(tasks)-judged} deterministic-only)")
        for t in tasks:
            log(f"   - {t['id']:<26} {t.get('title','')}")


def main():
    ap = argparse.ArgumentParser(description="Paperclip model benchmark (#15)")
    ap.add_argument("--config", default=None)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_all = sub.add_parser("all", help="run + score + report")
    p_all.add_argument("--roles", default=None, help="comma list (default: all)")
    p_all.add_argument("--models", default=None, help="comma list of model ids (default: all)")
    p_all.add_argument("--max-tasks-per-role", type=int, default=None, dest="max_tasks_per_role")
    p_all.add_argument("--dry-run", action="store_true")

    p_rep = sub.add_parser("report", help="re-render report from a finished run")
    p_rep.add_argument("run_id")

    sub.add_parser("list", help="list role suites")

    args = ap.parse_args()
    cfg = benchlib.load_config(args.config)

    if args.cmd == "all":
        cmd_all(args, cfg)
    elif args.cmd == "report":
        cmd_report(args, cfg)
    elif args.cmd == "list":
        cmd_list(args, cfg)


if __name__ == "__main__":
    main()
