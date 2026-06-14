#!/usr/bin/env python3
"""
gemini_usage.py — make the gemini "blind lane" visible.

Paperclip's quota board only reports anthropic + openai; gemini 429s are absorbed
by the adapter and never surfaced, so there is no consumed-usage visibility for
gemini. But the gemini CLI persists every assistant turn — with per-call token
counts — to local session transcripts. This reads them and rolls up CONSUMED
tokens per day and per model.

Source (verified): ~/.gemini/tmp/<project-slug>/chats/session-*.jsonl
  Each line is one event; assistant turns have type=="gemini" and:
    .model                          e.g. "gemini-3.1-pro-preview"
    .tokens = {input, output, cached, thoughts, tool, total}
    .timestamp                      ISO8601
  `total` already includes cached+thoughts, so sum `total` for billing-equivalent
  usage; the others are diagnostics. (history/ holds only pointer files — ignore it.)

CAVEAT: this is CONSUMED usage only. There is no local record of REMAINING quota
or rate-limit windows anywhere on disk — that would require a live Google Code
Assist API call. And ~/.gemini/tmp is a temp tree (best-effort retention); a monitor
should ingest incrementally rather than assume full history persists.

Usage:
  python3 gemini_usage.py                 # per-day x per-model table, last 14 days
  python3 gemini_usage.py --days 3
  python3 gemini_usage.py --by model      # per-model totals only
  python3 gemini_usage.py --json          # machine-readable
"""

import argparse
import collections
import glob
import json
import os
from datetime import datetime, timedelta, timezone

CHATS_GLOB = os.path.expanduser("~/.gemini/tmp/*/chats/*.jsonl")
TOKEN_FIELDS = ("input", "output", "cached", "thoughts", "tool", "total")


def collect(days=None):
    """Return (rows, files_seen). rows = list of {day, model, <token fields>, calls}."""
    cutoff = None
    if days is not None:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    agg = collections.defaultdict(collections.Counter)  # (day, model) -> Counter
    calls = collections.Counter()                        # (day, model) -> n
    files = glob.glob(CHATS_GLOB)
    for path in files:
        try:
            with open(path, errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if not line or '"type"' not in line:
                        continue
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if d.get("type") != "gemini":
                        continue
                    tok = d.get("tokens")
                    if not isinstance(tok, dict):
                        continue
                    day = (d.get("timestamp") or "")[:10] or "unknown"
                    if cutoff and day != "unknown" and day < cutoff:
                        continue
                    model = d.get("model") or "unknown"
                    key = (day, model)
                    for fld in TOKEN_FIELDS:
                        v = tok.get(fld)
                        if isinstance(v, (int, float)):
                            agg[key][fld] += int(v)
                    calls[key] += 1
        except OSError:
            continue
    rows = []
    for (day, model), c in sorted(agg.items()):
        row = {"day": day, "model": model, "calls": calls[(day, model)]}
        row.update({fld: c[fld] for fld in TOKEN_FIELDS})
        rows.append(row)
    return rows, len(files)


def rollup(rows, by):
    """Collapse rows by 'day', 'model', or 'total'."""
    if by == "day":
        keyfn = lambda r: r["day"]
    elif by == "model":
        keyfn = lambda r: r["model"]
    else:
        keyfn = lambda r: "ALL"
    out = collections.defaultdict(lambda: collections.Counter())
    for r in rows:
        k = keyfn(r)
        out[k]["calls"] += r["calls"]
        for fld in TOKEN_FIELDS:
            out[k][fld] += r[fld]
    return out


def _fmt(n):
    return f"{n:,}"


def print_table(rows, by):
    if not rows:
        print("no gemini usage found (is ~/.gemini/tmp/*/chats present?)")
        return
    if by in ("day", "model", "total"):
        agg = rollup(rows, by)
        label = {"day": "Day", "model": "Model", "total": ""}[by]
        print(f"{label or 'Lane':<26} {'calls':>7} {'input':>14} {'output':>12} {'total':>14}")
        print("-" * 76)
        gt = collections.Counter()
        for k in sorted(agg, key=lambda x: (-agg[x]["total"])):
            c = agg[k]
            print(f"{k:<26} {c['calls']:>7} {_fmt(c['input']):>14} {_fmt(c['output']):>12} {_fmt(c['total']):>14}")
            gt.update(c)
        print("-" * 76)
        print(f"{'TOTAL':<26} {gt['calls']:>7} {_fmt(gt['input']):>14} {_fmt(gt['output']):>12} {_fmt(gt['total']):>14}")
    else:  # day x model grid
        print(f"{'Day':<12} {'Model':<26} {'calls':>7} {'input':>13} {'output':>11} {'total':>13}")
        print("-" * 86)
        for r in rows:
            print(f"{r['day']:<12} {r['model']:<26} {r['calls']:>7} "
                  f"{_fmt(r['input']):>13} {_fmt(r['output']):>11} {_fmt(r['total']):>13}")


def summarize(days=None):
    """Programmatic entry for usage.py: per-model totals dict."""
    rows, _ = collect(days=days)
    agg = rollup(rows, "model")
    return {model: dict(c) for model, c in agg.items()}


def main():
    ap = argparse.ArgumentParser(description="gemini consumed-token usage from local history")
    ap.add_argument("--days", type=int, default=14, help="lookback window (default 14; 0 = all)")
    ap.add_argument("--by", choices=["grid", "day", "model", "total"], default="grid")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    days = None if args.days == 0 else args.days
    rows, nfiles = collect(days=days)
    if args.json:
        print(json.dumps({"days": args.days, "files": nfiles, "rows": rows}, indent=2))
        return
    print(f"# gemini consumed usage — {len(rows)} (day,model) buckets from {nfiles} session files"
          f"{' (last %d days)' % args.days if days else ' (all time)'}\n")
    print_table(rows, args.by)
    print("\n(consumed tokens only — no local record of remaining quota; ~/.gemini/tmp is best-effort retention)")


if __name__ == "__main__":
    main()
