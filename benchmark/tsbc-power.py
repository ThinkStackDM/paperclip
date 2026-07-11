#!/usr/bin/env python3
"""
tsbc-power — set ThinkStack BootCamp's power mode so its benchmark load never crushes
the shared Mac. Writes .tsbc-power.json (bench.py reads it to cap concurrency + gate
heavy tasks). Runs hourly via launchd; read-only except the state file.

MODE:
  LOW  if the configured shared-Mac OpCos have a LIVE overlap count at/above the
       configured threshold (read from DB, so ad-hoc window extensions are caught
       automatically) OR any ad-hoc sprint flag is active (scripts/.adhoc-sprint/*.json).
  NORMAL otherwise.
Plus daily DREAM and weekly SLEEP flags from the sleepDream cadence.

  tsbc-power.py                         # compute + write state (+ print)
  tsbc-power.py --print                 # print current state only, no recompute
  tsbc-power.py --day-table             # print the controller's 24h mode table
  tsbc-power.py --day-table --date 2026-07-07
"""
import argparse
import json
import os
import subprocess
from datetime import date, datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "tsbc-power-config.json")) as fh:
    CFG = json.load(fh)
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


def parse_args():
    ap = argparse.ArgumentParser(description="Compute or inspect TSBC power state.")
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--print", action="store_true", dest="print_state",
                       help="print the current cached state only")
    group.add_argument("--day-table", action="store_true",
                       help="print the controller's 24-hour mode table using live DB windows")
    ap.add_argument("--date", default=None,
                    help="reference date for --day-table (YYYY-MM-DD, defaults to today in the configured timezone)")
    return ap.parse_args()


def live_window(name):
    safe = name.replace("'", "''")
    win = q(f"SELECT activity_window::text FROM companies WHERE name='{safe}' AND status<>'archived';")
    if not win or not win.strip().startswith("{"):
        return None
    raw = json.loads(win)
    return {
        "name": name,
        "startHour": int(raw["startHour"]),
        "endHour": int(raw["endHour"]),
    }


def active_window_companies(hour):
    active = []
    for name in CFG.get("windowCompanies", []):
        win = live_window(name)
        if win and in_window(hour, win["startHour"], win["endHour"]):
            active.append(win)
    return active


def format_active_companies(entries):
    return [f"{entry['name']} {entry['startHour']:02d}-{entry['endHour']:02d}" for entry in entries]


def adhoc_reasons():
    reasons = []
    if not CFG.get("adhocSprintTriggersLow", True):
        return reasons
    try:
        for fn in sorted(os.listdir(ADHOC_DIR)):
            if not fn.endswith(".json"):
                continue
            try:
                with open(os.path.join(ADHOC_DIR, fn)) as fh:
                    data = json.load(fh)
                reasons.append(f"ad-hoc sprint: {data.get('name', data.get('cid', '?'))}")
            except Exception:
                pass
    except FileNotFoundError:
        pass
    return reasons


def compute_state(now):
    tz = ZoneInfo(CFG.get("tz", "Europe/Dublin"))
    h = now.hour
    active = active_window_companies(h)
    active_labels = format_active_companies(active)
    low_threshold = int(CFG.get("lowWhenActiveCompaniesAtLeast", 3))
    overlap_triggers_low = len(active) >= low_threshold
    adhoc = adhoc_reasons()

    mode = "low" if overlap_triggers_low or adhoc else "normal"
    state = dict(CFG["modes"][mode])
    state["mode"] = mode
    state["activeCompanyCount"] = len(active)
    state["activeCompanies"] = active_labels
    state["lowWhenActiveCompaniesAtLeast"] = low_threshold
    state["overlapTriggersLow"] = overlap_triggers_low
    state["adhocLowTriggers"] = adhoc

    sd = CFG.get("sleepDream", {})
    dream_hour = sd.get("dreamDailyHour")
    dream_duration = max(1, int(sd.get("dreamDurationHours", 1)))
    if isinstance(dream_hour, int):
        state["dream"] = in_window(h, dream_hour, (dream_hour + dream_duration) % 24)
    else:
        state["dream"] = False
    sw = sd.get("sleepWeekly", {})
    state["sleep"] = (now.weekday() == sw.get("weekday") and in_window(h, sw.get("startHour", 0), sw.get("endHour", 0)))
    state["paused"] = bool(state["sleep"])

    overlap_reason = f"{len(active_labels)} active OpCos"
    if active_labels:
        overlap_reason += ": " + ", ".join(active_labels)
    reason_parts = [overlap_reason]
    reason_parts.extend(adhoc)
    if state["sleep"]:
        reason_parts.append("WEEKLY SLEEP (idle)")
    state["reason"] = "; ".join(reason_parts)
    state["updatedAt"] = now.isoformat(timespec="seconds")
    state["timezone"] = str(tz)
    return state


def render_state_line(now, state):
    return (
        f"[tsbc-power {now:%F %H:%M} {CFG.get('tz')}] mode={state['mode']} "
        f"maxWorkers={state['maxWorkers']} heavyTasks={state['heavyTasksAllowed']} "
        f"dream={state['dream']} sleep={state['sleep']} :: {state['reason']}"
    )


def print_day_table(day, tz):
    for hour in range(24):
        now = datetime(day.year, day.month, day.day, hour, 0, tzinfo=tz)
        state = compute_state(now)
        print(render_state_line(now, state))


def main():
    args = parse_args()
    if args.print_state:
        if os.path.exists(STATE):
            with open(STATE) as fh:
                print(fh.read())
        else:
            print("(no state yet)")
        return

    tz = ZoneInfo(CFG.get("tz", "Europe/Dublin"))
    if args.day_table:
        day = date.fromisoformat(args.date) if args.date else datetime.now(tz).date()
        print_day_table(day, tz)
        return

    now = datetime.now(tz)
    state = compute_state(now)
    with open(STATE, "w") as fh:
        json.dump(state, fh, indent=2)

    print(render_state_line(now, state))


if __name__ == "__main__":
    main()
