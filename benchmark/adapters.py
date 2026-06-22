#!/usr/bin/env python3
"""
adapters.py — one function per model CLI lane. Each takes a prompt + the model's
config row and returns benchlib.empty_result()-shaped dict (output + normalized
token usage + wall time). All run in a fresh, empty temp CWD so the local repo's
CLAUDE.md / AGENTS.md / rules don't leak in — we want the base model, not the
local agent harness (#16 measures the harness; #15 measures the model).

Lanes:
  claude  ->  claude -p ... --output-format json     (usage in JSON)
  codex   ->  codex exec ... --json -o last.txt       (cumulative usage in JSONL events)
  gemini  ->  gemini -p ... -o json                   (usage in stats block)
  hermes  ->  hermes -z ...                            (text only; tokens via sessions export)
"""

import json
import re
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import benchlib

# hermes attributes token usage by diffing the shared session store before/after a
# run. Concurrent hermes runs (grok-4.3 + grok-4.20 share this CLI and run the SAME
# prompt) would race and cross-attribute sessions. Serialize the snapshot+run so each
# hermes session is unambiguously the one just created, then match by recorded model.
_HERMES_LOCK = threading.Lock()

# codex (ChatGPT-OAuth) rate-limits concurrent requests against the single shared
# token (and the live Paperclip fleet competes for it too): parallel `codex exec`
# calls hang until the timeout. Serialize them — serial codex calls return in seconds.
_CODEX_LOCK = threading.Lock()

# agy is a heavy 142MB binary; cap concurrent antigravity calls on the shared Mac.
_AGY_SEM = threading.BoundedSemaphore(2)


def run_model(prompt, model_row, adapters_cfg, timeout_sec):
    """Dispatch to the right adapter by model_row['adapter']."""
    adapter = model_row["adapter"]
    extra = list((adapters_cfg.get(adapter) or {}).get("extra_args", []))
    # per-model reasoning effort (matches how Paperclip's codex adapter runs spark:
    # `-c model_reasoning_effort="high"`). Optional; only codex consumes it today.
    effort = model_row.get("reasoning_effort")
    if effort and adapter == "codex":
        extra += ["-c", f'model_reasoning_effort="{effort}"']
    fn = {
        "claude": _run_claude,
        "codex": _run_codex,
        "gemini": _run_gemini,
        "hermes": _run_hermes,
        "antigravity": _run_antigravity,
    }.get(adapter)
    if fn is None:
        r = benchlib.empty_result()
        r["error"] = f"unknown adapter {adapter!r}"
        return r
    return fn(prompt, model_row.get("model_arg"), extra, timeout_sec)


# --------------------------------------------------------------------------

def _exec(cmd, timeout_sec, cwd, stdin=None, env=None):
    """Run argv (no shell), return (returncode, stdout, stderr, wall_ms, timed_out)."""
    run_env = None
    if env:
        import os
        run_env = {**os.environ, **env}
    t0 = time.time()
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, input=stdin, capture_output=True, text=True,
            timeout=timeout_sec, env=run_env,
        )
        wall = int((time.time() - t0) * 1000)
        return proc.returncode, proc.stdout, proc.stderr, wall, False
    except subprocess.TimeoutExpired as e:
        wall = int((time.time() - t0) * 1000)
        out = e.stdout or ""
        err = e.stderr or ""
        if isinstance(out, bytes):
            out = out.decode("utf-8", "replace")
        if isinstance(err, bytes):
            err = err.decode("utf-8", "replace")
        return None, out, err, wall, True


def _tail(s, n=600):
    s = (s or "").strip()
    return s[-n:] if len(s) > n else s


# --------------------------------------------------------------------------
# claude
# --------------------------------------------------------------------------

