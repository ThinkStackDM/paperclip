# Lane fallback registry — unified source of truth

**Problem this solves.** "Which agent is a lane's primary and which are fallback
sisters" used to live in **two** places that could drift:

1. **`agent_fallback_sisters` DB table** — drives the UI sidebar (Crown / grouping
   via the server-computed `lanePrimaryAgentId`).
2. **Per-company flat `fallback-registry-*.json`** — drives the automatic
   session-limit failover (`session-limit-watch.py`).

(A third, `~/.paperclip/instances/default/companies/<id>/fallback-registry/registry.json`,
had **no code consumers** — dead documentation. Deprecated.)

## The model

```
 agent_fallback_sisters (DB)  ──►  generate.py  ──►  fallback-registry-*.json  ──►  session-limit-watch.py
   SINGLE SOURCE OF TRUTH          (projection)        (derived artifact)              (unchanged consumer)
```

- The **DB table is authoritative** for lane membership (one Crown "primary" per
  lane + its sisters).
- `generate.py` **projects** the table into the flat files the watcher already
  reads. The watcher is **not modified** — zero risk to the live failover path.
- **Failover order is derived from adapter model-tier**
  (`claude → codex → gemini/antigravity → hermes/grok`), *not* from the table's
  `priority` column. `priority` is **UI/Crown ordering only** — e.g. CEO lanes are
  seeded primary=codex (because the claude CEOs are halted by `claude-window-flip`),
  but for failover a limited codex agent must still fall to hermes, never "up" to a
  halted claude CEO. The model-tier rule reproduces the historical hand-maintained
  files exactly.

> **Do not hand-edit `fallback-registry-*.json`.** They are generated. Change the
> DB table (or hire/retire a sister), then run `generate.py --write`.

## Files

| file | role |
|------|------|
| `lib.py` | pure logic: family rank, name-base grouping, tier-ordering, chain expansion, data access |
| `generate.py` | DB table → flat `fallback-registry-*.json` (`--dry-run` / `--write`) |
| `backfill.py` | one-time: reconstruct missing lanes from the live flat files → DB rows (`--dry-run` / `--apply`) |
| `test_lane_registry.py` | unit tests (`python3 test_lane_registry.py`) |
| `CUTOVER.md` | the gated, low-load-window deployment runbook + rollback |
| `com.thinkstack.fallback-registry-gen.plist.sample` | optional launchd safety refresh |

## Day-to-day

```bash
# After any lane membership change (hire/retire a sister, edit the table):
python3 generate.py --dry-run     # review the semantic diff
python3 generate.py --write       # regenerate; running watchers pick it up within ≤60s
```

The watcher re-reads its registry **every poll** (`run_once → resolve_registry →
load_registry`, ~60s), and `generate.py` writes **atomically** (`os.replace`), so a
regenerate is a hot, restart-free update.

## Ordering rule (the one thing to remember)

Within a lane, members are ordered by **model tier** (preferred → cheap), then
base-agent-before-clone, then name. Each agent's failover chain = everyone after
it. The table's `priority` is **not** used for failover.
