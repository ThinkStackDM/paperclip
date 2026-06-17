#!/usr/bin/env python3
"""
paperclip_lane.py — agentic "Paperclip function" lane for the model benchmark (#15).

The CLI lanes (adapters.py) measure BASE-MODEL ANSWER QUALITY in an isolated temp
dir with the harness stripped out — which is why they could not catch the failure
that motivated this lane: grok-*-fast-non-reasoning scores ~0.96 on single-shot
answer tasks, yet inside the real Paperclip harness it may never execute the
multi-step agentic loop (wake -> read -> work -> create child / set blocker /
open a review -> set a disposition). This lane measures THAT.

For each (stage, model) it:
  1. picks the configured DEDICATED bench agent for that model (config.paperclip.agents),
  2. creates a fixture issue assigned to that agent in the bench project, optionally
     pre-seeded into a starting state (`paperclip.setup`: initialStatus / seedComment /
     seedBlockerTitle) so stages can test review/blocked/idempotent starting points,
  3. triggers a fresh-session run (forceFreshSession — no stale session to resume),
  4. polls the run to terminal,
  5. gathers a RICH outcome (final status, comment + content, children created,
     first-class blockers, thread interactions, plan documents, reassignment,
     liveness) and emits it as a JSON `output`, plus a set of boolean facts so the
     EXISTING deterministic json_path_equals scorer grades each stage straight from
     its suite rubric — no new scoring code,
  6. tears the fixture (and any children it spawned) down to `cancelled`.

Env: PAPERCLIP_API_URL + PAPERCLIP_API_KEY (board token).
"""

import json
import os
import time
import urllib.error
import urllib.request

import benchlib

TERMINAL_RUN_STATUSES = {"succeeded", "failed", "cancelled", "timed_out"}
# A `blocked` disposition is VALID only when backed by a first-class blocker.
CLEAN_TERMINAL_STATUSES = {"done", "cancelled", "in_review"}
OPEN_STATUSES = "todo,in_progress,in_review,blocked,done,cancelled"
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


TRANSIENT_HTTP = {500, 502, 503, 504}
SOCKET_TIMEOUT_SEC = 45
# 5 attempts w/ 1.5s-step backoff (~15s) tolerates a brief server reload/bounce
# (ECONNREFUSED) on the shared box without failing a cell.
MAX_ATTEMPTS = 5


def _req(method, path, body=None, timeout=SOCKET_TIMEOUT_SEC):
    """Resilient request: retries transient timeouts / 5xx with backoff, so a single
    slow response under concurrent agentic load doesn't kill a whole bench cell."""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    run_id = os.environ.get("PAPERCLIP_RUN_ID")
    last = None
    for attempt in range(MAX_ATTEMPTS):
        req = urllib.request.Request(_base() + path, method=method, data=data)
        req.add_header("Authorization", "Bearer " + _key())
        if run_id:
            req.add_header("X-Paperclip-Run-Id", run_id)
        if body is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            if exc.code in TRANSIENT_HTTP and attempt < MAX_ATTEMPTS - 1:
                last = exc
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    raise last if last else RuntimeError("request failed")


def _opt(method, path, body=None, timeout=SOCKET_TIMEOUT_SEC):
    """_req but returns None on 4xx (endpoint absent / forbidden) instead of raising."""
    try:
        return _req(method, path, body, timeout)
    except urllib.error.HTTPError as exc:
        if 400 <= exc.code < 500:
            return None
        raise


def _aslist(payload, key="issues"):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get(key) or payload.get("items") or []
    return []


def sweep_bench_fixtures(cfg):
    """Cancel any leftover OPEN fixtures in the bench project — orphans a killed
    run couldn't tear down (incl. agent-spawned children + pending board cards).
    Best-effort; returns the count cancelled. Run before a sweep so fixtures and
    board-action notices never accumulate in the live company."""
    pc = cfg.get("paperclip", {}) or {}
    company, project = pc.get("benchCompanyId"), pc.get("benchProjectId")
    if not (company and project):
        return 0
    n = 0
    try:
        xs = _aslist(_opt(
            "GET", f"/api/companies/{company}/issues?projectId={project}&status={OPEN_STATUSES}&limit=200",
        ) or [], "issues")
        for i in xs:
            try:
                _opt("PATCH", f"/api/issues/{i['id']}", {"status": "cancelled", "comment": "[agentic-bench] pre-run sweep"})
                n += 1
            except Exception:
                pass
    except Exception:
        pass
    return n


