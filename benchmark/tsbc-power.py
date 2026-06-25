#!/usr/bin/env python3
"""
tsbc-power — set ThinkStack BootCamp's power mode so its benchmark load never crushes
the shared Mac. Writes .tsbc-power.json (bench.py reads it to cap concurrency + gate
heavy tasks). Runs hourly via launchd; read-only except the state file.

MODE:
  LOW  if any heavy-hitter (config) is in its LIVE sprint window (read from DB, so
       ad-hoc window extensions are caught automatically) OR any ad-hoc sprint flag
       is active (scripts/.adhoc-sprint/*.json).
  NORMAL otherwise.
Plus daily DREAM and weekly SLEEP flags from the sleepDream cadence.

  tsbc-power.py            # compute + write state (+ print)
  tsbc-power.py --print    # print current state only, no recompute
"""
import json, os, subprocess, sys
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "tsbc-power-config.json")))
STATE = os.path.join(HERE, ".tsbc-power.json")
ADHOC_DIR = "/Users/glad0s/paperclip/scripts/.adhoc-sprint"
PG = ["/opt/homebrew/bin/psql", "-h127.0.0.1", "-p54329", "-U", "paperclip", "-d", "paperclip", "-tA"]

def q(sql):
    r = subprocess.run(PG + ["-c", sql], env={**os.environ, "PGPASSWORD": "paperclip"},
                       capture_output=True, text=True)
    return r.stdout.strip()

def in_window(h, start, end):
    if start == end:
        return True
    return (start <= h < end) if start < end else (h >= start or h < end)

def main():
    if "--print" in sys.argv:
        print(open(STATE).read() if os.path.exists(STATE) else "(no state yet)")
        return
    tz = ZoneInfo(CFG.get("tz", "Europe/Dublin"))
    now = datetime.now(tz)
    h = now.hour
    reasons = []

    # 1) heavy-hitter LIVE windows (catches ad-hoc-extended windows in the DB)
    for name in CFG["heavyHitters"]:
        safe = name.replace("'", "''")
        win = q(f"SELECT activity_window::text FROM companies WHERE name='{safe}' AND status<>'archived';")
        if win and win.strip().startswith("{"):
            w = json.loads(win)
            if in_window(h, int(w["startHour"]), int(w["endHour"])):
                reasons.append(f"{name} sprint {int(w['startHour']):02d}-{int(w['endHour']):02d}")

    # 2) any ad-hoc sprint flag (runbook sprints, any company)
    if CFG.get("adhocSprintTriggersLow", True):
        try:
            for fn in os.listdir(ADHOC_DIR):
                if fn.endswith(".json"):
                    try:
                        d = json.load(open(os.path.join(ADHOC_DIR, fn)))
                        reasons.append(f"ad-hoc sprint: {d.get('name', d.get('cid', '?'))}")
                    except Exception:
                        pass
        except FileNotFoundError:
            pass

    mode = "low" if reasons else "normal"
    state = dict(CFG["modes"][mode])
    state["mode"] = mode

    # sleep / dream cadence
    sd = CFG.get("sleepDream", {})
    state["dream"] = (h == sd.get("dreamDailyHour"))
    sw = sd.get("sleepWeekly", {})
    state["sleep"] = (now.weekday() == sw.get("weekday") and in_window(h, sw.get("startHour", 0), sw.get("endHour", 0)))
    state["paused"] = bool(state["sleep"])  # weekly sleep = full idle; bench refuses to start

    state["reason"] = "; ".join(reasons) if reasons else "no heavy-hitter sprint / no ad-hoc sprint"
    if state["sleep"]:
        state["reason"] += "; WEEKLY SLEEP (idle)"
    state["updatedAt"] = now.isoformat(timespec="seconds")
    json.dump(state, open(STATE, "w"), indent=2)

    print(f"[tsbc-power {now:%F %H:%M} {CFG.get('tz')}] mode={mode} maxWorkers={state['maxWorkers']} "
          f"heavyTasks={state['heavyTasksAllowed']} dream={state['dream']} sleep={state['sleep']} "
          f":: {state['reason']}")

if __name__ == "__main__":
    main()
