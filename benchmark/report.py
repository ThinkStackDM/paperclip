#!/usr/bin/env python3
"""
report.py — aggregate scored runs into per-(role,model) stats, a per-role model
recommendation (the thing that drives data-driven tiering #9), and the explicit
grok-4.3-vs-4.20 head-to-head this benchmark exists to settle. Emits both a
machine-readable recommendations.json and a human report.md.
"""

import json
import statistics
from collections import defaultdict


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return statistics.mean(xs) if xs else None


def _q_per_1k(quality, tokens):
    if quality is None or not tokens:
        return None
    return quality / (tokens / 1000.0)


def _value_key(cfg):
    """Which efficiency metric drives recommendations. Default: output tokens —
    total tokens are ~95% fixed CLI system-prompt overhead (a harness artifact),
    so per-output-token is the fair marginal-cost signal."""
    metric = (cfg.get("recommendation", {}) or {}).get("value_metric", "output")
    return "meanQualityPer1kOutput" if metric == "output" else "meanQualityPer1k"


def aggregate(runs, cfg):
    """
    runs: list of flat run records (one per role/task/model) each with
          role, task_id, model_id, quality, qualityPer1kTokens, totalTokens, ok...
    Returns the full report dict.
    """
    # Show every model actually present in the run (including catalog variants run
    # via --models), ordered by the config roster (models then catalog), so cheap/
    # mid-tier variants appear — not just the default `models` lineup.
    roster = {m["id"]: m for m in (cfg.get("models", []) + cfg.get("models_catalog", []))}
    present = {r["model_id"] for r in runs}
    models = [mid for mid in roster if mid in present]
    models += [mid for mid in sorted(present) if mid not in roster]  # unknown ids last
    labels = {mid: (roster.get(mid, {}).get("label") or mid) for mid in models}
    roster_rows = {mid: roster.get(mid, {"id": mid, "label": mid, "adapter": None,
                                          "model_arg": None, "lane": None}) for mid in models}
    roles = list(cfg["roles"])
    # Agentic roles (paperclip lane) are scored the same way but rendered in their
    # own section — they measure live case-completion, not base-model answer quality.
    agentic_roles = [r for r in cfg.get("agentic_roles", []) if any(run["role"] == r for run in runs)]
    roles_all = roles + [r for r in agentic_roles if r not in roles]

    # cell[(role, model)] = list of runs
    cells = defaultdict(list)
    for r in runs:
        cells[(r["role"], r["model_id"])].append(r)

    per_role = {}
    for role in roles_all:
        model_stats = {}
        for mid in models:
            rs = cells.get((role, mid), [])
            ran = [r for r in rs if r.get("ok")]
            qualities = [r.get("quality") for r in ran]
            qpks = [r.get("qualityPer1kTokens") for r in ran]
            qpk_out = [_q_per_1k(r.get("quality"), r.get("outputTokens")) for r in ran]
            toks = [r.get("totalTokens") for r in ran]
            in_toks = [r.get("inputTokens") for r in ran]
            out_toks = [r.get("outputTokens") for r in ran]
            model_stats[mid] = {
                "tasks": len(rs),
                "okRuns": len(ran),
                "successRate": (len(ran) / len(rs)) if rs else None,
                "meanQuality": _mean(qualities),
                "meanQualityPer1k": _mean(qpks),            # per TOTAL tokens (incl CLI overhead)
                "meanQualityPer1kOutput": _mean(qpk_out),   # per OUTPUT tokens (marginal cost; fairer)
                "meanTokens": _mean(toks),
                "meanInputTokens": _mean(in_toks),
                "meanOutputTokens": _mean(out_toks),
                "estimatedTokens": any(r.get("tokensEstimated") for r in rs),
            }
        per_role[role] = {
            "models": model_stats,
            "recommendation": _recommend(model_stats, cfg, labels),
            "grokHeadToHead": _grok_h2h(model_stats, labels),
        }

    overall = _overall(per_role, models, labels, cfg)
    return {
        "models": [{"id": mid, "label": labels.get(mid, mid),
                    "adapter": roster_rows[mid].get("adapter"),
                    "model_arg": roster_rows[mid].get("model_arg"),
                    "lane": roster_rows[mid].get("lane")} for mid in models],
        "judge": cfg["judge"].get("id"),
        "roles": per_role,
        "agenticRoles": agentic_roles,
        "overall": overall,
        "config": {"scoring": cfg["scoring"], "recommendation": cfg["recommendation"]},
    }


