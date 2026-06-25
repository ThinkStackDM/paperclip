#!/usr/bin/env python3
"""
make_fleet_agent.py — create a LIVE fleet agent by CLONING an existing agent's
company / role / manager / runtime / skills, changing only name + adapter + model
(+ optional extra skills / capabilities). For sister-fallback lanes and front-line
hires. Dry-run by default; --apply executes. Prints the new agent id.

  make_fleet_agent.py --clone "GrowthSEO-Hermes" --name "GrowthSEO-Codex" \
      --adapter codex_local --model gpt-5.4 --maxruns 3 \
      --add-skills "company/<cid>/issue-handling,company/<cid>/context-compression" \
      --capabilities "..." --apply

Adapter mechanics mirror adapter_swap.py (codex: dangerouslyBypassApprovalsAndSandbox
+ modelReasoningEffort; antigravity: command=agy). Talks to the localhost board.
"""
import json, os, subprocess, sys, urllib.request, urllib.error

API = "http://127.0.0.1:3100/api"

def psql(sql):
    out = subprocess.run(
        ["/opt/homebrew/bin/psql", "-h", "127.0.0.1", "-p", "54329", "-U", "paperclip", "-d", "paperclip", "-tA", "-c", sql],
        capture_output=True, text=True, env={**os.environ, "PGPASSWORD": "paperclip"})
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return out.stdout.strip()

def arg(flag, default=None):
    return next((a.split("=", 1)[1] for a in sys.argv if a.startswith(flag + "=")), default)

def build_adapter_config(adapter, model, toolsets):
    cfg = {"model": model, "toolsets": toolsets, "persistSession": False, "graceSec": 15, "timeoutSec": 0}
    if adapter == "codex_local":
        cfg["dangerouslyBypassApprovalsAndSandbox"] = True   # fleet standard: all 35 codex agents carry it
        cfg["modelReasoningEffort"] = "medium"
    elif adapter == "antigravity_local":
        cfg["command"] = "agy"; cfg["sandbox"] = False
    elif adapter == "claude_local":
        cfg["dangerouslySkipPermissions"] = True
    return cfg

def main():
    clone = arg("--clone"); name = arg("--name"); adapter = arg("--adapter"); model = arg("--model")
    add_skills = [s for s in (arg("--add-skills", "") or "").split(",") if s.strip()]
    caps = arg("--capabilities"); maxruns = int(arg("--maxruns", "3"))
    apply = "--apply" in sys.argv
    if not (clone and name and adapter and model):
        print("usage: make_fleet_agent.py --clone=NAME --name=NAME --adapter=A --model=M [--add-skills=..] [--capabilities=..] [--maxruns=N] [--no-ignore-window] [--apply]"); return

    safe = clone.replace("'", "''")
    row = psql(f"SELECT id||chr(9)||company_id||chr(9)||role||chr(9)||COALESCE(reports_to::text,'')||chr(9)||COALESCE(icon,'') FROM agents WHERE name='{safe}' AND status<>'terminated';")
    if not row:
        print(f"clone source not found: {clone}"); return
    tid, cid, role, reports_to, icon = row.split("\t")
    tcfg = json.loads(psql(f"SELECT adapter_config FROM agents WHERE id='{tid}';"))
    toolsets = tcfg.get("toolsets", "terminal,file,web")
    src_rt = json.loads(psql(f"SELECT COALESCE(runtime_config::text,'{{}}') FROM agents WHERE id='{tid}';") or "{}")
    # Failover/sister lanes must pick up work OUTSIDE the company activity window — that's exactly
    # when failover fires. Inherit the clone source's flag; default true for sister hires (the
    # always-on codex/gemini lanes all set it); --no-ignore-window opts out.
    ignore_window = False if "--no-ignore-window" in sys.argv else bool(src_rt.get("ignoreActivityWindow", True))
    base_skills = tcfg.get("paperclipSkillSync", {}).get("desiredSkills", [])
    skills = list(dict.fromkeys(base_skills + add_skills))  # dedup, preserve order
    # keep only universal + same-company skills; drop stale/cross-company refs that 422 at create
    skills = [s for s in skills if s.startswith("paperclipai/") or s.startswith(f"company/{cid}/")]

    role = arg("--role", role)  # optional override (e.g. drafters -> "general")
    body = {
        "name": name, "role": role, "adapterType": adapter,
        "adapterConfig": build_adapter_config(adapter, model, toolsets),
        "desiredSkills": skills,
        "runtimeConfig": {
            "heartbeat": {"enabled": False, "wakeOnDemand": True, "maxConcurrentRuns": maxruns},
            "ignoreActivityWindow": ignore_window,
        },
        "permissions": {"canCreateAgents": False},
    }
    if reports_to: body["reportsTo"] = reports_to
    if icon: body["icon"] = icon
    if caps: body["capabilities"] = caps

    print(f"create {name}: clone={clone} company={cid} role={role} adapter={adapter}/{model} skills={len(skills)} maxruns={maxruns}")
    print(f"  reportsTo={reports_to or '-'} icon={icon or '-'} ignoreActivityWindow={ignore_window}")
    if not apply:
        print("\n(dry-run — pass --apply to create)"); return

    req = urllib.request.Request(f"{API}/companies/{cid}/agents", data=json.dumps(body).encode(),
                                 method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            out = json.loads(resp.read().decode())
        agent = out.get("agent") or out
        print(f"\nHTTP {resp.status} — created {name}  id={agent.get('id')}  status={agent.get('status')}")
    except urllib.error.HTTPError as e:
        print(f"\nHTTP {e.code} ERROR:\n{e.read().decode()[:1200]}"); sys.exit(1)

if __name__ == "__main__":
    main()