def _run_claude(prompt, model_arg, extra, timeout_sec):
    r = benchlib.empty_result()
    with tempfile.TemporaryDirectory(prefix="bench-claude-") as cwd:
        # Pass the prompt on STDIN, not as a `-p <arg>`: the claude CLI exits 1 on large
        # prompt arguments (~2k+ chars), which silently failed every with-skills/agent-file
        # cell. STDIN handles any size and keeps the prompt out of the logged argv.
        cmd = ["claude", "-p", "--output-format", "json"]
        if model_arg:
            cmd += ["--model", model_arg]
        cmd += list(extra)
        r["cmd"] = cmd[:4] + (["--model", model_arg] if model_arg else [])
        rc, out, err, wall, timed_out = _exec(cmd, timeout_sec, cwd, stdin=prompt)
        r["wallMs"] = wall
        r["stderrTail"] = _tail(err)
        if timed_out:
            r["error"] = "timeout"
            return r
        j = benchlib._try_json(out.strip()) or benchlib.extract_json(out)
        if not isinstance(j, dict):
            r["error"] = f"claude: unparseable output (rc={rc})"
            r["output"] = out[:2000]
            return r
        r["output"] = j.get("result") or ""
        if j.get("is_error"):
            r["error"] = f"claude reported error: {str(j.get('result'))[:200]}"
        usage = j.get("usage") or {}
        inp = usage.get("input_tokens")
        cache = (usage.get("cache_read_input_tokens") or 0) + (usage.get("cache_creation_input_tokens") or 0)
        outp = usage.get("output_tokens")
        r["inputTokens"] = (inp or 0) + cache if (inp is not None or cache) else None
        r["cacheTokens"] = cache or None
        r["outputTokens"] = outp
        if r["inputTokens"] is not None or outp is not None:
            r["totalTokens"] = (r["inputTokens"] or 0) + (outp or 0)
        r["costUsd"] = j.get("total_cost_usd")
        mu = j.get("modelUsage") or {}
        r["model"] = j.get("model") or (next(iter(mu)) if mu else model_arg)
        r["ok"] = bool(r["output"]) and not r["error"]
        return r


# --------------------------------------------------------------------------
# codex
# --------------------------------------------------------------------------

def _run_codex(prompt, model_arg, extra, timeout_sec):
    r = benchlib.empty_result()
    with tempfile.TemporaryDirectory(prefix="bench-codex-") as cwd:
        last = Path(cwd) / "_last.txt"
        # Pass the prompt on STDIN (`exec -` reads instructions from stdin), not as a positional
        # argv. With-skills/agent-file prompts wrap blocks in "--- BEGIN ... ---" markers; codex's
        # clap parser reads the leading "--" as an unknown flag and exits rc=2 BEFORE the model runs
        # (verified 2026-06-22 — this, not an agentic-derail, was the "codex hard-fails on large
        # prompts" signal). stdin sidesteps arg-parsing entirely and keeps the prompt out of argv.
        cmd = ["codex", "exec", "-", "--json", "-o", str(last)]
        if model_arg:
            cmd += ["-m", model_arg]
        cmd += list(extra)
        r["cmd"] = ["codex", "exec", "-", "--json"] + (["-m", model_arg] if model_arg else [])
        with _CODEX_LOCK:  # serialize: concurrent ChatGPT-OAuth codex calls hang
            rc, out, err, wall, timed_out = _exec(cmd, timeout_sec, cwd, stdin=prompt)
        r["wallMs"] = wall
        r["stderrTail"] = _tail(err)
        # final message: prefer -o file, else last agent_message event on stdout
        if last.exists():
            r["output"] = last.read_text(errors="replace").strip()
        # parse JSONL events for output (fallback) + cumulative token usage
        events = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            ev = benchlib._try_json(line)
            if ev is not None:
                events.append(ev)
        if not r["output"]:
            r["output"] = _codex_last_message(events)
        # cumulative usage: take the LAST token node found across events
        nodes = []
        for ev in events:
            nodes += benchlib.find_token_nodes(ev)
        if nodes:
            n = nodes[-1]
            r["inputTokens"] = n["input"]
            r["outputTokens"] = n["output"]
            r["totalTokens"] = n["total"] or ((n["input"] or 0) + (n["output"] or 0)) or None
        r["model"] = _codex_model(events) or model_arg
        if timed_out:
            r["error"] = "timeout"
        elif rc not in (0, None) and not r["output"]:
            r["error"] = f"codex: rc={rc}"
        r["ok"] = bool(r["output"]) and not r["error"]
        return r


def _codex_last_message(events):
    msg = ""
    for ev in events:
        t = str(ev.get("type", "")).lower()
        if "message" in t or t.endswith("completed"):
            for key in ("message", "text", "content", "last_agent_message"):
                v = ev.get(key)
                if isinstance(v, str) and v.strip():
                    msg = v.strip()
            item = ev.get("item")
            if isinstance(item, dict):
                for key in ("text", "message", "content"):
                    v = item.get(key)
                    if isinstance(v, str) and v.strip():
                        msg = v.strip()
    return msg


def _codex_model(events):
    for ev in events:
        for key in ("model", "model_slug"):
            v = ev.get(key)
            if isinstance(v, str) and v:
                return v
        info = ev.get("info") or ev.get("session") or {}
        if isinstance(info, dict):
            for key in ("model", "model_slug"):
                v = info.get(key)
                if isinstance(v, str) and v:
                    return v
    return None