def _recommend(model_stats, cfg, labels):
    rc = cfg.get("recommendation", {})
    floor = float(rc.get("quality_floor", 0.6))
    eps = float(rc.get("quality_epsilon", 0.02))
    cost_trigger = float(rc.get("cost_ratio_trigger", 1.5))
    vkey = _value_key(cfg)

    rated = {mid: s for mid, s in model_stats.items()
             if s["meanQuality"] is not None and s["meanQuality"] >= floor}
    if not rated:
        # nobody cleared the floor — fall back to best raw quality
        any_rated = {m: s for m, s in model_stats.items() if s["meanQuality"] is not None}
        if not any_rated:
            return {"pick": None, "reason": "no successful runs"}
        bq = max(any_rated, key=lambda m: any_rated[m]["meanQuality"])
        return {"pick": bq, "pickLabel": labels.get(bq), "objective": "peak_quality_cost_aware",
                "reason": f"no model cleared the {floor:.2f} quality floor; took highest quality",
                "bestQuality": bq, "bestQualityLabel": labels.get(bq),
                "bestValue": bq, "bestValueLabel": labels.get(bq)}

    best_quality = max(rated, key=lambda m: rated[m]["meanQuality"])
    peak_q = rated[best_quality]["meanQuality"]
    peak_out = rated[best_quality].get("meanOutputTokens") or 0

    # peak-quality, cost-aware: among models within eps of the peak, prefer the cheapest
    # (lowest output tokens) — but only drop from the peak if it's materially cheaper.
    near_peak = {m: s for m, s in rated.items() if peak_q - s["meanQuality"] <= eps}
    cheapest = min(near_peak, key=lambda m: (near_peak[m].get("meanOutputTokens") or float("inf")))
    cheap_out = near_peak[cheapest].get("meanOutputTokens") or 0
    cost_ratio = (peak_out / cheap_out) if cheap_out else None

    if cheapest != best_quality and cost_ratio is not None and cost_ratio >= cost_trigger:
        pick = cheapest
        reason = (f"peak quality is {labels.get(best_quality)} ({peak_q:.3f}); picked "
                  f"{labels.get(cheapest)} — within {eps:.2f} quality "
                  f"(−{peak_q - rated[cheapest]['meanQuality']:.3f}) at {cost_ratio:.1f}× less output cost")
    else:
        pick = best_quality
        if cheapest != best_quality and cost_ratio is not None:
            reason = (f"kept peak quality {labels.get(best_quality)} ({peak_q:.3f}); nearest "
                      f"cheaper model only {cost_ratio:.1f}× cheaper (< {cost_trigger:.1f}× trigger)")
        elif cheapest != best_quality:
            # No token/cost data (e.g. the agentic completion suite omits tokens) —
            # there's nothing to justify dropping below peak quality, so keep peak.
            reason = (f"peak quality {labels.get(best_quality)} ({peak_q:.3f}); no token/cost "
                      f"data available to trade quality for a cheaper near-peak model")
        else:
            reason = f"peak quality {labels.get(best_quality)} ({peak_q:.3f}) is also the cheapest near-peak"

    # best raw value (for reference / the efficiency view)
    valued = {m: s for m, s in rated.items() if s.get(vkey) is not None}
    best_value = max(valued, key=lambda m: valued[m][vkey]) if valued else None
    return {
        "pick": pick,
        "pickLabel": labels.get(pick),
        "objective": "peak_quality_cost_aware",
        "reason": reason,
        "qualityGivenUp": round(peak_q - rated[pick]["meanQuality"], 4),
        "outputCostRatioVsPeak": round(cost_ratio, 2) if cost_ratio else None,
        "bestQuality": best_quality,
        "bestQualityLabel": labels.get(best_quality),
        "bestValue": best_value,
        "bestValueLabel": labels.get(best_value) if best_value else None,
    }


