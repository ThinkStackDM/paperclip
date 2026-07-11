# Cutover runbook — unify fallback registries

**Goal:** make `agent_fallback_sisters` the single source of truth and regenerate
the watcher's flat files from it, with **no change to current failover behavior
except the agreed normalization** (3 drops + 1 change).

**Risk profile:** LOW. The watcher code is unchanged; it re-reads its registry
every ~60s and `generate.py` writes atomically, so the change is hot and
restart-free. Fully reversible.

## Pick a clean window

Avoid the heavy-hitter sprints: **Capital 12–16, Media 16–20, Books 00–04.**
Good windows: **~04:00–11:00** or **~20:00–24:00** local. Also confirm overall
fleet load is low (shared Mac). The cutover itself takes seconds.

## The agreed diff (sign-off artifact)

Running `generate.py` against the backfilled table changes **2 of 7 files**;
the other 5 are byte-identical:

- **TSMC `fallback-registry.json` — 3 DROPs** (non-name-coherent cross-lane pins):
  - `CodexEngineer` (7349cc4f, codex, idle) → was [Astra-Hermes, HermesEngineer]
  - `RoutingPA` (c4d49b19, codex, idle) → was [Astra-Hermes, HermesEngineer]
  - `HermesEngineer` (51aef791, hermes, idle) → was [Astra-Hermes]
  - *Effect:* these 3 idle utility agents have no same-name clone, so after
    normalization they have no auto-failover. (Veto any that matters → keep via
    an explicit override instead.)
- **Recruit `fallback-registry-recruit.json` — 1 CHANGE:**
  - `Daedalus` (1f421202, claude, paused): [Daedalus-Hermes] → **[Daedalus-Codex,
    Daedalus-Hermes]**. Resolves a pre-existing DB↔flat drift in the DB's favor;
    Daedalus-Codex is idle/available, so this is the more sensible chain.

## Steps

```bash
cd <repo>/scripts/lane_registry

# 0. Pre-flight: tests + show the exact diff one more time
python3 test_lane_registry.py
python3 generate.py --dry-run

# 1. Snapshot the current flat files (rollback point)
SNAP=~/.paperclip/fallback-registry-snapshot-$(date +%Y%m%d-%H%M%S)
mkdir -p "$SNAP" && cp <out-dir>/fallback-registry*.json "$SNAP"/

# 2. Backfill the DB table to full lane coverage (reversible, tagged)
python3 backfill.py --dry-run        # review the 13 inserts
python3 backfill.py --apply

# 3. Regenerate the flat files from the table (atomic writes)
python3 generate.py --dry-run        # confirm == the agreed diff
python3 generate.py --write

# 4. Verify the running watchers picked it up (next poll ≤60s)
tail -n 20 ~/.paperclip/session-limit-watch-state/logs/session-limit-watch*.out.log
#   (no crashes; each watcher keeps polling)
```

## Rollback

```bash
# Restore the flat files (hot, ≤60s pickup):
cp "$SNAP"/fallback-registry*.json <out-dir>/

# Revoke the backfilled DB rows (UI-only effect; lane branch not yet deployed):
psql "$DATABASE_URL" -c \
  "UPDATE agent_fallback_sisters SET revoked_at = now() WHERE created_by = 'lane-unify-2026-06-23';"
```

## After cutover

- Deprecate the dead `companies/<id>/fallback-registry/registry.json` docs
  (no consumers) — move to `*.deprecated` or delete.
- Stop hand-editing the flat files; treat them as generated.
- (Optional) enable the launchd safety refresh
  (`com.thinkstack.fallback-registry-gen.plist.sample`) for periodic regeneration,
  or just run `generate.py --write` on lane changes.
- Record the decision in TSKB0008 (decisions log) and topology in TSKB0007.
