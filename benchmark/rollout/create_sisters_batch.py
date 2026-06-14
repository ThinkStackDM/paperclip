#!/usr/bin/env python3
"""Batch-create cross-pool codex sisters for single-lane worker agents.
Clones each primary's AGENTS.md + sets desiredSkills to parity. Dormant wake-on-demand.
Idempotent: skips if the sister already exists."""
import json, os, subprocess, urllib.request, urllib.error
from pathlib import Path

BASE = "http://127.0.0.1:3100"
PG = ["/opt/homebrew/bin/psql", "-h127.0.0.1", "-p54329", "-U", "paperclip", "-d", "paperclip", "-tA", "-F", "\t"]

TSB="baba1235-7f5b-4555-aed8-c06efa095125"; TSM="d71c9e82-1a4b-497f-9bbc-5b9dd028c367"
TSR="cefbbf68-0ca7-4383-967e-03bc1b037ae7"; DP="e7507bfa-ecfd-4dde-bd2a-7b19947ffdde"

TARGETS = [
    (TSB,"Author"),(TSB,"Editor"),(TSB,"Architect"),(TSB,"Designer"),(TSB,"Researcher"),
    (TSM,"ContentStrategist"),(TSM,"Coder"),
    (TSR,"CandidateIntakeSpecialist"),(TSR,"JobSourcer"),(TSR,"RecruitmentManager"),
    (DP,"RoutingPA"),
]

def q(sql):
    out = subprocess.run(PG+["-c", sql], env={**os.environ, "PGPASSWORD":"paperclip"},
                         capture_output=True, text=True)
    if out.returncode != 0 and out.stderr.strip():
        print(f"  [psql err] {out.stderr.strip()[:160]}")
    return out.stdout.strip()

def company_cwd(cid):
    return q(f"SELECT adapter_config->>'cwd' FROM agents WHERE company_id='{cid}' AND adapter_type='codex_local' AND adapter_config->>'cwd' IS NOT NULL AND adapter_config->>'cwd'<>'' LIMIT 1;")

for cid, primary in TARGETS:
    sister = f"{primary}-Codex"
    exists = q(f"SELECT 1 FROM agents WHERE company_id='{cid}' AND name='{sister}' AND status<>'terminated' LIMIT 1;")
    if exists.strip() == "1":
        print(f"SKIP {sister}: already exists"); continue
    row = q(f"SELECT role || '\t' || COALESCE(reports_to::text,'') || '\t' || COALESCE(adapter_config->>'instructionsFilePath','') || '\t' || COALESCE(adapter_config->'paperclipSkillSync'->>'desiredSkills','[]') FROM agents WHERE company_id='{cid}' AND name='{primary}' AND status<>'terminated' LIMIT 1;")
    if not row:
        print(f"FAIL {sister}: primary '{primary}' not found"); continue
    parts = row.split("\t")
    role, reports_to, instr, skills_json = (parts+["","","","[]"])[:4]
    cwd = company_cwd(cid)  # may be empty (e.g. TSB) — adapter uses its default
    # instructions: clone primary's AGENTS.md, else stub
    if instr and Path(instr).is_file():
        agents_md = Path(instr).read_text()
    else:
        agents_md = f"You are agent {sister} at company {cid}, the cross-pool fallback sister for {primary}.\n\nFollow the Paperclip skill for the heartbeat procedure. Perform the {primary} role; work only on tasks assigned or handed to you.\n"
    try:
        skills = json.loads(skills_json) if skills_json.strip().startswith("[") else []
    except Exception:
        skills = []
    adapter_cfg = {"model": "gpt-5.5", "graceSec": 15, "dangerouslyBypassApprovalsAndSandbox": True}
    if cwd:
        adapter_cfg["cwd"] = cwd
    payload = {
        "name": sister, "role": role if role else "general", "icon": "bot",
        "adapterType": "codex_local",
        "adapterConfig": adapter_cfg,
        "desiredSkills": skills,
        "runtimeConfig": {"heartbeat": {"enabled": False, "wakeOnDemand": True, "maxConcurrentRuns": 20}},
        "instructionsBundle": {"entryFile": "AGENTS.md", "files": {"AGENTS.md": agents_md}},
    }
    if reports_to:
        payload["reportsTo"] = reports_to
    req = urllib.request.Request(f"{BASE}/api/companies/{cid}/agents", data=json.dumps(payload).encode(),
                                 headers={"Content-Type":"application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = json.loads(r.read().decode()); newid = body.get("id")
        # enforce parity skills (create endpoint auto-expands to all bundled)
        skj = json.dumps(skills).replace("'","''")
        q(f"UPDATE agents SET adapter_config = jsonb_set(adapter_config,'{{paperclipSkillSync,desiredSkills}}','{skj}'::jsonb), updated_at=now() WHERE id='{newid}';")
        print(f"OK   {sister}: id={newid} role={role} skills={len(skills)} (parity)")
    except urllib.error.HTTPError as e:
        print(f"FAIL {sister}: HTTP {e.code} {e.read().decode()[:200]}")
    except Exception as e:
        print(f"FAIL {sister}: {e}")
