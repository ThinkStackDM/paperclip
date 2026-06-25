#!/usr/bin/env python3
"""
upgrade_model.py — reassign live fleet agents from one model to another (lane rollout).
Dry-run by default; --apply to execute. Snapshots current state to a rollback file first.
Sends each agent's FULL adapter_config with only `model` swapped (safe vs merge/replace).
Excludes the isolated Agentic Bench company. Localhost board (127.0.0.1:3100).

  python3 upgrade_model.py claude-opus-4-7 claude-opus-4-8            # dry-run (list)
  python3 upgrade_model.py claude-opus-4-7 claude-opus-4-8 --apply    # execute
"""
import json, subprocess, sys, urllib.request, urllib.error

BENCH="e212ce50-b524-408c-b3d4-0c6108d8c2e2"
API="http://127.0.0.1:3100/api"

def psql(sql):
    import os
    return subprocess.run(["/opt/homebrew/bin/psql","-h","127.0.0.1","-p","54329","-U","paperclip","-d","paperclip","-tAF\t","-c",sql],
        capture_output=True,text=True,env={**os.environ,"PGPASSWORD":"paperclip"}).stdout.strip()

def main():
    args=[a for a in sys.argv[1:] if not a.startswith("--")]
    apply="--apply" in sys.argv
    role=next((a.split("=",1)[1] for a in sys.argv if a.startswith("--role=")),None)
    only=next((a.split("=",1)[1] for a in sys.argv if a.startswith("--only=")),None)  # comma agent-name substr filter
    excl=next((a.split("=",1)[1] for a in sys.argv if a.startswith("--exclude=")),None)  # comma name/company substr to DROP
    frm,to=args[0],args[1]
    rolef=f" AND a.role='{role}'" if role else ""
    rows=[r for r in psql(
        f"SELECT a.id, a.name, coalesce(c.name,'?') FROM agents a LEFT JOIN companies c ON c.id=a.company_id "
        f"WHERE a.status::text<>'terminated' AND a.company_id<>'{BENCH}' AND a.adapter_config->>'model'='{frm}'{rolef} "
        f"ORDER BY 3,2;").splitlines() if r.strip()]
    if only:
        subs=[s.strip().lower() for s in only.split(",")]
        rows=[r for r in rows if any(s in r.split(chr(9))[1].lower() for s in subs)]
    if excl:
        ex=[s.strip().lower() for s in excl.split(",")]
        rows=[r for r in rows if not any((s in r.split(chr(9))[1].lower()) or (s in r.split(chr(9))[2].lower()) for s in ex)]
    print(f"{frm} -> {to}: {len(rows)} agents")
    for r in rows:
        aid,name,co=r.split("\t")
        print(f"  {co:<22}{name}")
    if not apply:
        print("\n(dry-run — pass --apply to execute)"); return

    # snapshot for rollback
    snap=[]
    for r in rows:
        aid=r.split("\t")[0]
        cfg=json.loads(psql(f"SELECT adapter_config FROM agents WHERE id='{aid}';"))
        snap.append({"id":aid,"name":r.split(chr(9))[1],"oldModel":cfg.get("model"),"adapterConfig":cfg})
    rbfile=f"rollback-{frm}-to-{to}.json".replace("/","_")
    json.dump(snap,open(rbfile,"w"),indent=2)
    print(f"\nsnapshot -> {rbfile}")

    ok=fail=0
    for s in snap:
        cfg=dict(s["adapterConfig"]); cfg["model"]=to
        body=json.dumps({"adapterConfig":cfg}).encode()
        req=urllib.request.Request(f"{API}/agents/{s['id']}",data=body,method="PATCH",headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=60) as resp:
                resp.read()
            ok+=1; print(f"  ok  {s['name']}")
        except urllib.error.HTTPError as e:
            fail+=1; print(f"  FAIL {s['name']}: {e.code} {e.read().decode()[:150]}")
    print(f"\ndone: {ok} ok, {fail} failed")

if __name__=="__main__":
    main()