def run_case(task, model, cfg, timeout):
    pc = cfg.get("paperclip", {}) or {}
    company = pc.get("benchCompanyId")
    project = pc.get("benchProjectId")
    agent_id = (pc.get("agents") or {}).get(model["id"])

    res = benchlib.empty_result()
    res["model"] = model.get("model_arg") or model["id"]
    if not company:
        res["error"] = "config.paperclip.benchCompanyId not set"
        return res
    if not agent_id:
        res["error"] = f"no bench agent configured for model {model['id']}"
        return res

    spec = task.get("paperclip", {}) or {}
    setup = spec.get("setup", {}) or {}
    expect = spec.get("expect", {}) or {}
    title = spec.get("title") or task.get("title") or task["id"]
    description = task.get("prompt", "")

    t0 = time.time()
    trigger_ts = None
    issue_id = None
    seeded_child_id = None
    try:
        body = {
            "title": f"[agentic-bench] {title}",
            "description": description,
            "status": setup.get("initialStatus", "todo"),
            "priority": "medium",
            "assigneeAgentId": agent_id,
        }
        if project:
            body["projectId"] = project
        issue = _req("POST", f"/api/companies/{company}/issues", body)
        issue_id = issue["id"]

        # Optional pre-seed: a prior board comment + a real first-class blocker, so a
        # stage can start from a blocked/idempotent posture.
        if setup.get("seedComment"):
            _opt("POST", f"/api/issues/{issue_id}/comments", {"body": setup["seedComment"]})
        if setup.get("seedBlockerTitle"):
            child = _opt("POST", f"/api/companies/{company}/issues", {
                "title": f"[agentic-bench] {setup['seedBlockerTitle']}",
                "description": "Seeded blocker fixture.",
                "status": "todo",
                "priority": "medium",
                **({"projectId": project} if project else {}),
            })
            if isinstance(child, dict) and child.get("id"):
                seeded_child_id = child["id"]
                _opt("PATCH", f"/api/issues/{issue_id}", {"blockedByIssueIds": [seeded_child_id]})

        trigger_ts = time.time()
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
            run_status = (_req("GET", f"/api/heartbeat-runs/{run_id}") or {}).get("status")

        run_final = _req("GET", f"/api/heartbeat-runs/{run_id}") if run_id else {}
        liveness = run_final.get("livenessState")

        iss = _req("GET", f"/api/issues/{issue_id}")
        final_status = iss.get("status")
        blocker_count = len(iss.get("blockedBy") or [])
        # exclude the seeded blocker so we measure blockers the AGENT added
        agent_blocker_count = blocker_count - (1 if seeded_child_id else 0)
        assignee_now = iss.get("assigneeAgentId")
        assignee_changed_away = bool(assignee_now) and assignee_now != agent_id

        # comments the AGENT posted after the run started
        clist = _aslist(_opt("GET", f"/api/issues/{issue_id}/comments") or [], "comments")
        # Only the agent's own comments count (seeded board comments are authored by
        # the board, so a no-churn stage that leaves the issue untouched stays false).
        agent_comments = [c for c in clist if c.get("authorAgentId") == agent_id]
        posted_comment = len(agent_comments) > 0
        want = expect.get("commentContains")
        comment_contains = bool(want) and any(
            str(want).lower() in (c.get("body") or "").lower() for c in agent_comments
        )

        # children the agent created (parentId == fixture), excluding the seeded blocker
        proj_issues = _aslist(_opt(
            "GET",
            f"/api/companies/{company}/issues?projectId={project}&status={OPEN_STATUSES}&limit=200",
        ) or [], "issues") if project else []
        children = [i for i in proj_issues
                    if i.get("parentId") == issue_id and i.get("id") != seeded_child_id]
        child_count = len(children)
        child_assigned_count = sum(1 for c in children if c.get("assigneeAgentId"))

        # thread interactions (request_confirmation / ask_user_questions) the agent opened
        ints = _aslist(_opt("GET", f"/api/issues/{issue_id}/interactions") or [], "interactions")
        int_kinds = sorted({i.get("kind") for i in ints if i.get("kind")})
        has_confirmation = "request_confirmation" in int_kinds
        has_questions = "ask_user_questions" in int_kinds

        # plan / issue documents
        docs = _aslist(_opt("GET", f"/api/issues/{issue_id}/documents") or [], "documents")
        doc_keys = sorted({d.get("key") for d in docs if d.get("key")})
        has_plan_doc = "plan" in doc_keys

        # board approvals linked to the issue
        appr = _aslist(_opt("GET", f"/api/issues/{issue_id}/approvals") or [], "approvals")
        approval_count = len(appr)

        disposition_set = final_status not in (None, "todo", "backlog", "in_progress")
        valid_disposition = (
            final_status in CLEAN_TERMINAL_STATUSES
            or (final_status == "blocked" and blocker_count > 0)
        )
        concrete_action = bool(liveness) and liveness != "needs_followup"

        outcome = {
            "finalStatus": final_status,
            "runStatus": run_status,
            "livenessState": liveness,
            "dispositionSet": disposition_set,
            "validDisposition": valid_disposition,
            "concreteAction": concrete_action,
            "postedComment": posted_comment,
            "commentContains": comment_contains,
            "hasChild": child_count > 0,
            "hasAssignedChild": child_assigned_count > 0,
            "hasTwoPlusChildren": child_count >= 2,
            "childCount": child_count,
            "routedToOwner": assignee_changed_away or child_assigned_count > 0,
            "hasBlocker": agent_blocker_count > 0,
            "blockerCount": blocker_count,
            "hasConfirmationInteraction": has_confirmation,
            "hasQuestionsInteraction": has_questions,
            "hasPlanDocument": has_plan_doc,
            "hasApproval": approval_count > 0,
            "assigneeChangedAway": assignee_changed_away,
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
    except urllib.error.HTTPError as exc:
        res["error"] = f"HTTP {exc.code}: {exc.read().decode('utf-8','replace')[:200]}"
    except Exception as exc:
        res["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        res["wallMs"] = int((time.time() - t0) * 1000)
        # teardown: cancel the fixture, the seeded blocker, and any spawned children.
        # MUST be bulletproof — a transient server blip here must never escape the
        # finally and mask an otherwise-captured result (the earlier "harness
        # exception" bug). Best-effort only; leftover fixtures are swept separately.
        def _cancel(iid):
            try:
                _opt("PATCH", f"/api/issues/{iid}", {"status": "cancelled", "comment": "[agentic-bench] teardown"})
            except Exception:
                pass
        try:
            for iid in [issue_id, seeded_child_id]:
                if iid:
                    _cancel(iid)
            if issue_id and project:
                proj = _aslist(_opt(
                    "GET",
                    f"/api/companies/{company}/issues?projectId={project}&status={OPEN_STATUSES}&limit=200",
                ) or [], "issues")
                for i in proj:
                    if i.get("parentId") == issue_id and i.get("status") not in ("cancelled", "done"):
                        _cancel(i["id"])
        except Exception:
            pass
    return res
