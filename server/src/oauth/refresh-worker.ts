import { sql } from "drizzle-orm";
import { backoffSeconds } from "./backoff.js";
import { refreshConnection, type RefreshSecretService } from "./refresh.js";
import { oauthLogger } from "./logger.js";
import type { ProviderRegistry } from "./registry.js";

// Postgres advisory lock key. Picked to be a stable, distinct constant that
// fits in signed int64 (`pg_try_advisory_lock(bigint)`). Any process that
// acquires this key acts as the worker leader for the tick.
const ADVISORY_LOCK_KEY = 0x074a17b4_c0bbac1en;
const BATCH_LIMIT = 100;
const TICK_INTERVAL_MS = 60_000;

export interface RefreshWorkerDeps {
  // db: Drizzle handle. Loosely typed so this module does not pull the full
  // @paperclipai/db Db type — same convention as refresh.ts and the routes.
  db: any;
  registry: ProviderRegistry;
  // Same shape as RefreshDeps.secretService — typed explicitly so a missing
  // method is a compile error instead of being silently swallowed by `any`.
  secretService: RefreshSecretService;
  // Optional injection for tests; defaults to the real refreshConnection.
  refreshFn?: typeof refreshConnection;
}

export async function runRefreshTick(deps: RefreshWorkerDeps): Promise<void> {
  const lockResult = await deps.db.execute(
    sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}::bigint) as result`,
  );
  const acquired = Boolean(lockResult.rows?.[0]?.result);
  if (!acquired) return;

  try {
    const candidates = await deps.db.query.oauthConnections.findMany({
      where: (
        t: any,
        { and: A, eq: E, isNotNull: NN, lt: L, sql: S }: any,
      ) =>
        A(
          E(t.status, "active"),
          NN(t.refreshTokenSecretId),
          NN(t.accessTokenExpiresAt),
          L(t.accessTokenExpiresAt, S`now() + interval '5 minutes'`),
        ),
      orderBy: (t: any, { asc: A }: any) => [A(t.accessTokenExpiresAt)],
      limit: BATCH_LIMIT,
    });

    const now = Date.now();
    const eligible = candidates.filter((row: any) => {
      if (!row.lastErrorAt) return true;
      const minRetryAt =
        row.lastErrorAt.getTime() +
        backoffSeconds(row.refreshAttemptCount) * 1000;
      return minRetryAt <= now;
    });

    const refreshFn = deps.refreshFn ?? refreshConnection;
    for (const row of eligible) {
      try {
        await refreshFn({
          connectionId: row.id,
          db: deps.db,
          registry: deps.registry,
          secretService: deps.secretService,
        });
      } catch (err) {
        oauthLogger.error(
          {
            connectionId: row.id,
            err: { message: (err as Error).message },
          },
          "worker refresh threw",
        );
      }
    }
  } finally {
    await deps.db.execute(
      sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}::bigint)`,
    );
  }
}

export function startRefreshWorker(
  deps: RefreshWorkerDeps,
): { stop: () => void } {
  let stopped = false;
  let timeout: NodeJS.Timeout;
  const tick = async () => {
    if (stopped) return;
    try {
      await runRefreshTick(deps);
    } catch (err) {
      oauthLogger.error(
        { err: { message: (err as Error).message } },
        "refresh worker tick failed",
      );
    }
    if (!stopped) timeout = setTimeout(tick, TICK_INTERVAL_MS);
  };
  timeout = setTimeout(tick, TICK_INTERVAL_MS);
  return {
    stop: () => {
      stopped = true;
      clearTimeout(timeout);
    },
  };
}
