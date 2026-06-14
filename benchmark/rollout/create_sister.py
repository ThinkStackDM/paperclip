#!/usr/bin/env python3
"""Create a cross-pool sister agent that clones a primary's role instructions + skills.
Dormant wake-on-demand (no idle heartbeat load; available for work + failover)."""
import json, sys, urllib.request, argparse
from pathlib import Path

BASE = "http://127.0.0.1:3100"

ap = argparse.ArgumentParser()
ap.add_argument("--company", required=True)
ap.add_argument("--name", required=True)
ap.add_argument("--role", required=True)
ap.add_argument("--reports-to", default=None)
ap.add_argument("--cwd", required=True)
ap.add_argument("--adapter", default="codex_local")
ap.add_argument("--model", default="gpt-5.5")
ap.add_argument("--skills", default="")  # comma list of refs
ap.add_argument("--instr", required=True)  # path to primary AGENTS.md to clone
ap.add_argument("--icon", default="bot")
a = ap.parse_args()

agents_md = Path(a.instr).read_text()
skills = [s for s in a.skills.split(",") if s.strip()]
payload = {
    "name": a.name,
    "role": a.role,
    "icon": a.icon,
    "adapterType": a.adapter,
    "adapterConfig": {
        "cwd": a.cwd,
        "model": a.model,
        "graceSec": 15,
        "dangerouslyBypassApprovalsAndSandbox": True,
    },
    "desiredSkills": skills,
    "runtimeConfig": {"heartbeat": {"enabled": False, "wakeOnDemand": True, "maxConcurrentRuns": 20}},
    "instructionsBundle": {"entryFile": "AGENTS.md", "files": {"AGENTS.md": agents_md}},
}
if a.reports_to:
    payload["reportsTo"] = a.reports_to

req = urllib.request.Request(
    f"{BASE}/api/companies/{a.company}/agents",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read().decode())
        print(f"OK  {a.name}: id={body.get('id','?')} status={body.get('status','?')} adapter={body.get('adapterType','?')}")
except urllib.error.HTTPError as e:
    print(f"FAIL {a.name}: HTTP {e.code} {e.read().decode()[:300]}")
except Exception as e:
    print(f"FAIL {a.name}: {e}")
