import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, heartbeatRuns } from "@paperclipai/db";
import type { ProviderQuotaResult } from "@paperclipai/shared";
import {
  buildGeminiReactiveWindows,
  GEMINI_QUOTA_SOURCE_HEARTBEAT_ESTIMATE,
  type GeminiQuotaRunSample,
} from "@paperclipai/adapter-gemini-local/server";
import { listServerAdapters } from "../adapters/registry.js";

const QUOTA_PROVIDER_TIMEOUT_MS = 20_000;
// How far back to scan gemini_local runs when deriving a reactive quota estimate.
const GEMINI_REACTIVE_LOOKBACK_MS = 6 * 60 * 60 * 1000;

function providerSlugForAdapterType(type: string): string {
  switch (type) {
    case "claude_local":
      return "anthropic";
    case "codex_local":
      return "openai";
    case "gemini_local":
      return "google";
    default:
      return type;
  }
}

/**
 * Asks each registered adapter for its provider quota windows and aggregates the results.
 * Adapters that don't implement getQuotaWindows() are silently skipped.
 * Individual adapter failures are caught and returned as error results rather than
 * letting one provider's outage block the entire response.
 *
 * When `db` is provided, the gemini_local provider gets a reactive fallback: if its
 * live Code Assist read fails or returns nothing, recent gemini_local heartbeat
 * rate-limit failures are used to synthesize an "exhausted" estimate so Google
 * quota exhaustion is still visible to the session-limit watcher and quota bars.
 */
export async function fetchAllQuotaWindows(db?: Db): Promise<ProviderQuotaResult[]> {
  const adapters = listServerAdapters().filter((a) => a.getQuotaWindows != null);

  const settled = await Promise.allSettled(
    adapters.map((adapter) => withQuotaTimeout(adapter.type, adapter.getQuotaWindows!())),
  );

  return Promise.all(
    settled.map(async (result, i) => {
      const adapterType = adapters[i]!.type;
      const base: ProviderQuotaResult =
        result.status === "fulfilled"
          ? result.value
          : {
              provider: providerSlugForAdapterType(adapterType),
              ok: false,
              error: String(result.reason),
              windows: [],
            };
      if (adapterType === "gemini_local" && db && (!base.ok || base.windows.length === 0)) {
        return enrichGeminiWithReactiveEstimate(db, base);
      }
      return base;
    }),
  );
}

/**
 * When gemini's live quota read is unavailable, derive a coarse exhaustion estimate
 * from recent gemini_local heartbeat runs that failed with rate-limit/quota errors.
 */
async function enrichGeminiWithReactiveEstimate(
  db: Db,
  base: ProviderQuotaResult,
): Promise<ProviderQuotaResult> {
  let samples: GeminiQuotaRunSample[];
  try {
    samples = await recentGeminiRunSamples(db);
  } catch {
    return base;
  }

  const windows = buildGeminiReactiveWindows(samples);
  if (windows.length === 0) return base;

  return {
    provider: "google",
    source: GEMINI_QUOTA_SOURCE_HEARTBEAT_ESTIMATE,
    ok: true,
    windows,
  };
}

async function recentGeminiRunSamples(db: Db): Promise<GeminiQuotaRunSample[]> {
  const since = new Date(Date.now() - GEMINI_REACTIVE_LOOKBACK_MS);
  const rows = await db
    .select({
      error: heartbeatRuns.error,
      stdoutExcerpt: heartbeatRuns.stdoutExcerpt,
      stderrExcerpt: heartbeatRuns.stderrExcerpt,
      resultJson: heartbeatRuns.resultJson,
      exitCode: heartbeatRuns.exitCode,
      finishedAt: heartbeatRuns.finishedAt,
      createdAt: heartbeatRuns.createdAt,
    })
    .from(heartbeatRuns)
    .innerJoin(agents, eq(agents.id, heartbeatRuns.agentId))
    .where(and(eq(agents.adapterType, "gemini_local"), gte(heartbeatRuns.createdAt, since)))
    .orderBy(desc(heartbeatRuns.createdAt))
    .limit(100);

  return rows.map((row) => ({
    at: row.finishedAt ?? row.createdAt,
    failed: Boolean(row.error) || (row.exitCode != null && row.exitCode !== 0),
    error: row.error,
    stdout: row.stdoutExcerpt,
    stderr: row.stderrExcerpt,
    parsed: row.resultJson ?? null,
  }));
}

async function withQuotaTimeout(
  adapterType: string,
  task: Promise<ProviderQuotaResult>,
): Promise<ProviderQuotaResult> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<ProviderQuotaResult>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({
            provider: providerSlugForAdapterType(adapterType),
            ok: false,
            error: `quota polling timed out after ${Math.round(QUOTA_PROVIDER_TIMEOUT_MS / 1000)}s`,
            windows: [],
          });
        }, QUOTA_PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
