#!/usr/bin/env python3
"""
paperclip_lane.py — agentic "Paperclip function" lane for the model benchmark (#15).

The CLI lanes (adapters.py) measure BASE-MODEL ANSWER QUALITY in an isolated temp
dir with the harness stripped out. That is exactly why they could not catch the
failure that motivated this lane: grok-*-fast-non-reasoning scores ~0.96 on
single-shot answer tasks, yet inside the real Paperclip harness it never executes
the multi-step agentic loop (wake -> fetch context -> do work -> PATCH a
disposition -> comment) — it just replies "No response requested." and the case
gets bounced to a sister.

This lane measures the thing that actually matters for a deployed agent:
**does the model, running as a real Paperclip agent, drive a case to a valid
disposition?** For each (case, model) it:

  1. picks the configured bench agent for that model (config.paperclip.agents),
  2. creates a fixture issue assigned to that agent in the bench company,
  3. triggers a fresh-session run (POST /agents/:id/heartbeat/invoke,
     forceFreshSession — no stale "nothing to do" session to resume),
  4. polls the run to a terminal state,
  5. reads the OUTCOME: final issue status, whether a first-class blocker backs a
     `blocked`, whether the agent posted a comment, and the run liveness, then
  6. tears the fixture issue down (status -> cancelled).

The outcome is emitted as a JSON `output` string so the EXISTING deterministic
scorer (scoring.py json_path_equals) scores it straight from the suite rubric —
no new scoring code. Env: PAPERCLIP_API_URL + PAPERCLIP_API_KEY (board token).
"""

import json
import os
import time
import urllib.error
import urllib.request

import benchlib

TERMINAL_RUN_STATUSES = {"succeeded", "failed", "cancelled", "timed_out"}
# A `blocked` disposition is only VALID when backed by a first-class blocker; a
# bare `blocked` (or anything still open/todo) is the missing-disposition smell.
CLEAN_TERMINAL_STATUSES = {"done", "cancelled", "in_review"}
POLL_INTERVAL_SEC = 4


def _base():
    base = (os.environ.get("PAPERCLIP_API_URL") or "").rstrip("/")
    if not base:
        raise RuntimeError("PAPERCLIP_API_URL not set")
    return base


def _key():
    key = os.environ.get("PAPERCLIP_API_KEY") or ""
    if not key:
        raise RuntimeError("PAPERCLIP_API_KEY not set")
    return key


def _req(method, path, body=None, timeout=30):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(_base() + path, method=method, data=data)
    req.add_header("Authorization", "Bearer " + _key())
    run_id = os.environ.get("PAPERCLIP_RUN_ID")
    if run_id:
        req.add_header("X-Paperclip-Run-Id", run_id)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {method} {path}: {detail[:300]}")


def run_case(task, model, cfg, timeout):
    """Run one agentic case for one model. Returns a benchlib-shaped raw result
    whose `output` is a JSON outcome the deterministic scorer can read."""
    pc = cfg.get("paperclip", {}) or {}
    company = pc.get("benchCompanyId")
    agent_id = (pc.get("agents") or {}).get(model["id"])

    res = benchlib.empty_result()
    res["model"] = model.get("model_arg") or model["id"]
    if not company:
        res["error"] = "config.paperclip.benchCompanyId not set"
        return res
    if not agent_id:
        res["error"] = f"no bench agent configured for model {model['id']} (config.paperclip.agents)"
        return res

    spec = task.get("paperclip", {}) or {}
    title = spec.get("title") or task.get("title") or task["id"]
    description = task.get("prompt", "")

    t0 = time.time()
    issue = None
    try:
        issue_body = {
            "title": f"[agentic-bench] {title}",
            "description": description,
            "status": "todo",
            "priority": "medium",
            "assigneeAgentId": agent_id,
        }
        project_id = pc.get("benchProjectId")
        if project_id:
            issue_body["projectId"] = project_id
        issue = _req("POST", f"/api/companies/{company}/issues", issue_body)
        issue_id = issue["id"]

        run = _req("POST", f"/api/agents/{agent_id}/heartbeat/invoke", {
            "forceFreshSession": True,
            "reason": "agentic_bench",
            "payload": {"issueId": issue_id, "taskId": issue_id},
        })
        run_id = run.get("id")
        run_status = run.get("status")

        deadline = time.time() + timeout
        while run_id and run_status not in TERMINAL_RUN_STATUSES and time.time() < deadline:
            time.sleep(POLL_INTERVAL_SEC)
            r = _req("GET", f"/api/heartbeat-runs/{run_id}")
            run_status = r.get("status")

        run_final = _req("GET", f"/api/heartbeat-runs/{run_id}") if run_id else {}
        liveness = run_final.get("livenessState")

        iss = _req("GET", f"/api/issues/{issue_id}")
        final_status = iss.get("status")
        blocker_count = len(iss.get("blockedBy") or [])

        comments = _req("GET", f"/api/issues/{issue_id}/comments")
        clist = comments if isinstance(comments, list) else comments.get("comments", [])
        posted_comment = any(c.get("authorAgentId") == agent_id for c in clist)

        disposition_set = final_status not in (None, "todo", "backlog", "in_progress")
        valid_disposition = (
            final_status in CLEAN_TERMINAL_STATUSES
            or (final_status == "blocked" and blocker_count > 0)
        )
        # The non-reasoning failure mode is a "succeeded" run with no real action.
        concrete_action = bool(liveness) and liveness != "needs_followup"

        outcome = {
            "finalStatus": final_status,
            "runStatus": run_status,
            "dispositionSet": disposition_set,
            "validDisposition": valid_disposition,
            "postedComment": posted_comment,
            "blockerCount": blocker_count,
            "livenessState": liveness,
            "concreteAction": concrete_action,
        }
        res["ok"] = True
        res["output"] = json.dumps(outcome)

        usage = run_final.get("usageJson") or {}
        res["inputTokens"] = usage.get("inputTokens")
        res["outputTokens"] = usage.get("outputTokens")
        total = usage.get("totalTokens")
        if total is None and (usage.get("inputTokens") or usage.get("outputTokens")):
            total = (usage.get("inputTokens") or 0) + (usage.get("outputTokens") or 0)
        res["totalTokens"] = total
        if total is None:
            res["tokensEstimated"] = True
    except Exception as exc:  # never let one cell kill the sweep
        res["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        res["wallMs"] = int((time.time() - t0) * 1000)
        if issue and issue.get("id"):
            try:
                _req("PATCH", f"/api/issues/{issue['id']}", {
                    "status": "cancelled",
                    "comment": "[agentic-bench] fixture teardown",
                })
            except Exception:
                pass
    return res
