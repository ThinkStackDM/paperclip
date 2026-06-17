#!/usr/bin/env python3
"""
claude-window-flip — keep each company's CEO/CTO on Claude only during an 8h window
(sprint window ± 2h), and on their codex sister otherwise. This frees Claude slots so
ad-hoc tasks to DORMANT companies hit the cheap codex lane instead of tying up Claude
for the company that's actually sprinting.

Per company (non-TSMC): claude window = [startHour-2, endHour+2] (mod 24).
  in window  -> resume claude CEO/CTO   (codex sister untouched: always-on ops lane)
  out window -> pause  claude CEO/CTO   (codex sister untouched: always-on ops lane)
TSMC (always-on, no window) -> claude CEO/CTO always active.

The codex sister is the 24/7 always-on OPS lane (routines live here; Hermes-backed
session-limit failover owns its pause/resume). window-flip governs ONLY the Claude
sprint lane and never pauses/resumes codex — touching it would fight session-limit-watch
(it would resume a codex agent the watcher paused for a real limit, causing a flap).

Agents missing a codex sister are left on Claude (logged). Both lanes must be
activity-window-exempt (set once) so they run during the 2h dormant flanks.

Usage:
  claude-window-flip.py            # DRY RUN (prints planned actions, changes nothing)
  claude-window-flip.py --apply    # execute pause/resume
"""
import json, os, subprocess, sys, urllib.request, urllib.error
from datetime import datetime
from zoneinfo import ZoneInfo

BASE = "http://127.0.0.1:3100"
PG = ["/opt/homebrew/bin/psql", "-h127.0.0.1", "-p54329", "-U", "paperclip", "-d", "paperclip", "-tA", "-F", "\t"]
APPLY = "--apply" in sys.argv

def q(sql):
    r = subprocess.run(PG + ["-c", sql], env={**os.environ, "PGPASSWORD": "paperclip"}, capture_output=True, text=True)
    if r.returncode != 0 and r.stderr.strip():
        print(f"  [psql err] {r.stderr.strip()[:160]}")
    return r.stdout.strip()

def api(path, method="POST", body=None):
    data = json.dumps(body).encode() if body is not None else b"{}"
    req = urllib.request.Request(f"{BASE}/api{path}", data=data, headers={"Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode()[:80]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]
    except Exception as e:
        return 0, str(e)[:120]

def in_claude_window(h, start, end):
    cs = (start - 2) % 24
    ce = (end + 2) % 24
    if cs == ce:
        return True
    return (cs <= h < ce) if cs < ce else (h >= cs or h < ce)

def main():
    now_dublin = datetime.now(ZoneInfo("Europe/Dublin"))
    h = now_dublin.hour
    print(f"=== claude-window-flip {'APPLY' if APPLY else 'DRY-RUN'} @ {now_dublin:%Y-%m-%d %H:%M} Dublin (hour={h}) ===")

    # companies + windows
    comp_rows = q("SELECT id || '\t' || name || '\t' || COALESCE(activity_window::text,'') FROM companies WHERE status<>'archived';")
    companies = {}
    for line in comp_rows.splitlines():
        cid, name, win = (line.split("\t") + ["", "", ""])[:3]
        companies[cid] = {"name": name, "win": json.loads(win) if win.strip().startswith("{") else None}

    # ceo/cto claude primaries + their codex sisters, with current status
    agent_rows = q("""
      SELECT a.company_id || '\t' || a.role || '\t' || a.name || '\t' || a.adapter_type || '\t' || a.status || '\t' || a.id
      FROM agents a WHERE a.role IN ('ceo','cto') AND a.status<>'terminated'
        AND a.adapter_type IN ('claude_local','codex_local');""")
    # index: company -> role -> {claude:{}, codex:{}}
    fleet = {}
    for line in agent_rows.splitlines():
        cid, role, name, adapter, status, aid = (line.split("\t") + [""]*6)[:6]
        fleet.setdefault(cid, {}).setdefault(role, {})
        if adapter == "claude_local" and not name.endswith(("-Codex", "-Hermes", "-Grok")):
            fleet[cid][role]["claude"] = {"name": name, "status": status, "id": aid}
        elif adapter == "codex_local" and name.endswith("-Codex"):
            fleet[cid][role].setdefault("codex_by_base", {})[name[:-6]] = {"name": name, "status": status, "id": aid}

    actions = []
    def want(agent, desired):  # desired: 'active'(resume) or 'paused'(pause)
        if not agent: return
        cur = agent["status"]
        is_paused = cur == "paused"
        if desired == "active" and is_paused:
            actions.append(("resume", agent))
        elif desired == "paused" and not is_paused:
            actions.append(("pause", agent))

    for cid, comp in companies.items():
        roles = fleet.get(cid, {})
        win = comp["win"]
        always_on = win is None  # TSMC
        in_win = True if always_on else in_claude_window(h, int(win["startHour"]), int(win["endHour"]))
        wlabel = "always-on" if always_on else f"sprint {win['startHour']:02d}-{win['endHour']:02d} → claude-window {'OPEN' if in_win else 'closed'}"
        print(f"\n[{comp['name']}] {wlabel}")
        for role in ("ceo", "cto"):
            r = roles.get(role)
            if not r or "claude" not in r:
                continue
            claude = r["claude"]
            sister = (r.get("codex_by_base") or {}).get(claude["name"])
            if not sister:
                print(f"  {role}: {claude['name']} (claude) — NO codex sister, leaving on Claude")
                want(claude, "active")
                continue
            # Codex sister is the always-on ops lane — NOT pause/resumed here (owned by
            # session-limit-watch failover). window-flip only moves the Claude sprint lane.
            if in_win:
                print(f"  {role}: claude {claude['name']}[{claude['status']}] ACTIVE | codex {sister['name']}[{sister['status']}] always-on (untouched)")
                want(claude, "active")
            else:
                print(f"  {role}: claude {claude['name']}[{claude['status']}] PAUSE | codex {sister['name']}[{sister['status']}] always-on (untouched)")
                want(claude, "paused")

    print(f"\n=== {len(actions)} action(s) {'to apply' if APPLY else 'planned (dry-run)'} ===")
    for act, agent in actions:
        if APPLY:
            code, _ = api(f"/agents/{agent['id']}/{act}", body={"reason": "claude-window-flip: 8h CEO/CTO window"})
            print(f"  {act} {agent['name']} -> HTTP {code}")
        else:
            print(f"  WOULD {act} {agent['name']} ({agent['status']})")

if __name__ == "__main__":
    main()
