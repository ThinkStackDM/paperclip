#!/usr/bin/env python3
"""
Evaluate the qwen-based triage gate against a labelled real-issue set.

Uses the exact rubric/parser shape from ~/scripts/triage-gate.py, but runs over a
committed gold set so precision/recall can be reproduced later.
"""

import argparse
import json
import math
import statistics
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import urllib.error
import urllib.request

import benchlib


RUBRIC = """You are a triage gate. Decide if a software/business task needs the most capable (expensive) AI model, or can be handled well by a strong cheaper model. Reply with ONLY one word on line 1: OPUS or ROUTINE. Line 2: a 6-word reason.

OPUS = deep reasoning: novel architecture, subtle multi-system debugging, ambiguous/underspecified judgment, security-critical design, large risky refactors.
ROUTINE = well-specified, mechanical or low-risk: boilerplate, small fixes, config/doc/copy updates, repetitive edits, clear acceptance criteria.

TITLE: {title}
DESCRIPTION: {desc}
/no_think"""


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def run_id(model_id):
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"triage-gate-{benchlib.slugify(model_id)}-{stamp}"


def load_gold(path=None):
    path = Path(path) if path else (Path(__file__).resolve().parent / "triage_gate_gold.json")
    with open(path) as f:
        return json.load(f)


def classify(api_url, model_id, item, timeout_sec):
    prompt = RUBRIC.format(title=item["title"][:300], desc=(item.get("description") or "")[:1500])
    body = {
        "model": model_id,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0, "num_ctx": 4096},
    }
    req = urllib.request.Request(
        api_url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        raw = json.loads(resp.read().decode("utf-8", "replace"))
    out = (raw.get("response") or "").strip()
    lines = [
        line.strip()
        for line in out.replace("</think>", "\n").split("\n")
        if line.strip() and "<think>" not in line
    ]
    verdict = "OPUS"
    reason = ""
    for line in lines:
        up = line.upper()
        if up.startswith("ROUTINE"):
            verdict = "ROUTINE"
            continue
        if up.startswith("OPUS"):
            verdict = "OPUS"
            continue
        if not reason:
            reason = line[:80]
    return {
        "prediction": verdict,
        "reason": reason,
        "output": out,
        "outputTokens": raw.get("eval_count"),
        "wallMs": math.floor((raw.get("total_duration") or 0) / 1_000_000),
        "tokPerSec": (
            raw["eval_count"] / (raw["eval_duration"] / 1_000_000_000.0)
            if raw.get("eval_count") is not None and raw.get("eval_duration")
            else None
        ),
    }


def metric_block(labels, positive_label):
    tp = fp = fn = tn = 0
    for gold, pred in labels:
        if gold == positive_label and pred == positive_label:
            tp += 1
        elif gold != positive_label and pred == positive_label:
            fp += 1
        elif gold == positive_label and pred != positive_label:
            fn += 1
        else:
            tn += 1
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and (precision + recall)
        else None
    )
    return {
        "label": positive_label,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def summarize(results, model_id, reps):
    labels = [(row["gold"], row["majorityPrediction"]) for row in results]
    stability = [row["agreement"] for row in results]
    tok_s = [row["meanTokPerSec"] for row in results if row.get("meanTokPerSec") is not None]
    return {
        "meta": {
            "modelId": model_id,
            "reps": reps,
            "nExamples": len(results),
            "generatedAt": now_iso(),
        },
        "metrics": {
            "overallAccuracy": sum(1 for g, p in labels if g == p) / len(labels) if labels else None,
            "meanAgreement": statistics.mean(stability) if stability else None,
            "meanTokPerSec": statistics.mean(tok_s) if tok_s else None,
            "opus": metric_block(labels, "OPUS"),
            "routine": metric_block(labels, "ROUTINE"),
        },
        "examples": results,
    }


def to_markdown(summary):
    metrics = summary["metrics"]
    def _fmt(x, digits=3):
        return "—" if x is None else f"{x:.{digits}f}"
    lines = []
    lines.append(f"# Triage-Gate Eval — `{summary['meta']['modelId']}`\n")
    lines.append(
        f"_Generated {summary['meta']['generatedAt']}. "
        f"Examples: **{summary['meta']['nExamples']}**. "
        f"Reps: **{summary['meta']['reps']}**._\n"
    )
    lines.append("## Summary\n")
    lines.append("| Metric | Value |")
    lines.append("|---|---|")
    lines.append(f"| Accuracy | {_fmt(metrics['overallAccuracy'])} |")
    lines.append(f"| Mean agreement | {_fmt(metrics['meanAgreement'])} |")
    lines.append(f"| Mean tok/s | {_fmt(metrics['meanTokPerSec'], 1)} |")
    for key in ("opus", "routine"):
        block = metrics[key]
        lines.append(f"| {block['label']} precision | {_fmt(block['precision'])} |")
        lines.append(f"| {block['label']} recall | {_fmt(block['recall'])} |")
        lines.append(f"| {block['label']} F1 | {_fmt(block['f1'])} |")

    lines.append("\n## Examples\n")
    lines.append("| Issue | Gold | Pred | Agreement | Tok/s | Reason |")
    lines.append("|---|---|---|---|---|---|")
    for row in summary["examples"]:
        lines.append(
            f"| `{row['identifier']}` | {row['gold']} | {row['majorityPrediction']} | "
            f"{_fmt(row['agreement'])} | {_fmt(row['meanTokPerSec'], 1)} | {row['reason']} |"
        )
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Evaluate the local triage gate")
    ap.add_argument("--dataset", default=None)
    ap.add_argument("--model", default="qwen3:8b")
    ap.add_argument("--api-url", default="http://127.0.0.1:11434/api/generate")
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--timeout-sec", type=int, default=90)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    if args.reps < 1:
        raise SystemExit("--reps must be >= 1")

    gold = load_gold(args.dataset)
    if args.limit is not None:
        gold = gold[: args.limit]
    out_dir = benchlib.RESULTS_DIR / run_id(args.model)
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for item in gold:
        preds = []
        tok_s = []
        reasons = []
        outputs = []
        for rep in range(1, args.reps + 1):
            pred = classify(args.api_url, args.model, item, args.timeout_sec)
            preds.append(pred["prediction"])
            reasons.append(pred["reason"])
            outputs.append(pred["output"])
            if pred.get("tokPerSec") is not None:
                tok_s.append(pred["tokPerSec"])
            print(
                f"[{item['identifier']}] rep {rep}/{args.reps} "
                f"gold={item['gold']} pred={pred['prediction']} tok/s={pred.get('tokPerSec') or 0:.1f}",
                flush=True,
            )

        counts = Counter(preds)
        majority = counts.most_common(1)[0][0]
        results.append(
            {
                "identifier": item["identifier"],
                "title": item["title"],
                "gold": item["gold"],
                "goldReason": item["goldReason"],
                "predictions": preds,
                "majorityPrediction": majority,
                "agreement": counts[majority] / len(preds),
                "meanTokPerSec": statistics.mean(tok_s) if tok_s else None,
                "reason": next((reason for reason in reasons if reason), ""),
                "outputs": outputs,
            }
        )

    summary = summarize(results, args.model, args.reps)
    report_md = to_markdown(summary)

    with open(out_dir / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    with open(out_dir / "report.md", "w") as f:
        f.write(report_md)

    print("\n" + "=" * 60, flush=True)
    print(report_md, flush=True)
    print(f"wrote: {out_dir / 'report.md'}", flush=True)
    print(f"       {out_dir / 'summary.json'}", flush=True)


if __name__ == "__main__":
    main()
