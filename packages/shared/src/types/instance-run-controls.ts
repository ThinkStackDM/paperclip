/**
 * Instance-level run controls: global pause, per-adapter-family pause, and
 * per-adapter-type concurrency caps. These gate when heartbeat runs may start;
 * gated runs are deferred (left queued), never failed.
 */

export interface InstanceRunPause {
  reason: string | null;
  pausedAt: Date | null;
  pausedBy: string | null;
}

export interface InstanceAdapterDailyRunBudget {
  maxRunsPerDay: number;
  alertThresholdPct: number;
}

export interface InstanceAdapterDailyRunBudgetState extends InstanceAdapterDailyRunBudget {
  observedRunsToday: number;
  remainingRunsToday: number;
  alertAtRuns: number;
  state: "ok" | "alert" | "capped";
  windowStart: string;
  windowEnd: string;
}

export interface InstanceRunControls {
  /** When set, no heartbeat runs start anywhere on the instance. */
  pauseAll: InstanceRunPause | null;
  /** Per adapter family (adapterType) pauses, e.g. claude_local when Max limits hit. */
  adapterPauses: Record<string, InstanceRunPause>;
  /**
   * Max simultaneously running heartbeat runs per adapter type. The `default`
   * key applies to any adapter type without an explicit entry.
   */
  adapterConcurrency: Record<string, number>;
  /**
   * Optional per-adapter-type daily heartbeat run budgets, enforced instance-wide.
   * These are hard-capped at 100% and surface an alert state at or above the
   * configured threshold percentage.
   */
  adapterDailyRunBudgets: Record<string, InstanceAdapterDailyRunBudget>;
  /** Max simultaneously running heartbeat runs across the whole instance. */
  globalConcurrency: number;
}

export const DEFAULT_ADAPTER_CONCURRENCY: Record<string, number> = {
  claude_local: 3,
  codex_local: 3,
  default: 2,
};

export const DEFAULT_GLOBAL_CONCURRENCY = 20;

/** Adapter types never throttled by concurrency caps (deterministic, near-zero cost). */
export const CONCURRENCY_EXEMPT_ADAPTER_TYPES = ["paperclip_shell_handler"] as const;
