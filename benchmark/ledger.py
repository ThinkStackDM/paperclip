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
_BENCH_METADATA_KINDS = {"model_eval", "config_variant", "agentic_config_variant", "task_probe"}


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _company():
    return os.environ.get("PAPERCLIP_COMPANY", "TSBC")


def _model_class(model_id):
    m = model_id.lower()
    for fam in ("claude", "codex", "gpt", "gemini", "grok"):
        if fam in m:
            return "gpt" if fam == "codex" else fam
    return model_id


def _mean(values):
    values = [value for value in values if value is not None]
    return statistics.mean(values) if values else None


def _suite_path_for_role(role):
    return benchlib.ROOT / role / "suite.json"


def _suite_hash_for_role(role):
    return benchlib.file_sha256(_suite_path_for_role(role))


def _catalog_by_model_id():
    cfg = benchlib.load_config()
    return {m["id"]: m for m in (cfg.get("models", []) + cfg.get("models_catalog", []))}


_VARIANT_HASH_CACHE = {}


def _variant_hash_fallbacks(role, agent_file, skills):
    key = (role, agent_file, skills)
    cached = _VARIANT_HASH_CACHE.get(key)
    if cached is not None:
        return cached
    variants_cfg = json.load(open(benchlib.ROOT / "variants.json")).get("roles", {})
    rc = variants_cfg.get(role)
    if not rc:
        result = {"agent_file_sha256": "none", "skills_bundle_sha256": "none"}
        _VARIANT_HASH_CACHE[key] = result
        return result
    import variants

    af_bodies, skill_bodies = variants.resolve_role(role, rc)
    agent_body = af_bodies.get(agent_file, "")
    skills_body = skill_bodies.get(skills, "")
    result = {
        "agent_file_sha256": benchlib.sha256_text(agent_body) if agent_body else "none",
        "skills_bundle_sha256": benchlib.sha256_text(skills_body) if skills_body else "none",
    }
    _VARIANT_HASH_CACHE[key] = result
    return result


def _single_record_value(records, keys, label, fallback=None):
    values = sorted({
        str(record.get(key)).strip()
        for record in records
        for key in keys
        if str(record.get(key) or "").strip()
    })
    if len(values) > 1:
        raise ValueError(f"{label} mismatch across aggregated records: {values}")
    if values:
        return values[0]
    if fallback is not None:
        return fallback
    raise ValueError(f"missing {label}")


def _reported_model_fields(records, model_id):
    values = sorted({
        str(record.get("model_reported")).strip()
        for record in records
        if str(record.get("model_reported") or "").strip()
    })
    if not values:
        return {"model_reported": model_id, "reported_models": [model_id]}
    return {
        "model_reported": values[0] if len(values) == 1 else "multiple:" + ",".join(values),
        "reported_models": values,
    }


def _is_missing_metadata_value(value):
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def _validate_bench_metadata(record):
    required = ("model_reported", "adapter_type", "effort", "skills_bundle_sha256", "suite_sha256")
    missing = [field for field in required if _is_missing_metadata_value(record.get(field))]
    if missing:
        raise ValueError(
            f"bench ledger row missing reproducibility metadata for {record.get('kind')} "
            f"{record.get('test_class')} {record.get('model')}: {', '.join(missing)}"
        )


# --------------------------------------------------------------------------
# append (flock-guarded so 7 companies can write concurrently)
# --------------------------------------------------------------------------

