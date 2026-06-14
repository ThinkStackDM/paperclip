#!/usr/bin/env python3
"""
ledger.py — the shared benchmark source of truth across all 7 companies.

Every company that runs a model or skill benchmark APPENDS its findings here, so
others can reference them instead of re-benchmarking. The decision rule (davin,
2026-06-14):

  TRUST RULE: for a given (test_class, model), if there are >= 3 results in the last
  30 days -> TRUST the pooled result (return the aggregate). If fewer -> BENCHMARK
  YOURSELF, trust your own output, and RECORD it so the next company can trust the pool.

Storage: ledger/results.jsonl — append-only JSON-lines, one record per (model x test_class)
outcome. Concurrent appends from multiple companies are serialized with an flock.
Skill results carry a link to the skill file so any company can run the same test.

Commands:
  python3 ledger.py record --run <run-id>          # ingest a bench OR skill run dir
  python3 ledger.py query <test_class> <model>     # the TRUST decision + aggregate
  python3 ledger.py summary [--days 30]            # coverage: who has what, trust status
  python3 ledger.py skills                         # skills referenced + links to run them

test_class is a role (engineer/designer/content/intake/ops) for model evals, or
"skill:<pair-id>" for skill evals.
"""

import argparse
import fcntl
import glob
import json
import os
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

import benchlib

LEDGER_DIR = benchlib.ROOT / "ledger"
LEDGER_PATH = LEDGER_DIR / "results.jsonl"
DEFAULT_DAYS = 30
DEFAULT_MIN_RESULTS = 3


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _company():
    return os.environ.get("PAPERCLIP_COMPANY", "TSMC")


def _model_class(model_id):
    m = model_id.lower()
    for fam in ("claude", "codex", "gpt", "gemini", "grok"):
        if fam in m:
            return "gpt" if fam == "codex" else fam
    return model_id


# --------------------------------------------------------------------------
# append (flock-guarded so 7 companies can write concurrently)
# --------------------------------------------------------------------------

def append_records(records):
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)
    with open(LEDGER_PATH, "a") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            for r in records:
                f.write(json.dumps(r, separators=(",", ":")) + "\n")
            f.flush()
            os.fsync(f.fileno())
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)
    return len(records)


