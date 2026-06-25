#!/usr/bin/env python3
"""
adapter_swap.py — swap fleet agents from one adapter to another (e.g. hermes_local
-> codex_local). Unlike upgrade_model.py (model-only, same adapter), this REBUILDS
the adapter mechanics while PRESERVING the agent's identity fields (cwd, skills,
instruction paths). Dry-run default; --apply executes. Snapshots a timestamped
rollback file (full adapterType+adapterConfig) before any change.

  adapter_swap.py codex_local gpt-5.4 "TSB Compiler" "MCInboundHandler" [--apply]
  adapter_swap.py antigravity_local "Gemini 3.1 Pro (High)" "GrowthSEO-Gemini" [--apply]

Rollback: re-run with the original adapter+model, OR PATCH each agent with the
snapshot's adapterType/adapterConfig.
"""
import json, os, subprocess, sys, urllib.request, urllib.error
from datetime import datetime, timezone

API = "http://127.0.0.1:3100/api"

def psql(sql):
    return subprocess.run(
        ["/opt/homebrew/bin/psql", "-h", "127.0.0.1", "-p", "54329", "-U", "paperclip", "-d", "paperclip", "-tA", "-c", sql],
        capture_output=True, text=True, env={**os.environ, "PGPASSWORD": "paperclip"}).stdout.strip()

def fetch(name):
    safe = name.replace("'", "''")
    row = psql(f"SELECT id||'\t'||role||'\t'||adapter_type FROM agents WHERE name='{safe}' AND status<>'terminated';")
    if not row:
        return None
    aid, role, adapter = row.split("\t")
    cfg = json.loads(psql(f"SELECT adapter_config FROM agents WHERE id='{aid}';"))
    return {"id": aid, "name": name, "role": role, "adapter": adapter, "cfg": cfg}

def build(to_adapter, to_model, cfg):
    """Return a new adapter_config for the target adapter, preserving identity fields."""
    new = dict(cfg)
    new["model"] = to_model
    new.setdefault("graceSec", 15)
    new.setdefault("timeoutSec", 0)
    if to_adapter == "codex_local":
        new.pop("sandbox", None)
        new.pop("command", None)
        new["dangerouslyBypassApprovalsAndSandbox"] = True
        new.setdefault("modelReasoningEffort", "medium")
    elif to_adapter == "antigravity_local":
        new.pop("dangerouslyBypassApprovalsAndSandbox", None)
        new.pop("modelReasoningEffort", None)
        new["command"] = "agy"
        new["sandbox"] = False
    elif to_adapter == "claude_local":
        new.pop("sandbox", None); new.pop("command", None)
        new["dangerouslySkipPermissions"] = True
    return new

def patch(aid, adapter, cfg):
    body = json.dumps({"adapterType": adapter, "adapterConfig": cfg}).encode()
    req = urllib.request.Request(f"{API}/agents/{aid}", data=body, method="PATCH",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        resp.read()

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    to_adapter, to_model, names = args[0], args[1], args[2:]
    if not names:
        print("usage: adapter_swap.py <to_adapter> <to_model> <agent-name> [more...] [--apply]"); return

    plan = []
    for n in names:
        a = fetch(n)
        if not a:
            print(f"  !! not found: {n}"); continue
        plan.append(a)
    print(f"adapter swap -> {to_adapter} / {to_model}: {len(plan)} agent(s)\n")
    for a in plan:
        print(f"  {a['name']:<22} {a['adapter']}/{a['cfg'].get('model')}  ->  {to_adapter}/{to_model}  (role={a['role']})")
    if not apply:
        print("\n(dry-run — pass --apply to execute)"); return

    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    snap = [{"id": a["id"], "name": a["name"], "adapterType": a["adapter"], "adapterConfig": a["cfg"]} for a in plan]
    rb = f"rollback-adapter-swap-{ts}.json"
    json.dump(snap, open(rb, "w"), indent=2)
    print(f"\nsnapshot -> {rb}\n")

    ok = fail = 0
    for a in plan:
        new = build(to_adapter, to_model, a["cfg"])
        try:
            patch(a["id"], to_adapter, new)
            ok += 1; print(f"  ok   {a['name']}")
        except urllib.error.HTTPError as e:
            fail += 1; print(f"  FAIL {a['name']}: {e.code} {e.read().decode()[:160]}")
        except Exception as e:
            fail += 1; print(f"  FAIL {a['name']}: {str(e)[:160]}")
    print(f"\ndone: {ok} ok, {fail} failed")

if __name__ == "__main__":
    main()
