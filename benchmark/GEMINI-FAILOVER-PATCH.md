# Gemini failover — tested patch, pending review (2026-06-22)

**Status:** READY but NOT APPLIED. The auto-mode safety classifier blocked the live edit (correctly — it's a shared failover daemon and the regex is validated only in isolation, not yet against a real captured agy quota event). The daemon files are pristine. Apply deliberately, ideally after capturing the real string (see §4).

## 1) The problem — Gemini is a "blind lane"
The session-limit failover watcher (`session-limit-watch.py`) + autonomous `fallback-monitor.py` detect Claude/Codex limits via:
```python
LIMIT_RE = re.compile(r"You[‘’']ve hit your (session|weekly|daily|5-?hour|usage) limit", re.IGNORECASE)
```
Gemini's weekly-quota exhaustion surfaces from `agy` as `RESOURCE_EXHAUSTED` / `quota exceeded` / `ineligible tier` (the antigravity adapter propagates agy's stderr to the run error on non-zero exit — `execute.ts:393-394,430`). `LIMIT_RE` never matches that wording, so **a Gemini primary at its weekly cap would NOT fail over** — the live thiaaaa-59 gemini lanes (and the coming relane drafters) would silently stall.

**Safety property:** `detect_limit_events` only inspects agents in the fallback-registry (`if primary not in registry: continue`). No Gemini primary is registered yet, so this patch is **inert until a Gemini primary+sister is deliberately registered** (§5) — it cannot cause a spurious live swap on its own.

## 2) Patch — `scripts/session-limit-watch.py`
Watcher path: `~/.paperclip/instances/default/companies/e6361895-…/agents/3733fb01-…/instructions/scripts/session-limit-watch.py`

**(a)** After `LIMIT_MODEL_RE` (~line 50) add:
```python
# Gemini/antigravity weekly-quota exhaustion surfaces from agy as RESOURCE_EXHAUSTED / quota-
# exceeded / ineligible-tier — NOT the "You've hit your … limit" phrasing LIMIT_RE matches.
# Conservative on purpose: strong exhaustion signatures only, NOT a bare transient 429 / rate-limit
# (retryable, already TRANSIENT_HTTP). Inert until a Gemini primary is in the fallback-registry.
GEMINI_QUOTA_RE = re.compile(
    r"resource[ _-]?exhausted|resource has been exhausted|"
    r"quota (?:exceeded|exhausted)|exceeded your[^.\n]{0,40}quota|"
    r"ineligible[ _-]?tier",
    re.IGNORECASE,
)
GEMINI_RESET_AFTER = timedelta(hours=108)  # ~weekly bar (≈99h) + buffer; hold sister past reset
```

**(b)** In `detect_limit_events` replace the detection block:
```python
        error_text = str(run.get("error") or "")
        have_error_signal = bool(LIMIT_RE.search(error_text) or GEMINI_QUOTA_RE.search(error_text))
        log_text = "" if have_error_signal else run_log_text(str(run.get("id") or ""))
        source = f"{error_text}\n{log_text}"
        match = LIMIT_RE.search(source)
        gemini_match = None if match else GEMINI_QUOTA_RE.search(source)
        if not match and not gemini_match:
            continue
        # … (anchor / limit_model / model_profile / spark-ignore / context unchanged) …
        if match:
            limit_kind = (match.group(1) or "usage").lower()
            reset_at = iso_z(parse_reset_at(source, anchor))
        else:
            limit_kind = "weekly"  # gemini weekly bar
            reset_at = iso_z((anchor or now_utc()) + GEMINI_RESET_AFTER)
        events.append({ …, "limitKind": limit_kind, …, "resetAt": reset_at, … })
```
(Full hunk in the session transcript; `limitKind`/`resetAt` were previously inlined from `match.group(1)`/`parse_reset_at`.)

## 3) Mirror — `scripts/fallback-monitor.py`
Same `GEMINI_QUOTA_RE` after its `LIMIT_RE` (~line 20); in `detect_limit()` (line 475) return a match for `GEMINI_QUOTA_RE` too, and apply the 108h reset where it builds the swap's `resetAt` (`scan_paused_primaries`). Without this, the autonomous monitor (the leg that survives a Claude outage) stays blind to Gemini.

## 4) Validate against the REAL string THIS WEEK
The regex is validated in isolation (6/6 exhaustion strings match; bare 429 / rate-limit / 503 / Claude-phrasing / benign all correctly excluded; independent from `LIMIT_RE`). But the exact agy weekly-quota wording is **unconfirmed**. When Gemini hits its cap this week (planned), capture it:
```bash
# the failed gemini run's error + log — grab the literal quota line:
grep -riE 'resource|quota|exhaust|ineligible|429|limit' ~/.paperclip/*/logs 2>/dev/null   # or the run's error in the UI
```
Confirm `GEMINI_QUOTA_RE` matches it; widen only if needed. THEN apply + activate.

## 5) Register a Gemini sister (at relane deploy — not before)
Sisters must be on a DIFFERENT provider (a Google cap takes out all gemini lanes at once). Data-backed picks:
| lane | primary (Google) | sister | provider |
|---|---|---|---|
| book-chapter | gemini-flash-low | **grok-4-fast** (0.948) | xAI |
| content | gemini-flash-low | **gpt-5.4-mini + skills** (0.938) | OpenAI |
| cv-review | gemini-flash | ⚠ **no cheap peer** — benchmark claude-sonnet / gpt-5.4 (best non-Google is grok-4.3 0.850, a cliff) | — |

```bash
# 1. create the sister (dormant, wake-on-demand) — cross-provider:
benchmark/rollout/create_sister.py --company <id> --name "Author-Grok" --role author \
   --adapter hermes_local --model grok-4-fast \
   --skills "content-book-craft,fallback-lane-ops" --instr <primary AGENTS.md>
# 2. register primary→sister in the fallback registry:
#    …/agents/3733fb01-…/instructions/fallback-registry.json  →  {"<gemini-primary-id>": ["<sister-id>"]}
# 3. smoke: one bounded issue lands on the sister; swap-back after the 108h window.
```

## 6) Activate (after apply)
`KeepAlive=true`, so reload the 7 watchers:
```bash
for s in '' .capital .kiss .media .pod .recruit .tsb; do
  launchctl kickstart -k "gui/$(id -u)/com.thinkstack.session-limit-watch$s"; done
python3 -c "import ast; ast.parse(open('…/session-limit-watch.py').read())"  # parse-check FIRST
```
