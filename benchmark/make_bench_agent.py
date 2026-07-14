#!/usr/bin/env python3
"""
make_bench_agent.py — create ONE dedicated agentic-bench agent in the isolated Agentic
Bench company, cloning the grok-4.3 bench agent's setup (skills, toolsets, runtime, role,
manager) so only adapterType + model differ — keeping the agentic comparison fair.

  python3 make_bench_agent.py "Bench-claude-opus" claude_local claude-opus-4-8
  python3 make_bench_agent.py "Bench-claude-sonnet-5" claude_local claude-sonnet-5
  python3 make_bench_agent.py --dry-run ...

Talks to the local board (127.0.0.1:3100, localhost-trusted, same as board-api.sh).
Prints the new agent id. Does NOT modify config.json (do that explicitly after verifying).
"""
import json
import subprocess
import sys
import urllib.request

BENCH_COMPANY = "e212ce50-b524-408c-b3d4-0c6108d8c2e2"
TEMPLATE_AGENT = "7fffa42f-467a-4f76-b802-4dc8bd552bd9"  # Bench-grok-4.3
BENCH_MANAGER = "b610338d-b340-48a3-8e73-f2ecd015e4bb"
API = "http://127.0.0.1:3100/api"


def _psql(sql):
    import os
    out = subprocess.run(
        ["/opt/homebrew/bin/psql", "-h", "127.0.0.1", "-p", "54329", "-U", "paperclip", "-d", "paperclip", "-tAF\t", "-c", sql],
        capture_output=True, text=True, env={**os.environ, "PGPASSWORD": "paperclip"},
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return out.stdout.strip()


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv
    name, adapter_type, model = args[0], args[1], args[2]

    tmpl = json.loads(_psql(f"SELECT adapter_config FROM agents WHERE id='{TEMPLATE_AGENT}';"))
    # keep only universal paperclipai/* skills; company/*+local/* refs are scoped to other
    # companies and 422 here (the core agentic 'paperclip' skill is in this set)
    skills = [s for s in tmpl.get("paperclipSkillSync", {}).get("desiredSkills", []) if s.startswith("paperclipai/")]
    toolsets = tmpl.get("toolsets", "terminal,file,web")

    adapter_config = {"model": model, "toolsets": toolsets, "persistSession": False}
    if adapter_type == "antigravity_local":
        adapter_config["command"] = "agy"

    body = {
        "name": name,
        "role": "engineer",
        "reportsTo": BENCH_MANAGER,
        "adapterType": adapter_type,
        "adapterConfig": adapter_config,
        "desiredSkills": skills,
        "runtimeConfig": {"heartbeat": {"enabled": False, "wakeOnDemand": True, "maxConcurrentRuns": 20}},
    }
    print(f"creating {name}: adapterType={adapter_type} model={model} toolsets={toolsets} skills={len(skills)}")
    if dry:
        print("(dry-run — not created)")
        return

    req = urllib.request.Request(
        f"{API}/companies/{BENCH_COMPANY}/agents",
        data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            out = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} ERROR body:\n{e.read().decode()[:1500]}")
        sys.exit(1)
    agent = out.get("agent") or out
    print(f"HTTP {resp.status} — created agent id: {agent.get('id')}  status={agent.get('status')}")


if __name__ == "__main__":
    main()
