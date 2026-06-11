import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, companies, issueComments } from "@paperclipai/db";
import { getActivityWindowState, parseCompanyActivityWindow } from "@paperclipai/shared";

/**
 * Cheap-lane recovery review routing + consecutive-review counting.
 *
 * Goal (operator directive 2026-06-11): recovery / failed-status / silent-run
 * review issues must be triaged by a CHEAP, near-zero-cost lane — the company's
 * deterministic shell-handler Compiler (or a cheap local model) — instead of
 * paging the expensive CEO/CTO leadership lane on every failure. The cheap lane
 * sets the case back to a review disposition; only after THREE consecutive
 * reviews on the SAME case (it keeps coming back unresolved) does it ESCALATE to
 * leadership. This makes leadership escalation rare instead of per-failure churn.
 *
 * Mechanism:
 *  - resolveCheapRecoveryReviewerAgentId: picks the company's invokable cheap
 *    reviewer at runtime (no migration / mapping table needed). Preference order:
 *      1. paperclip_shell_handler agent named like a primary "Compiler"
 *         (e.g. "MC-Compiler", "KISS-Compiler", "Compiler"), excluding Fallback
 *      2. paperclip_shell_handler "Fallback-Compiler"
 *      3. any other invokable paperclip_shell_handler agent
 *      4. a cheap local-model Compiler (gemini_local / grok_local named *Compiler*)
 *  - The consecutive-review counter is stored as metadata on a single marker
 *    comment on the review issue (migration-free, audit-trail friendly). It is
 *    read/bumped each time the watchdog re-encounters an already-open review for
 *    the same unresolved case, and reset when the case resolves.
 */

export const RECOVERY_REVIEW_ESCALATION_THRESHOLD = 3;

const CHEAP_LOCAL_MODEL_ADAPTER_TYPES = new Set(["gemini_local", "grok_local"]);
const NON_INVOKABLE_AGENT_STATUSES = new Set(["paused", "terminated", "pending_approval"]);

// The counter is persisted on a single dedicated marker comment per review
// issue. We keep the machine-readable state in the comment BODY behind a stable
// prefix (same pattern the productivity-review refresh comments use), so we do
// not have to abuse the structured `metadata` column or add a migration.
export const REVIEW_COUNTER_COMMENT_PREFIX = "Recovery review cycle tracker.";
const REVIEW_COUNTER_STATE_SENTINEL = "<!-- recovery-review-counter:";
const REVIEW_COUNTER_STATE_SENTINEL_END = "-->";

type ReviewCounterMarker = {
  consecutiveReviews: number;
  escalated: boolean;
  lastBumpedAt: string;
};

function encodeMarkerBody(marker: ReviewCounterMarker): string {
  return [
    REVIEW_COUNTER_COMMENT_PREFIX,
    "",
    `- Consecutive unresolved reviews on this case: ${marker.consecutiveReviews}`,
    `- Escalated to leadership: ${marker.escalated ? "yes" : "no"}`,
    `- Escalation threshold: ${RECOVERY_REVIEW_ESCALATION_THRESHOLD} consecutive reviews`,
    `- Last updated: ${marker.lastBumpedAt}`,
    "",
    `${REVIEW_COUNTER_STATE_SENTINEL}${JSON.stringify(marker)}${REVIEW_COUNTER_STATE_SENTINEL_END}`,
  ].join("\n");
}

