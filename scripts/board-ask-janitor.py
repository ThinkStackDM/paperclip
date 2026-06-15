#!/usr/bin/env python3
"""
board-ask-janitor — keep the operator's board-ask list clean.

AUTO-CLOSE (safe): pending asks whose parent issue is already done/cancelled — the work moved on,
the ask is moot. Closes thread interactions (-> status 'expired') and approvals (-> 'rejected'
with a clear note). Removes them from the operator's "needs you" / blocked / approvals surfaces.

FLAG (report only, no change): pending asks >=14 days old on a LIVE issue — likely phantom
blockers (need maybe already met elsewhere) for the operator to eyeball. Never auto-closed.

Usage:
  board-ask-janitor.py           # DRY RUN — counts + samples, no changes
  board-ask-janitor.py --apply   # execute the auto-close
"""
import os, subprocess, sys
PG = ["/opt/homebrew/bin/psql", "-h127.0.0.1", "-p54329", "-U", "paperclip", "-d", "paperclip", "-tA", "-F", "\t"]
APPLY = "--apply" in sys.argv

def q(sql):
    r = subprocess.run(PG + ["-c", sql], env={**os.environ, "PGPASSWORD": "paperclip"}, capture_output=True, text=True)
    if r.returncode != 0 and r.stderr.strip():
        print(f"  [psql err] {r.stderr.strip()[:200]}")
    return r.stdout.strip()

STALE_INT = "ti.status='pending' AND i.status IN ('done','cancelled')"
STALE_APR = "a.status IN ('pending','revision_requested') AND i.status IN ('done','cancelled')"

print(f"=== board-ask-janitor {'APPLY' if APPLY else 'DRY-RUN'} ===")

# --- counts before ---
si = q(f"SELECT count(*) FROM issue_thread_interactions ti JOIN issues i ON ti.issue_id=i.id WHERE {STALE_INT};")
sa = q(f"SELECT count(*) FROM approvals a JOIN issue_approvals ia ON ia.approval_id=a.id JOIN issues i ON ia.issue_id=i.id WHERE {STALE_APR};")
print(f"\nSTALE (auto-close): {si or 0} interactions + {sa or 0} approvals on done/cancelled issues")

# --- phantom-blocker flags: old asks on live issues (report only) ---
print("\nFLAG (>=14d old, on a LIVE issue — review, NOT auto-closed):")
flags = q("""SELECT substr(c.name,1,12) || '  ' || i.identifier || '  ' || i.status || '  ' ||
   (now()::date - ti.created_at::date) || 'd  ' || ti.kind || '  ' || COALESCE(NULLIF(ti.title,''), left(ti.summary,40), '(no summary)')
   FROM issue_thread_interactions ti JOIN issues i ON ti.issue_id=i.id JOIN companies c ON i.company_id=c.id
   WHERE ti.status='pending' AND i.status NOT IN ('done','cancelled') AND ti.created_at < now()-interval '14 days'
   ORDER BY ti.created_at LIMIT 25;""")
print(flags if flags else "  (none)")

if not APPLY:
    print(f"\n(dry-run — would close {si or 0} interactions + {sa or 0} approvals. Re-run with --apply.)")
    sys.exit(0)

# --- APPLY: close stale ---
print("\napplying...")
q(f"""UPDATE issue_thread_interactions ti SET status='expired', resolved_at=now(),
   result = COALESCE(ti.result,'{{}}'::jsonb) || '{{"outcome":"expired","reason":"parent_issue_resolved","by":"board-ask-janitor"}}'::jsonb
   FROM issues i WHERE ti.issue_id=i.id AND {STALE_INT};""")
q(f"""UPDATE approvals a SET status='rejected',
   decision_note = 'Auto-closed by board-ask-janitor: parent issue '||i.status||' (ask no longer needed)', decided_at=now()
   FROM issue_approvals ia JOIN issues i ON ia.issue_id=i.id
   WHERE ia.approval_id=a.id AND {STALE_APR};""")
# verify
ri = q(f"SELECT count(*) FROM issue_thread_interactions ti JOIN issues i ON ti.issue_id=i.id WHERE {STALE_INT};")
ra = q(f"SELECT count(*) FROM approvals a JOIN issue_approvals ia ON ia.approval_id=a.id JOIN issues i ON ia.issue_id=i.id WHERE {STALE_APR};")
print(f"done. remaining stale: {ri or 0} interactions + {ra or 0} approvals (should be 0)")