def _grok_h2h(model_stats, labels):
    a, b = "grok-4.3", "grok-4.20"
    sa, sb = model_stats.get(a), model_stats.get(b)
    if not sa or not sb or sa["meanQuality"] is None or sb["meanQuality"] is None:
        return {"resolved": False, "note": "insufficient data for grok-4.3 vs grok-4.20"}
    dq = sb["meanQuality"] - sa["meanQuality"]
    winner_q = b if dq > 0 else a
    res = {
        "resolved": True,
        "grok43": {"quality": sa["meanQuality"], "qualityPer1kOutput": sa["meanQualityPer1kOutput"],
                   "meanOutputTokens": sa["meanOutputTokens"]},
        "grok420": {"quality": sb["meanQuality"], "qualityPer1kOutput": sb["meanQualityPer1kOutput"],
                    "meanOutputTokens": sb["meanOutputTokens"]},
        "qualityWinner": winner_q,
        "qualityDelta": dq,
    }
    va, vb = sa["meanQualityPer1kOutput"], sb["meanQualityPer1kOutput"]
    if va is not None and vb is not None:
        res["valueWinner"] = b if vb > va else a
    return res


def _overall(per_role, models, labels, cfg):
    # average each model's per-role mean quality across roles where it ran
    agg = {}
    for mid in models:
        qs = [per_role[role]["models"][mid]["meanQuality"] for role in per_role]
        vs = [per_role[role]["models"][mid]["meanQualityPer1k"] for role in per_role]
        vo = [per_role[role]["models"][mid]["meanQualityPer1kOutput"] for role in per_role]
        agg[mid] = {"meanQuality": _mean(qs), "meanQualityPer1k": _mean(vs),
                    "meanQualityPer1kOutput": _mean(vo)}
    rated = {m: s for m, s in agg.items() if s["meanQuality"] is not None}
    best = max(rated, key=lambda m: rated[m]["meanQuality"]) if rated else None
    return {"perModel": agg, "bestOverallQuality": best,
            "bestOverallQualityLabel": labels.get(best) if best else None}


# --------------------------------------------------------------------------
# markdown
# --------------------------------------------------------------------------

def _fmt(x, pct=False):
    if x is None:
        return "—"
    if pct:
        return f"{x*100:.0f}%"
    return f"{x:.3f}"


def _fmt_int(x):
    return "—" if x is None else f"{int(round(x)):,}"


