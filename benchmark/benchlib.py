#!/usr/bin/env python3
"""
benchlib.py — shared helpers for the Paperclip model benchmark (#15).

Pure stdlib (no pip deps — keeps it runnable on the shared Mac without the
ddgs/brave install friction noted elsewhere). Holds: paths, config loading,
suite loading/validation, JSON extraction, and a normalized run-result shape
that mirrors Paperclip's usage_json ({inputTokens, outputTokens, model, costUsd})
so downstream tooling (agent-scorecard, tiering #9) speaks the same dialect.
"""

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESULTS_DIR = ROOT / "results"
CONFIG_PATH = ROOT / "config.json"


# --------------------------------------------------------------------------
# config + suites
# --------------------------------------------------------------------------

def load_config(path=None):
    path = Path(path) if path else CONFIG_PATH
    with open(path) as f:
        cfg = json.load(f)
    # strip _comment keys recursively for cleanliness (they're docs, not data)
    return cfg


def load_suite(role):
    """Load and lightly validate one role's suite.json."""
    suite_path = ROOT / role / "suite.json"
    if not suite_path.exists():
        raise FileNotFoundError(f"no suite for role {role!r}: {suite_path}")
    with open(suite_path) as f:
        suite = json.load(f)
    suite.setdefault("role", role)
    tasks = suite.get("tasks", [])
    seen = set()
    for t in tasks:
        for req in ("id", "prompt"):
            if req not in t:
                raise ValueError(f"{role} suite: task missing {req!r}: {t.get('id', t)}")
        if t["id"] in seen:
            raise ValueError(f"{role} suite: duplicate task id {t['id']!r}")
        seen.add(t["id"])
        t.setdefault("rubric", {})
    return suite


def load_all_suites(roles):
    return {role: load_suite(role) for role in roles}


# --------------------------------------------------------------------------
# normalized run result
# --------------------------------------------------------------------------

def empty_result():
    """The canonical shape every adapter returns. Mirrors Paperclip usage_json."""
    return {
        "ok": False,
        "output": "",
        "model": None,          # actual model string reported by the CLI, if any
        "inputTokens": None,
        "outputTokens": None,
        "totalTokens": None,
        "cacheTokens": None,
        "costUsd": None,
        "tokensEstimated": False,
        "wallMs": None,
        "error": None,
        "cmd": None,
        "stderrTail": None,
    }


# --------------------------------------------------------------------------
# JSON / token extraction helpers
# --------------------------------------------------------------------------

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def extract_json(text):
    """
    Best-effort pull of a JSON object/array out of free-form model text.
    Tries: whole string, fenced ```json block, first balanced {...} or [...].
    Returns the parsed object or None.
    """
    if text is None:
        return None
    text = text.strip()
    # 1. whole thing
    obj = _try_json(text)
    if obj is not None:
        return obj
    # 2. fenced block
    m = _FENCE_RE.search(text)
    if m:
        obj = _try_json(m.group(1).strip())
        if obj is not None:
            return obj
    # 3. first balanced object/array
    for opener, closer in (("{", "}"), ("[", "]")):
        snippet = _balanced(text, opener, closer)
        if snippet:
            obj = _try_json(snippet)
            if obj is not None:
                return obj
    return None


def _try_json(s):
    try:
        return json.loads(s)
    except Exception:
        return None


def _balanced(text, opener, closer):
    start = text.find(opener)
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == opener:
            depth += 1
        elif c == closer:
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


# token-count key aliases seen across CLIs / providers
_INPUT_KEYS = {"input_tokens", "inputtokens", "prompt_tokens", "prompttokencount",
               "prompt_token_count", "input"}
_OUTPUT_KEYS = {"output_tokens", "outputtokens", "completion_tokens",
                "candidatestokencount", "candidates_token_count", "output"}
_TOTAL_KEYS = {"total_tokens", "totaltokens", "totaltokencount", "total_token_count"}


def find_token_nodes(obj):
    """
    Walk an arbitrary parsed JSON structure and yield dicts that look like a
    usage block, normalized to {'input':int|None,'output':int|None,'total':int|None}.
    Used by adapters whose CLIs bury token counts in nested event JSON.
    """
    out = []

    def visit(node):
        if isinstance(node, dict):
            lowered = {str(k).lower(): v for k, v in node.items()}
            inp = _first_int(lowered, _INPUT_KEYS)
            outp = _first_int(lowered, _OUTPUT_KEYS)
            tot = _first_int(lowered, _TOTAL_KEYS)
            if inp is not None or outp is not None or tot is not None:
                out.append({"input": inp, "output": outp, "total": tot})
            for v in node.values():
                visit(v)
        elif isinstance(node, list):
            for v in node:
                visit(v)

    visit(obj)
    return out


def _first_int(lowered, keys):
    for k in keys:
        if k in lowered:
            try:
                return int(lowered[k])
            except (TypeError, ValueError):
                continue
    return None


def estimate_tokens(text):
    """Rough fallback when a CLI exposes no usage. ~4 chars/token."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def word_count(text):
    return len(re.findall(r"\S+", text or ""))


def dotted_get(obj, path):
    """obj['a']['b'][0] via 'a.b.0'. Returns (found, value)."""
    cur = obj
    for part in path.split("."):
        if isinstance(cur, dict):
            if part not in cur:
                return False, None
            cur = cur[part]
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return False, None
        else:
            return False, None
    return True, cur


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
