import { and, inArray, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { activityLog, agentWakeupRequests, heartbeatRunEvents, heartbeatRuns } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

/**
 * Heartbeat history retention.
 *
 * The run-history tables grow without bound. The biggest reclaimable, low-risk
 * targets are the per-run *leaf* tables — `heartbeat_run_events`, `activity_log`
 * and unreferenced `agent_wakeup_requests`. We deliberately do NOT prune
 * `heartbeat_runs` itself: it is referenced with `ON DELETE NO ACTION` by
 * financial tables (`cost_events`, `finance_events`) and `agent_task_sessions`,
 * so deleting runs would either violate those FKs or destroy accounting data.
 * Pruning runs is a separate, policy-gated phase.
 *
 * Disabled unless a positive `PAPERCLIP_HEARTBEAT_RETENTION_DAYS` is set, so it
 * never deletes live data implicitly.
 */

const DEFAULT_RETENTION_DAYS = 60;
const DELETE_BATCH_SIZE = 5_000;
const MAX_ITERATIONS = 1_000;

export interface HeartbeatRetentionOptions {
  retentionDays?: number;
  /** Count what would be deleted without deleting anything. */
  dryRun?: boolean;
  batchSize?: number;
}

export interface HeartbeatRetentionResult {
  cutoff: Date;
  dryRun: boolean;
  heartbeatRunEvents: number;
  activityLog: number;
  agentWakeupRequests: number;
}

function cutoffDate(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/** Delete `table` rows matching `predicate` in bounded batches; return total deleted. */
async function deleteInBatches(
  db: Db,
  table: typeof heartbeatRunEvents | typeof activityLog | typeof agentWakeupRequests,
  predicate: ReturnType<typeof and>,
  batchSize: number,
): Promise<number> {
  let total = 0;
  for (let iterations = 0; iterations < MAX_ITERATIONS; iterations += 1) {
    const victims = db
      .select({ id: table.id })
      .from(table)
      .where(predicate)
      .limit(batchSize);
    const deleted = await db
      .delete(table)
      .where(inArray(table.id, victims))
      .returning({ id: table.id })
      .then((rows) => rows.length);
    total += deleted;
    if (deleted < batchSize) break;
  }
  return total;
}

async function countMatching(
  db: Db,
  table: typeof heartbeatRunEvents | typeof activityLog | typeof agentWakeupRequests,
  predicate: ReturnType<typeof and>,
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(table)
    .where(predicate);
  return row?.value ?? 0;
}

export async function pruneHeartbeatHistory(
  db: Db,
  options: HeartbeatRetentionOptions = {},
): Promise<HeartbeatRetentionResult> {
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const batchSize = options.batchSize ?? DELETE_BATCH_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(retentionDays);

  const eventsPredicate = and(lt(heartbeatRunEvents.createdAt, cutoff));
  const activityPredicate = and(lt(activityLog.createdAt, cutoff));
  // Never delete a wakeup request still referenced by a (retained) heartbeat run
  // — heartbeat_runs.wakeup_request_id is ON DELETE NO ACTION.
  const wakeupPredicate = and(
    lt(agentWakeupRequests.createdAt, cutoff),
    notInArray(
      agentWakeupRequests.id,
      db
        .select({ id: heartbeatRuns.wakeupRequestId })
        .from(heartbeatRuns)
        .where(isNotNull(heartbeatRuns.wakeupRequestId)),
    ),
  );

  let result: HeartbeatRetentionResult;
  if (dryRun) {
    result = {
      cutoff,
      dryRun: true,
      heartbeatRunEvents: await countMatching(db, heartbeatRunEvents, eventsPredicate),
      activityLog: await countMatching(db, activityLog, activityPredicate),
      agentWakeupRequests: await countMatching(db, agentWakeupRequests, wakeupPredicate),
    };
  } else {
    result = {
      cutoff,
      dryRun: false,
      heartbeatRunEvents: await deleteInBatches(db, heartbeatRunEvents, eventsPredicate, batchSize),
      activityLog: await deleteInBatches(db, activityLog, activityPredicate, batchSize),
      agentWakeupRequests: await deleteInBatches(db, agentWakeupRequests, wakeupPredicate, batchSize),
    };
  }

  const total = result.heartbeatRunEvents + result.activityLog + result.agentWakeupRequests;
  if (total > 0 || dryRun) {
    logger.info({ ...result, retentionDays }, dryRun ? "Heartbeat retention dry-run" : "Pruned heartbeat history");
  }
  return result;
}

/**
 * Start the periodic heartbeat-history prune. No-op (returns a noop stopper)
 * unless `retentionDays` is a positive number, so it stays inert until an
 * operator opts in via PAPERCLIP_HEARTBEAT_RETENTION_DAYS.
 */
export function startHeartbeatHistoryRetention(
  db: Db,
  options: { retentionDays?: number; intervalMs?: number } = {},
): () => void {
  const retentionDays = options.retentionDays;
  if (!retentionDays || !Number.isFinite(retentionDays) || retentionDays <= 0) {
    return () => {};
  }
  const intervalMs = options.intervalMs ?? 6 * 60 * 60 * 1_000;

  const run = () =>
    pruneHeartbeatHistory(db, { retentionDays }).catch((err) => {
      logger.warn({ err }, "Heartbeat history retention sweep failed");
    });

  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  void run();

  logger.info({ retentionDays, intervalMs }, "Heartbeat history retention enabled");
  return () => clearInterval(timer);
}