def append_records(records):
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)
    with open(LEDGER_PATH, "a") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            for r in records:
                if r.get("kind") in _BENCH_METADATA_KINDS:
                    _validate_bench_metadata(r)
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
    """Ingest a #15 model-eval run's runs.json -> one record per (role, model)."""
    company = company or _company()
    run_dir = benchlib.RESULTS_DIR / run_id
    runs_path = run_dir / "runs.json"
    if not runs_path.exists():
        raise FileNotFoundError(f"no runs.json for {run_id}")
    rep_path = run_dir / "recommendations.json"
    rep = json.load(open(rep_path)) if rep_path.exists() else {}
    runs = json.load(open(runs_path))
    judge = rep.get("judge")
    ts = (rep.get("meta") or {}).get("finished_at") or _now_iso()
    roster = _catalog_by_model_id()
    out = []
    grouped = {}
    for record in runs:
        grouped.setdefault((record["role"], record["model_id"]), []).append(record)
    for (role, model_id), records in sorted(grouped.items()):
        considered = [record for record in records if not record.get("skipped")]
        ran = [record for record in considered if record.get("ok") and record.get("quality") is not None]
        if not ran:
            continue
        model_row = roster.get(model_id, {"id": model_id})
        metadata_records = considered or records
        reported_fields = _reported_model_fields(metadata_records, model_id)
        out.append({
            "ts": ts,
            "company": company,
            "kind": "model_eval",
            "test_class": role,
            "model": model_id,
            **reported_fields,
            "model_class": _model_class(model_id),
            "adapter_type": _single_record_value(
                metadata_records,
                ("adapterType", "adapter_type"),
                "adapter_type",
                fallback=str(model_row.get("adapter") or "").strip() or None,
            ),
            "effort": _single_record_value(
                metadata_records,
                ("effort",),
                "effort",
                fallback=benchlib.model_effort_label(model_row),
            ),
            "agent_file_sha256": _single_record_value(
                metadata_records,
                ("agentFileSha256", "agent_file_sha256"),
                "agent_file_sha256",
                fallback="none",
            ),
            "skills_bundle_sha256": _single_record_value(
                metadata_records,
                ("skillsBundleSha256", "skills_bundle_sha256"),
                "skills_bundle_sha256",
                fallback="none",
            ),
            "suite_sha256": _single_record_value(
                metadata_records,
                ("suiteSha256", "suite_sha256"),
                "suite_sha256",
                fallback=_suite_hash_for_role(role),
            ),
            "metrics": {
                "quality": _r(_mean([record.get("quality") for record in ran])),
                "qPer1kOut": _r(_mean([
                    (record.get("quality") / (record.get("outputTokens") / 1000.0))
                    for record in ran
                    if record.get("quality") is not None and record.get("outputTokens")
                ])),
                "meanOutputTokens": _r(_mean([record.get("outputTokens") for record in ran]), 0),
                "meanInputTokens": _r(_mean([record.get("inputTokens") for record in ran]), 0),
                "successRate": _r((len(ran) / len(considered)) if considered else 0.0),
            },
            "n_tasks": len(considered),
            "run_id": run_id,
            "judge": judge,
            "skill": None,
            "source": "bench.py",
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


def record_variants_run(run_id, company=None):
    """Ingest a #17 config-variant run's records.json -> one record per (role, model, agent_file, skills) cell.
    Namespaced test_class 'variant:<role>:<af>-<skills>' so these never pollute the bare base-model
    leaderboard (test_class=<role>). The base matrix already supplies bare:none (the floor); this layer
    captures the agent-file / skills configs on top, so the drill can fill the with-skills decision grid."""
    company = company or _company()
    run_dir = benchlib.RESULTS_DIR / run_id
    records_path = run_dir / "records.json"
    if not records_path.exists():
        raise FileNotFoundError(f"no records.json for {run_id}")
    records = json.load(open(records_path))
    ts = _now_iso()
    roster = _catalog_by_model_id()
    out = []
    grouped = {}
    for record in records:
        grouped.setdefault((record["role"], record["model"], record["agentFile"], record["skills"]), []).append(record)
    for (role, model_id, af, skills), cell_records in sorted(grouped.items()):
        valid = [record for record in cell_records if record.get("ok") and record.get("quality") is not None]
        if not valid:
            continue
        model_row = roster.get(model_id, {"id": model_id})
        hash_fallbacks = _variant_hash_fallbacks(role, af, skills)
        reported_fields = _reported_model_fields(cell_records, model_id)
        out.append({
            "ts": ts, "company": company, "kind": "config_variant",
            "test_class": f"variant:{role}:{af}-{skills}", "model": model_id,
            **reported_fields,
            "model_class": _model_class(model_id),
            "adapter_type": _single_record_value(
                cell_records,
                ("adapterType", "adapter_type"),
                "adapter_type",
                fallback=str(model_row.get("adapter") or "").strip() or None,
            ),
            "effort": _single_record_value(
                cell_records,
                ("effort",),
                "effort",
                fallback=benchlib.model_effort_label(model_row),
            ),
            "agent_file_sha256": _single_record_value(
                cell_records,
                ("agentFileSha256", "agent_file_sha256"),
                "agent_file_sha256",
                fallback=hash_fallbacks["agent_file_sha256"],
            ),
            "skills_bundle_sha256": _single_record_value(
                cell_records,
                ("skillsBundleSha256", "skills_bundle_sha256"),
                "skills_bundle_sha256",
                fallback=hash_fallbacks["skills_bundle_sha256"],
            ),
            "suite_sha256": _single_record_value(
                cell_records,
                ("suiteSha256", "suite_sha256"),
                "suite_sha256",
                fallback=_suite_hash_for_role(role),
            ),
            "metrics": {
                "quality": _r(_mean([record.get("quality") for record in valid])),
                "qPer1kOut": _r(_mean([record.get("qPer1kOut") for record in valid])),
                "meanOutputTokens": _r(_mean([record.get("outputTokens") for record in valid]), 0),
            },
            "n_tasks": len(valid), "run_id": run_id, "judge": None,
            "variant": {"role": role, "agentFile": af, "skills": skills},
            "skill": None, "source": "variants.py",
        })
    return append_records(out), len(out)


def record_agentic_variants_run(run_id, company=None):
    """Ingest a variants_agentic.py run's records.json -> one record per (role, model, af, skills) cell,
    namespaced test_class 'agentic-variant:<role>:<af>-<skills>'. This is the AGENTIC frame for lanes
    (gemini/antigravity) that cannot answer the single-shot ~65k concatenated-skills prompt: skills are
    mounted as files and the agent reads them on demand (mirrors the live antigravity_local adapter).
    Kept in its OWN namespace so it never mixes with the single-shot 'variant:' cells or the bare
    leaderboard — single-shot vs agentic are different methodologies and must be compared separately."""
    company = company or _company()
    run_dir = benchlib.RESULTS_DIR / run_id
    records_path = run_dir / "records.json"
    if not records_path.exists():
        raise FileNotFoundError(f"no records.json for {run_id}")
    records = json.load(open(records_path))
    ts = _now_iso()
    roster = _catalog_by_model_id()
    out = []
    grouped = {}
    for record in records:
        grouped.setdefault((record["role"], record["model"], record["agentFile"], record["skills"]), []).append(record)
    for (role, model_id, af, skills), cell_records in sorted(grouped.items()):
        valid = [record for record in cell_records if record.get("ok") and record.get("quality") is not None]
        if not valid:
            continue
        model_row = roster.get(model_id, {"id": model_id})
        hash_fallbacks = _variant_hash_fallbacks(role, af, skills)
        reported_fields = _reported_model_fields(cell_records, model_id)
        out.append({
            "ts": ts, "company": company, "kind": "agentic_config_variant",
            "test_class": f"agentic-variant:{role}:{af}-{skills}", "model": model_id,
            **reported_fields,
            "model_class": _model_class(model_id),
            "adapter_type": _single_record_value(
                cell_records,
                ("adapterType", "adapter_type"),
                "adapter_type",
                fallback=str(model_row.get("adapter") or "").strip() or None,
            ),
            "effort": _single_record_value(
                cell_records,
                ("effort",),
                "effort",
                fallback=benchlib.model_effort_label(model_row),
            ),
            "agent_file_sha256": _single_record_value(
                cell_records,
                ("agentFileSha256", "agent_file_sha256"),
                "agent_file_sha256",
                fallback=hash_fallbacks["agent_file_sha256"],
            ),
            "skills_bundle_sha256": _single_record_value(
                cell_records,
                ("skillsBundleSha256", "skills_bundle_sha256"),
                "skills_bundle_sha256",
                fallback=hash_fallbacks["skills_bundle_sha256"],
            ),
            "suite_sha256": _single_record_value(
                cell_records,
                ("suiteSha256", "suite_sha256"),
                "suite_sha256",
                fallback=_suite_hash_for_role(role),
            ),
            "metrics": {
                "quality": _r(_mean([record.get("quality") for record in valid])),
                "qPer1kOut": _r(_mean([record.get("qPer1kOut") for record in valid])),
                "meanOutputTokens": _r(_mean([record.get("outputTokens") for record in valid]), 0),
            },
            "n_tasks": len(valid), "run_id": run_id, "judge": None,
            "variant": {"role": role, "agentFile": af, "skills": skills},
            "frame": "agentic", "skill": None, "source": "variants_agentic.py",
        })
    return append_records(out), len(out)


def record_team_run(run_id, company=None):
    """Ingest a team_bench.py run's cells.json -> one record per (test_class) cell, namespaced
    'team:<domain>:<mode>' (single-<model> | team<N>-<workers>). This is workstream-D: does a TEAM
    of fast agents splitting a long-form draft beat ONE drafter? Kept in its OWN namespace so it
    never mixes with model/skill/variant/agentic-variant evals — different methodology."""
    company = company or _company()
    run_dir = benchlib.RESULTS_DIR / run_id
    cells_path = run_dir / "cells.json"
    if not cells_path.exists():
        raise FileNotFoundError(f"no cells.json for {run_id}")
    cells = json.load(open(cells_path))
    ts = _now_iso()
    out = []
    for test_class, c in cells.items():
        if c.get("quality") is None:
            continue
        out.append({
            "ts": ts, "company": company, "kind": "team_decomp",
            "test_class": test_class, "model": test_class.split(":")[-1],
            "model_class": "team" if ":team" in test_class else "single",
            "metrics": {
                "quality": _r(c.get("quality")),
                "qPer1kOut": _r(c.get("qPer1kOut")),
                "meanOutputTokens": _r(c.get("meanOutputTokens"), 0),
                "meanWallMs": _r(c.get("meanWallMs"), 0),
            },
            "n_tasks": c.get("n"), "run_id": run_id, "judge": None,
            "frame": "team", "skill": None, "source": "team_bench.py",
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
        if kind in _BENCH_METADATA_KINDS:
            eras = []
            by_era = {}
            for hit in hits:
                suite_sha = hit.get("suite_sha256")
                effort = hit.get("effort")
                if _is_missing_metadata_value(suite_sha) or _is_missing_metadata_value(effort):
                    continue
                by_era.setdefault((suite_sha, effort), []).append(hit)
            for (suite_sha, effort), era_hits in sorted(by_era.items()):
                eras.append({
                    "suite_sha256": suite_sha,
                    "effort": effort,
                    "n": len(era_hits),
                    "latest": max(hit["ts"] for hit in era_hits),
                })
            if eras:
                result["comparisonClass"] = "same_era" if len(eras) == 1 else "cross_era"
                result["comparisonEras"] = eras
                if len(eras) > 1:
                    result["comparisonNote"] = (
                        "Multiple suite/effort eras are pooled here. Treat the aggregate as "
                        "directional unless you isolate one era."
                    )
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
    pr.add_argument("--company", default=None); pr.add_argument("--kind", choices=["bench", "skill", "variants", "auto"], default="auto")
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
        elif kind == "variants":
            n_appended, n = record_variants_run(args.run, args.company)
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