function decodeMarkerBody(body: string | null | undefined): ReviewCounterMarker | null {
  if (!body) return null;
  const start = body.indexOf(REVIEW_COUNTER_STATE_SENTINEL);
  if (start === -1) return null;
  const from = start + REVIEW_COUNTER_STATE_SENTINEL.length;
  const end = body.indexOf(REVIEW_COUNTER_STATE_SENTINEL_END, from);
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(body.slice(from, end).trim()) as Record<string, unknown>;
    return {
      consecutiveReviews:
        typeof parsed.consecutiveReviews === "number" && Number.isFinite(parsed.consecutiveReviews)
          ? parsed.consecutiveReviews
          : 0,
      escalated: parsed.escalated === true,
      lastBumpedAt:
        typeof parsed.lastBumpedAt === "string" ? parsed.lastBumpedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function isInvokableStatus(status: string | null | undefined) {
  return Boolean(status && !NON_INVOKABLE_AGENT_STATUSES.has(status));
}

/**
 * Resolve the cheap reviewer agent for a company. Returns null if no suitable
 * cheap lane exists (callers then fall back to their existing leadership chain).
 */
export async function resolveCheapRecoveryReviewerAgentId(
  db: Db,
  companyId: string,
): Promise<string | null> {
  const candidates = await db
    .select({
      id: agents.id,
      name: agents.name,
      adapterType: agents.adapterType,
      status: agents.status,
    })
    .from(agents)
    .where(eq(agents.companyId, companyId))
    .orderBy(asc(agents.createdAt), asc(agents.id));

  const invokable = candidates.filter((a) => isInvokableStatus(a.status));
  const shellHandlers = invokable.filter((a) => a.adapterType === "paperclip_shell_handler");

  const named = (list: typeof invokable, pred: (name: string) => boolean) =>
    list.find((a) => typeof a.name === "string" && pred(a.name.toLowerCase()));

  // 1. Primary shell-handler Compiler (not Fallback).
  const primaryCompiler = named(
    shellHandlers,
    (name) => name.includes("compiler") && !name.includes("fallback"),
  );
  if (primaryCompiler) return primaryCompiler.id;

  // 2. Fallback-Compiler shell handler.
  const fallbackCompiler = named(shellHandlers, (name) => name.includes("fallback"));
  if (fallbackCompiler) return fallbackCompiler.id;

  // 3. Any other invokable shell handler.
  if (shellHandlers[0]) return shellHandlers[0].id;

  // 4. Cheap local-model Compiler.
  const cheapModelCompiler = invokable.find(
    (a) =>
      CHEAP_LOCAL_MODEL_ADAPTER_TYPES.has(a.adapterType) &&
      typeof a.name === "string" &&
      a.name.toLowerCase().includes("compiler"),
  );
  if (cheapModelCompiler) return cheapModelCompiler.id;

  return null;
}

/**
 * True when the company is intentionally dormant (outside its activity window).
 * Recovery review churn should not be generated for dormant companies — their
 * agents are sleeping, not failing. Kept here so the recovery service can guard
 * routing/escalation without re-deriving window state. (Lightweight: we only
 * read the persisted activity-window state the scheduler already maintains.)
 */
export async function isCompanyRecoveryDormant(
  db: Db,
  companyId: string,
  now = new Date(),
): Promise<boolean> {
  const row = await db
    .select({ activityWindow: companies.activityWindow })
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0] ?? null);
  if (!row) return false;
  // Compute window state live (same source of truth as the run gate / timer
  // scheduler dormancy skip). A company with no window is never dormant; a
  // company whose window is currently closed is dormant.
  const window = parseCompanyActivityWindow(row.activityWindow);
  if (!window) return false;
  return !getActivityWindowState(window, now).open;
}

async function findCounterComment(db: Db, companyId: string, reviewIssueId: string) {
  const rows = await db
    .select({ id: issueComments.id, body: issueComments.body })
    .from(issueComments)
    .where(
      and(
        eq(issueComments.companyId, companyId),
        eq(issueComments.issueId, reviewIssueId),
        sql`${issueComments.body} like ${`${REVIEW_COUNTER_COMMENT_PREFIX}%`}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, marker: decodeMarkerBody(row.body) };
}

export async function getConsecutiveReviewCount(
  db: Db,
  companyId: string,
  reviewIssueId: string,
): Promise<{ count: number; escalated: boolean }> {
  const found = await findCounterComment(db, companyId, reviewIssueId);
  if (!found?.marker) return { count: 0, escalated: false };
  return { count: found.marker.consecutiveReviews, escalated: found.marker.escalated };
}

/**
 * Bump the consecutive-review counter for a review issue and return the new
 * state. Persisted as metadata on a single marker comment (created on first
 * bump). Does not page anyone — callers decide escalation from the returned
 * count vs RECOVERY_REVIEW_ESCALATION_THRESHOLD.
 */
export async function bumpConsecutiveReviewCount(
  db: Db,
  companyId: string,
  reviewIssueId: string,
  opts?: { markEscalated?: boolean; now?: Date },
): Promise<{ count: number; escalated: boolean; shouldEscalate: boolean }> {
  const now = opts?.now ?? new Date();
  const found = await findCounterComment(db, companyId, reviewIssueId);
  const prevCount = found?.marker?.consecutiveReviews ?? 0;
  const prevEscalated = found?.marker?.escalated ?? false;
  const nextCount = prevCount + 1;
  const escalated = prevEscalated || opts?.markEscalated === true;
  const marker: ReviewCounterMarker = {
    consecutiveReviews: nextCount,
    escalated,
    lastBumpedAt: now.toISOString(),
  };
  const body = encodeMarkerBody(marker);

  if (found) {
    await db
      .update(issueComments)
      .set({ body, updatedAt: now })
      .where(eq(issueComments.id, found.id));
  } else {
    await db.insert(issueComments).values({
      companyId,
      issueId: reviewIssueId,
      authorType: "system",
      body,
    });
  }

  // Escalation fires exactly when the counter first reaches the threshold and
  // we have not already escalated this case.
  const shouldEscalate = nextCount >= RECOVERY_REVIEW_ESCALATION_THRESHOLD && !prevEscalated;
  return { count: nextCount, escalated, shouldEscalate };
}

/**
 * Reset the counter when the underlying case resolves (review closed / source
 * healthy). Idempotent — safe to call even if no marker exists.
 */
export async function resetConsecutiveReviewCount(
  db: Db,
  companyId: string,
  reviewIssueId: string,
  now = new Date(),
): Promise<void> {
  const found = await findCounterComment(db, companyId, reviewIssueId);
  if (!found) return;
  const marker: ReviewCounterMarker = {
    consecutiveReviews: 0,
    escalated: false,
    lastBumpedAt: now.toISOString(),
  };
  await db
    .update(issueComments)
    .set({ body: encodeMarkerBody(marker), updatedAt: now })
    .where(eq(issueComments.id, found.id));
}