def read_all():
    if not LEDGER_PATH.exists():
        return []
    out = []
    with open(LEDGER_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


# --------------------------------------------------------------------------
# recording from run dirs
# --------------------------------------------------------------------------

def record_bench_run(run_id, company=None):
    """Ingest a #15 model-eval run's recommendations.json -> one record per (role, model)."""
    company = company or _company()
    rec_path = benchlib.RESULTS_DIR / run_id / "recommendations.json"
    if not rec_path.exists():
        raise FileNotFoundError(f"no recommendations.json for {run_id}")
    rep = json.load(open(rec_path))
    judge = rep.get("judge")
    ts = (rep.get("meta") or {}).get("finished_at") or _now_iso()
    out = []
    for role, rd in rep.get("roles", {}).items():
        for model_id, s in rd.get("models", {}).items():
            if s.get("meanQuality") is None:
                continue
            out.append({
                "ts": ts, "company": company, "kind": "model_eval",
                "test_class": role, "model": model_id, "model_class": _model_class(model_id),
                "metrics": {
                    "quality": _r(s.get("meanQuality")),
                    "qPer1kOut": _r(s.get("meanQualityPer1kOutput")),
                    "meanOutputTokens": _r(s.get("meanOutputTokens"), 0),
                    "meanInputTokens": _r(s.get("meanInputTokens"), 0),
                },
                "n_tasks": s.get("tasks"), "run_id": run_id, "judge": judge,
                "skill": None, "source": "bench.py",
            })
    return append_records(out), len(out)


def record_skill_run(run_id, company=None):
    """Ingest a #16 skill-eval run's summary.json/records.json -> one record per (pair, model)."""
    company = company or _company()
    run_dir = benchlib.RESULTS_DIR / run_id
    summ = json.load(open(run_dir / "summary.json"))
    recs = json.load(open(run_dir / "records.json")) if (run_dir / "records.json").exists() else []
    # map pair -> skill file from pairs.json
    pairs_meta = {}
    pj = benchlib.ROOT / "skillbench" / "pairs.json"
    if pj.exists():
        for p in json.load(open(pj)).get("pairs", []):
            pairs_meta[p["id"]] = p.get("skill")
    ts = _now_iso()
    out = []
    for key, s in summ.get("perPairModel", {}).items():
        pair, model_id = s["pair"], s["model"]
        out.append({
            "ts": ts, "company": company, "kind": "skill_eval",
            "test_class": f"skill:{pair}", "model": model_id, "model_class": _model_class(model_id),
            "metrics": {
                "lift": _r(s.get("meanLift")),
                "baselineQuality": _r(s.get("meanBaseline")),
                "treatmentQuality": _r(s.get("meanTreatment")),
                "skillExtraInputTokens": _r(s.get("meanExtraTokens"), 0),
            },
            "n_tasks": s.get("n"), "run_id": run_id, "judge": summ.get("judge") or "claude-opus",
            "skill": {"id": pair, "path": pairs_meta.get(pair),
                      "verdict": (summ.get("verdicts", {}).get(pair, {}) or {}).get("verdict")},
            "source": "skillbench.py",
        })
    return append_records(out), len(out)


def _r(x, default=None):
    if x is None:
        return default
    return round(float(x), 4)


# --------------------------------------------------------------------------
# the TRUST decision
# --------------------------------------------------------------------------

def query(test_class, model, days=DEFAULT_DAYS, min_results=DEFAULT_MIN_RESULTS):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    hits = []
    for r in read_all():
        if r.get("test_class") != test_class or r.get("model") != model:
            continue
        ts = _parse(r.get("ts"))
        if ts is None or ts < cutoff:
            continue
        hits.append(r)
    n = len(hits)
    trust = n >= min_results
    result = {
        "test_class": test_class, "model": model, "windowDays": days,
        "nResults": n, "minResults": min_results,
        "decision": "TRUST" if trust else "BENCHMARK_YOURSELF",
        "companies": sorted({h.get("company") for h in hits}),
    }
    if hits:
        kind = hits[0].get("kind")
        result["kind"] = kind
        if kind == "skill_eval":
            result["aggregate"] = _agg(hits, "lift")
            result["aggregate"].update({"verdict_pool": _verdict_pool(hits)})
        else:
            result["aggregate"] = _agg(hits, "quality")
            qpks = [h["metrics"].get("qPer1kOut") for h in hits if h["metrics"].get("qPer1kOut") is not None]
            result["aggregate"]["medianQPer1kOut"] = round(statistics.median(qpks), 4) if qpks else None
        result["latest"] = max(h["ts"] for h in hits)
    if not trust:
        result["action"] = (f"Only {n} result(s) in {days}d (need {min_results}). "
                            f"Run the benchmark yourself, trust your output, and record it: "
                            f"`ledger.py record --run <your-run>`.")
    return result


def _agg(hits, metric_key):
    vals = [h["metrics"].get(metric_key) for h in hits if h["metrics"].get(metric_key) is not None]
    if not vals:
        return {"n": len(hits)}
    return {
        "n": len(vals),
        f"median_{metric_key}": round(statistics.median(vals), 4),
        f"mean_{metric_key}": round(statistics.mean(vals), 4),
        f"stdev_{metric_key}": round(statistics.pstdev(vals), 4) if len(vals) > 1 else 0.0,
        f"min_{metric_key}": round(min(vals), 4), f"max_{metric_key}": round(max(vals), 4),
    }


def _verdict_pool(hits):
    v = [(h.get("skill") or {}).get("verdict") for h in hits]
    v = [x for x in v if x]
    if not v:
        return None
    return max(set(v), key=v.count)  # modal verdict


def _parse(ts):
    if not ts:
        return None
    try:
        d = datetime.fromisoformat(ts)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# summary / skills
# --------------------------------------------------------------------------

def summary(days=DEFAULT_DAYS, min_results=DEFAULT_MIN_RESULTS):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    by = {}
    for r in read_all():
        ts = _parse(r.get("ts"))
        if ts is None or ts < cutoff:
            continue
        by.setdefault((r.get("test_class"), r.get("model")), []).append(r)
    rows = []
    for (tc, model), hits in sorted(by.items()):
        n = len(hits)
        kind = hits[0].get("kind")
        mkey = "lift" if kind == "skill_eval" else "quality"
        vals = [h["metrics"].get(mkey) for h in hits if h["metrics"].get(mkey) is not None]
        med = round(statistics.median(vals), 3) if vals else None
        rows.append({"test_class": tc, "model": model, "n": n,
                     "decision": "TRUST" if n >= min_results else "self",
                     "metric": mkey, "median": med,
                     "companies": len({h.get("company") for h in hits})})
    return rows


def skills_index():
    seen = {}
    for r in read_all():
        sk = r.get("skill")
        if not sk:
            continue
        sid = sk.get("id")
        seen.setdefault(sid, {"id": sid, "path": sk.get("path"), "results": 0, "verdicts": []})
        seen[sid]["results"] += 1
        if sk.get("verdict"):
            seen[sid]["verdicts"].append(sk["verdict"])
    return list(seen.values())


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="shared benchmark ledger (source of truth)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("record"); pr.add_argument("--run", required=True)
    pr.add_argument("--company", default=None); pr.add_argument("--kind", choices=["bench", "skill", "auto"], default="auto")
    pq = sub.add_parser("query"); pq.add_argument("test_class"); pq.add_argument("model")
    pq.add_argument("--days", type=int, default=DEFAULT_DAYS); pq.add_argument("--min", type=int, default=DEFAULT_MIN_RESULTS, dest="min_results")
    ps = sub.add_parser("summary"); ps.add_argument("--days", type=int, default=DEFAULT_DAYS)
    sub.add_parser("skills")
    args = ap.parse_args()

    if args.cmd == "record":
        kind = args.kind
        if kind == "auto":
            rd = benchlib.RESULTS_DIR / args.run
            kind = "skill" if (rd / "summary.json").exists() and args.run.startswith("skill-") else "bench"
        if kind == "skill":
            n_appended, n = record_skill_run(args.run, args.company)
        else:
            n_appended, n = record_bench_run(args.run, args.company)
        print(f"recorded {n} result(s) from {args.run} into the ledger ({_company() if not args.company else args.company})")

    elif args.cmd == "query":
        res = query(args.test_class, args.model, args.days, args.min_results)
        print(json.dumps(res, indent=2))
        print(f"\n>>> {res['decision']}: {res['nResults']}/{res['minResults']} results in {res['windowDays']}d", end="")
        if res["decision"] == "TRUST":
            agg = res.get("aggregate", {})
            print(f" — trust pooled result (median {list(agg.items())})")
        else:
            print(f"\n    {res.get('action','')}")

    elif args.cmd == "summary":
        rows = summary(args.days)
        if not rows:
            print("(ledger empty)"); return
        print(f"{'test_class':<22} {'model':<16} {'n':>3} {'cos':>3} {'metric':<8} {'median':>7}  decision")
        print("-" * 78)
        for r in rows:
            print(f"{r['test_class']:<22} {r['model']:<16} {r['n']:>3} {r['companies']:>3} "
                  f"{r['metric']:<8} {str(r['median']):>7}  {r['decision']}")

    elif args.cmd == "skills":
        for s in skills_index():
            from collections import Counter
            v = Counter(s["verdicts"]).most_common(1)
            print(f"{s['id']:<22} results={s['results']:>3}  verdict={v[0][0] if v else '-':<8}  skill={s['path']}")


if __name__ == "__main__":
    main()
