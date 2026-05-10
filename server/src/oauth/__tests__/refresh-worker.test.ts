import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runRefreshTick } from "../refresh-worker.js";

describe("runRefreshTick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  function buildDeps(opts: {
    candidates: Array<Record<string, unknown>>;
    locked?: boolean;
    refreshFn?: ReturnType<typeof vi.fn>;
  }) {
    const acquired = opts.locked !== false;
    const execute = vi
      .fn()
      // first call: pg_try_advisory_lock
      .mockResolvedValueOnce({ rows: [{ result: acquired }] })
      // second call: pg_advisory_unlock
      .mockResolvedValue({ rows: [{ result: true }] });
    const findMany = vi.fn().mockResolvedValue(opts.candidates);
    const refreshFn =
      opts.refreshFn ??
      vi.fn().mockResolvedValue({ outcome: "success", accessToken: "x" });
    const db = {
      execute,
      query: { oauthConnections: { findMany } },
    } as unknown as Parameters<typeof runRefreshTick>[0]["db"];
    return { db, refreshFn, execute, findMany };
  }

  it("filters out rows still in backoff and refreshes the rest", async () => {
    const candidates = [
      { id: "a", refreshAttemptCount: 0, lastErrorAt: null },
      // 3 attempts -> backoff = min(2^3 * 30, 3600) = 240s; lastErrorAt = now
      { id: "b", refreshAttemptCount: 3, lastErrorAt: new Date() },
    ];
    const { db, refreshFn } = buildDeps({ candidates });
    await runRefreshTick({
      db,
      refreshFn,
      registry: {} as never,
      secretService: {} as never,
    });
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(refreshFn.mock.calls[0]?.[0].connectionId).toBe("a");
  });

  it("skips when advisory lock not acquired", async () => {
    const { db, refreshFn } = buildDeps({ candidates: [], locked: false });
    await runRefreshTick({
      db,
      refreshFn,
      registry: {} as never,
      secretService: {} as never,
    });
    expect(refreshFn).not.toHaveBeenCalled();
  });

  it("filters a row with refreshAttemptCount=1 whose backoff (60s) hasn't elapsed", async () => {
    // backoffSeconds(1) = min(2 * 30, 3600) = 60s.
    // lastErrorAt is 10s ago, so minRetryAt = 50s in the future -> filter out.
    const candidates = [
      {
        id: "in-backoff",
        refreshAttemptCount: 1,
        lastErrorAt: new Date(Date.now() - 10_000),
      },
      // Also include a control row that *should* be eligible.
      { id: "ok", refreshAttemptCount: 0, lastErrorAt: null },
    ];
    const { db, refreshFn } = buildDeps({ candidates });
    await runRefreshTick({
      db,
      refreshFn,
      registry: {} as never,
      secretService: {} as never,
    });
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(refreshFn.mock.calls[0]?.[0].connectionId).toBe("ok");
  });

  it("releases the advisory lock after a successful tick", async () => {
    const { db, refreshFn, execute } = buildDeps({ candidates: [] });
    await runRefreshTick({
      db,
      refreshFn,
      registry: {} as never,
      secretService: {} as never,
    });
    // execute called twice: try_advisory_lock + advisory_unlock
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("logs and continues if a refreshFn throws", async () => {
    const candidates = [
      { id: "a", refreshAttemptCount: 0, lastErrorAt: null },
      { id: "b", refreshAttemptCount: 0, lastErrorAt: null },
    ];
    const refreshFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ outcome: "success", accessToken: "x" });
    const { db } = buildDeps({ candidates, refreshFn });
    await runRefreshTick({
      db,
      refreshFn,
      registry: {} as never,
      secretService: {} as never,
    });
    // Both rows attempted despite the first throwing.
    expect(refreshFn).toHaveBeenCalledTimes(2);
  });
});