# --------------------------------------------------------------------------
# antigravity (agy) — Google's supported replacement for the retired gemini CLI
# --------------------------------------------------------------------------

def _run_antigravity(prompt, model_arg, extra, timeout_sec):
    """Antigravity (`agy`) CLI. Selects a model by its display-name string, e.g.
    'Gemini 3.5 Flash (Medium)'. Print mode returns plain text only (no usage JSON),
    so tokens are ESTIMATED and flagged. Runs in a neutralized temp CWD. agy is a heavy
    142MB binary; cap concurrency on the shared Mac via _AGY_SEM."""
    r = benchlib.empty_result()
    with _AGY_SEM, tempfile.TemporaryDirectory(prefix="bench-agy-") as cwd:
        cmd = ["agy", "-p", prompt]
        if model_arg:
            cmd += ["--model", model_arg]
        cmd += list(extra)
        r["cmd"] = ["agy", "-p", "<prompt>"] + (["--model", model_arg] if model_arg else [])
        rc, out, err, wall, timed_out = _exec(cmd, timeout_sec, cwd)
        r["wallMs"] = wall
        r["stderrTail"] = _tail(err)
        r["output"] = (out or "").strip()
        if timed_out:
            r["error"] = "timeout"
        elif rc not in (0, None) and not r["output"]:
            r["error"] = f"agy: rc={rc}: {_tail(err, 160)}"
        r["model"] = model_arg
        # agy print mode emits no usage JSON -> estimate tokens (flagged)
        r["inputTokens"] = benchlib.estimate_tokens(prompt)
        r["outputTokens"] = benchlib.estimate_tokens(r["output"])
        r["tokensEstimated"] = True
        r["totalTokens"] = (r["inputTokens"] or 0) + (r["outputTokens"] or 0) or None
        r["ok"] = bool(r["output"]) and not r["error"]
        return r


# --------------------------------------------------------------------------
# gemini
# --------------------------------------------------------------------------

def _run_gemini(prompt, model_arg, extra, timeout_sec):
    r = benchlib.empty_result()
    with tempfile.TemporaryDirectory(prefix="bench-gemini-") as cwd:
        cmd = ["gemini", "-p", prompt, "-o", "json"]
        if model_arg:
            cmd += ["-m", model_arg]
        cmd += list(extra)
        r["cmd"] = ["gemini", "-p", "<prompt>", "-o", "json"] + (["-m", model_arg] if model_arg else [])
        # neutralized temp CWD is "untrusted" -> gemini refuses headless without this
        rc, out, err, wall, timed_out = _exec(
            cmd, timeout_sec, cwd, env={"GEMINI_CLI_TRUST_WORKSPACE": "true"})
        r["wallMs"] = wall
        r["stderrTail"] = _tail(err)
        if timed_out:
            r["error"] = "timeout"
            return r
        j = benchlib._try_json(out.strip()) or benchlib.extract_json(out)
        if not isinstance(j, dict):
            r["error"] = f"gemini: unparseable output (rc={rc})"
            r["output"] = out[:2000]
            return r
        r["output"] = (j.get("response") or j.get("text") or "").strip()
        model_name, inp, outp, tot = _gemini_usage(j.get("stats") or {})
        r["model"] = model_name or model_arg
        r["inputTokens"] = inp
        r["outputTokens"] = outp
        r["totalTokens"] = tot
        r["ok"] = bool(r["output"])
        if not r["output"]:
            r["error"] = "gemini: empty response"
        return r


def _gemini_usage(stats):
    """
    gemini -o json nests stats.models.<name>.tokens with EXACT fields:
      input/prompt, candidates, thoughts, total, cached, tool.
    The same block is duplicated under roles.main.tokens, so read it directly
    (do NOT walk+sum, which double-counts). output = total - input (candidates +
    thoughts), which captures reasoning tokens too.
    """
    models = stats.get("models")
    if not isinstance(models, dict) or not models:
        return None, None, None, None
    # pick the model that actually did work (max total tokens)
    def _tot(v):
        return ((v or {}).get("tokens") or {}).get("total") or 0
    name = max(models, key=lambda k: _tot(models[k]))
    tokens = (models[name] or {}).get("tokens") or {}
    inp = tokens.get("input") if tokens.get("input") is not None else tokens.get("prompt")
    tot = tokens.get("total")
    if tot is None:
        cand = tokens.get("candidates") or 0
        th = tokens.get("thoughts") or 0
        tot = (inp or 0) + cand + th if inp is not None else None
    outp = (tot - inp) if (tot is not None and inp is not None) else tokens.get("candidates")
    return name, inp, outp, tot