def to_markdown(report, run_id, meta):
    L = []
    L.append(f"# Paperclip Model Benchmark — `{run_id}`\n")
    L.append(f"_Generated {meta.get('finished_at', '')}. "
             f"Judge: **{report['judge']}** (blind, uniform). "
             f"{meta.get('n_runs', '?')} runs, "
             f"{meta.get('n_fail', 0)} failures._\n")
    L.append("**Models:** " + ", ".join(f"`{m['id']}`" for m in report["models"]) + "\n")
    L.append("> Quality is a 0–1 blend of deterministic checks and the blind judge. "
             "**`q/1k-out`** = quality per 1,000 **output** tokens — the primary value metric, "
             "because total tokens are ~95% fixed CLI system-prompt overhead (a harness artifact) "
             "that would otherwise reward whichever CLI ships the smallest base prompt rather than "
             "the better model. `in`/`out` = mean input/output tokens. Models run in a neutralized "
             "temp CWD — base-model capability, not the local agent harness.\n")

    # overall
    ov = report["overall"]
    L.append("## Overall (mean across roles)\n")
    L.append("| Model | Mean quality | q/1k-out | q/1k-total |")
    L.append("|---|---|---|---|")
    for m in report["models"]:
        s = ov["perModel"][m["id"]]
        L.append(f"| {m['label']} | {_fmt(s['meanQuality'])} | "
                 f"{_fmt(s.get('meanQualityPer1kOutput'))} | {_fmt(s['meanQualityPer1k'])} |")
    L.append(f"\n**Best overall quality:** {ov.get('bestOverallQualityLabel') or '—'}\n")

    # per role — CLI answer-quality lanes only; agentic roles render in their own section below
    agentic = list(report.get("agenticRoles", []))
    cli_roles = [
        r for r in report["roles"]
        if r not in agentic
        and any(report["roles"][r]["models"][m["id"]]["tasks"] > 0 for m in report["models"])
    ]
    if cli_roles:
        L.append("## Per-role results & recommendations\n")
    for role in cli_roles:
        rd = report["roles"][role]
        L.append(f"### `{role}`\n")
        L.append("| Model | Quality | q/1k-out | in | out | Success |")
        L.append("|---|---|---|---|---|---|")
        for m in report["models"]:
            s = rd["models"][m["id"]]
            est = " *(est)*" if s["estimatedTokens"] else ""
            L.append(f"| {m['label']} | {_fmt(s['meanQuality'])} | {_fmt(s.get('meanQualityPer1kOutput'))} "
                     f"| {_fmt_int(s['meanInputTokens'])} | {_fmt_int(s['meanOutputTokens'])}{est} "
                     f"| {_fmt(s['successRate'], pct=True)} |")
        rec = rd["recommendation"]
        L.append(f"\n**→ Recommended for `{role}`: {rec.get('pickLabel') or '—'}** — {rec.get('reason', '')}  ")
        extra = ""
        if rec.get("qualityGivenUp"):
            extra = (f" (gives up {rec['qualityGivenUp']:+.3f} quality for "
                     f"{rec.get('outputCostRatioVsPeak','?')}× cheaper output)")
        L.append(f"_Peak quality: {rec.get('bestQualityLabel') or '—'} · "
                 f"Most output-efficient: {rec.get('bestValueLabel') or '—'}{extra}_\n")
        h = rd["grokHeadToHead"]
        if h.get("resolved"):
            L.append(f"_Grok head-to-head: quality winner **{h['qualityWinner']}** "
                     f"(Δ {h['qualityDelta']:+.3f}); "
                     f"4.3 q={_fmt(h['grok43']['quality'])} / "
                     f"4.20 q={_fmt(h['grok420']['quality'])}._\n")

    # agentic case-completion (Paperclip-function lane)
    if agentic:
        L.append("## Agentic case-completion (Paperclip function)\n")
        L.append("> Each model runs as a REAL Paperclip agent against fixture issues. Quality = "
                 "did it drive the case to a VALID disposition (done / in_review / "
                 "blocked-with-a-named-blocker) with concrete action + a comment — the live-harness "
                 "behaviour the answer-quality lanes cannot measure (those score single-shot prose "
                 "with the harness stripped, where non-reasoning models look identical). Tokens/"
                 "efficiency are omitted; completion is the signal.\n")
        for role in agentic:
            rd = report["roles"][role]
            L.append(f"### `{role}`\n")
            L.append("| Model | Completion quality | Success | cases |")
            L.append("|---|---|---|---|")
            for m in report["models"]:
                s = rd["models"][m["id"]]
                L.append(f"| {m['label']} | {_fmt(s['meanQuality'])} | "
                         f"{_fmt(s['successRate'], pct=True)} | {s['tasks']} |")
            L.append("")

    # grok verdict — CLI base-model comparison; skip for agentic-only runs (no CLI data)
    if cli_roles:
        L.append("## grok-4.3 vs grok-4.20 — the verdict\n")
        wins43 = wins420 = ties = 0
        for role in cli_roles:
            h = report["roles"][role]["grokHeadToHead"]
            if not h.get("resolved"):
                continue
            w = h["qualityWinner"]
            if abs(h["qualityDelta"]) < 1e-9:
                ties += 1
            elif w == "grok-4.20":
                wins420 += 1
            else:
                wins43 += 1
        L.append(f"- Role-level quality wins: **grok-4.20 = {wins420}**, "
                 f"**grok-4.3 = {wins43}**, ties = {ties}")
        o43 = ov["perModel"].get("grok-4.3", {})
        o420 = ov["perModel"].get("grok-4.20", {})
        L.append(f"- Overall mean quality: grok-4.3 {_fmt(o43.get('meanQuality'))} · "
                 f"grok-4.20 {_fmt(o420.get('meanQuality'))}")
        L.append(f"- Overall mean q/1k-out: grok-4.3 {_fmt(o43.get('meanQualityPer1kOutput'))} · "
                 f"grok-4.20 {_fmt(o420.get('meanQualityPer1kOutput'))}")
        L.append("- _(4.20 is the reasoning variant — it spends more output/thoughts tokens, so a "
                 "quality win only justifies tiering onto it if it beats 4.3's efficiency cost.)_\n")

    return "\n".join(L) + "\n"
