#!/usr/bin/env python3
"""Stale-error sweep — recover agents orphaned in `error` status.

Agents can get stuck in `error` after a server restart / process-lost storm (the
last run is "Process lost", a benign cancellation, or a since-fixed adapter gap)
and the normal recovery flow doesn't always clear them — they just sit there,
out of rotation, until a human resumes them. This sweep does that automatically:
it finds agents whose status is `error` AND whose last heartbeat is older than
--stale-minutes (i.e. orphaned, not actively mid-failure) and POSTs /resume,
clearing them back to `idle`.

Fresh errors (heartbeat newer than the threshold) are LEFT ALONE — they may be
actively failing, so we don't want to thrash-resume them; the staleness gate also
prevents tight resume↔re-error loops (a re-erroring agent's heartbeat stays fresh,
so it won't be re-resumed for another --stale-minutes window). A genuinely-broken
agent therefore shows up as repeated RESUMED lines in the log over time — that's
the human's cue to investigate the root cause rather than keep nudging it.

Usage: stale-error-sweep.py [--apply] [--stale-minutes N] [--base URL]
  (default is DRY RUN; pass --apply to actually resume)
"""
import argparse
import datetime
import json
import urllib.request


def main() -> None:
    ap = argparse.ArgumentParser(description="resume agents stuck in error status")
    ap.add_argument("--apply", action="store_true", help="actually resume (default: dry run)")
    ap.add_argument("--stale-minutes", type=int, default=60, help="only resume errors older than this")
    ap.add_argument("--base", default="http://127.0.0.1:3100/api")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    def get(path: str):
        with urllib.request.urlopen(base + path, timeout=15) as r:
            return json.load(r)

    def post(path: str):
        req = urllib.request.Request(base + path, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)

    now = datetime.datetime.now(datetime.timezone.utc)
    ts = now.isoformat(timespec="seconds")

    try:
        comps = get("/companies")
    except Exception as ex:  # server down / unreachable — log and exit cleanly
        print(f"[{ts}] stale-error-sweep: server unreachable ({ex})")
        return
    comps = comps if isinstance(comps, list) else comps.get("companies", [])

    stuck = []
    for c in comps:
        try:
            ags = get(f"/companies/{c['id']}/agents")
        except Exception as ex:
            print(f"[{ts}] WARN could not list agents for {c.get('name')}: {ex}")
            continue
        ags = ags if isinstance(ags, list) else ags.get("agents", [])
        for ag in ags:
            if ag.get("status") != "error":
                continue
            hb = ag.get("lastHeartbeatAt")
            stale_min = None
            if hb:
                t = datetime.datetime.fromisoformat(hb.replace("Z", "+00:00"))
                stale_min = (now - t).total_seconds() / 60.0
            if hb is None or (stale_min is not None and stale_min >= args.stale_minutes):
                stuck.append((c.get("name", "?"), ag, stale_min))

    if not stuck:
        print(f"[{ts}] stale-error-sweep: no stale errored agents (threshold {args.stale_minutes}m)")
        return

    for co, ag, sm in stuck:
        label = f"{co}/{ag.get('title') or ag.get('role')} ({ag['id'][:8]}) stale={int(sm) if sm is not None else 'n/a'}m"
        if not args.apply:
            print(f"[{ts}] would resume {label}")
            continue
        try:
            r = post(f"/agents/{ag['id']}/resume")
            print(f"[{ts}] RESUMED {label} -> {r.get('status')}")
        except Exception as ex:
            print(f"[{ts}] FAILED  {label} -> {ex}")


if __name__ == "__main__":
    main()