# --------------------------------------------------------------------------
# hermes (grok via xAI OAuth)
# --------------------------------------------------------------------------

_SESS_ID_RE = re.compile(r"\b(\d{8}_\d{6}_[0-9a-f]{4,})\b")


def _hermes_session_ids():
    try:
        proc = subprocess.run(["hermes", "sessions", "list"],
                              capture_output=True, text=True, timeout=30)
    except Exception:
        return []
    return _SESS_ID_RE.findall(proc.stdout)


def _run_hermes(prompt, model_arg, extra, timeout_sec):
    r = benchlib.empty_result()
    # serialize snapshot+run so the new-session diff is unambiguous (see _HERMES_LOCK)
    with _HERMES_LOCK:
        before = set(_hermes_session_ids())
        with tempfile.TemporaryDirectory(prefix="bench-hermes-") as cwd:
            cmd = ["hermes", "-z", prompt]
            if model_arg:
                cmd += ["-m", model_arg]
            cmd += list(extra)
            r["cmd"] = ["hermes", "-z", "<prompt>"] + (["-m", model_arg] if model_arg else [])
            rc, out, err, wall, timed_out = _exec(cmd, timeout_sec, cwd)
            r["wallMs"] = wall
            r["stderrTail"] = _tail(err)
            r["output"] = (out or "").strip()
            if timed_out:
                r["error"] = "timeout"
            elif rc not in (0, None) and not r["output"]:
                r["error"] = f"hermes: rc={rc}"
        after = _hermes_session_ids()
        new_ids = sorted([s for s in after if s not in before], reverse=True)  # newest first

    # identify the run's session (export can happen outside the lock — id is fixed now)
    sess_model = inp = outp = None
    fallback = None
    for sid in new_ids:
        m, i, o = _hermes_export_session(sid)
        if fallback is None and (i is not None or o is not None):
            fallback = (m, i, o)
        if model_arg and m and _model_matches(model_arg, m):
            sess_model, inp, outp = m, i, o
            break
    if inp is None and outp is None and fallback:  # no model match -> best new session
        sess_model, inp, outp = fallback

    r["model"] = sess_model or model_arg
    if inp is None and outp is None:
        # last resort: estimate so cross-lane efficiency still has a number (flagged)
        r["inputTokens"] = benchlib.estimate_tokens(prompt)
        r["outputTokens"] = benchlib.estimate_tokens(r["output"])
        r["tokensEstimated"] = True
    else:
        r["inputTokens"] = inp
        r["outputTokens"] = outp
    r["totalTokens"] = (r["inputTokens"] or 0) + (r["outputTokens"] or 0) or None
    r["ok"] = bool(r["output"]) and not r["error"]
    return r


def _model_matches(want, got):
    """grok-4.20-0309-reasoning recorded as 'grok-4.20-...' etc. Match on the family stem."""
    want = str(want).lower()
    got = str(got).lower()
    if want == got or want in got or got in want:
        return True
    stem = want.split("-0309")[0]  # grok-4.20-0309-reasoning -> grok-4.20
    return stem in got


def _hermes_export_session(sess_id):
    """Export one session as JSONL; return (model_seen, input_tokens, output_tokens)."""
    try:
        proc = subprocess.run(
            ["hermes", "sessions", "export", "--session-id", sess_id, "-"],
            capture_output=True, text=True, timeout=60,
        )
    except Exception:
        return None, None, None
    total_in = total_out = 0
    found = False
    model_seen = None
    for line in proc.stdout.splitlines():
        ev = benchlib._try_json(line.strip())
        if ev is None:
            continue
        if model_seen is None:
            model_seen = _find_model(ev)
        for n in benchlib.find_token_nodes(ev):
            if n["input"] is not None:
                total_in += n["input"]
                found = True
            if n["output"] is not None:
                total_out += n["output"]
                found = True
    if not found:
        return model_seen, None, None
    return model_seen, (total_in or None), (total_out or None)


def _find_model(obj):
    """Pull a model string out of a session event (looks for grok-* / known model keys)."""
    found = []

    def visit(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if str(k).lower() in ("model", "model_name", "model_id", "modelslug") and isinstance(v, str):
                    found.append(v)
                visit(v)
        elif isinstance(node, list):
            for v in node:
                visit(v)

    visit(obj)
    for m in found:
        if "grok" in m.lower():
            return m
    return found[0] if found else None
