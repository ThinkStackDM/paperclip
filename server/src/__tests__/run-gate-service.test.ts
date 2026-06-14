import { describe, expect, it, vi } from "vitest";
import type { Db } from "@paperclipai/db";
import {
  getActivityWindowState,
  isActivityWindowOpen,
  parseCompanyActivityWindow,
} from "@paperclipai/shared";
import {
  isActivityWindowExemptAgent,
  normalizeInstanceRunControls,
  resolveAdapterConcurrencyCap,
  runGateService,
} from "../services/run-gate.ts";

/**
 * Mirrors the budgets-service test harness: a queue-backed drizzle stub where
 * each select resolves the next queued result. Select order inside
 * getRunGateBlock (with adapterType pre-supplied):
 *   1. instance_settings row   -> [{ runControls }]
 *   2. companies gate row      -> [{ id, name, activityWindow, runPauseState, emergencyStopState }]
 *   3. running-run count       -> [{ count }] (only when a concurrency cap applies)
 */
function createDbStub(results: unknown[][]) {
  const pending = [...results];
  const next = async () => pending.shift() ?? [];
  const where = vi.fn(() => next());
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ where, innerJoin }));
  const select = vi.fn(() => ({ from }));
  return { db: { select } as unknown as Db, select };
}

const instanceRow = (runControls: Record<string, unknown> = {}) => [{ runControls }];
const companyRow = (overrides: Record<string, unknown> = {}) => [
  {
    id: "company-1",
    name: "ThinkStack Books",
    activityWindow: null,
    runPauseState: {},
    emergencyStopState: {},
    ...overrides,
  },
];
const countRow = (count: number) => [{ count }];

const DUBLIN_BOOKS_WINDOW = { timezone: "Europe/Dublin", startHour: 0, endHour: 4 };
// June 2026: Dublin is on IST (UTC+1).
const DUBLIN_0230 = new Date("2026-06-11T01:30:00Z"); // 02:30 Dublin — inside 00-04
const DUBLIN_1030 = new Date("2026-06-11T09:30:00Z"); // 10:30 Dublin — outside 00-04
const DUBLIN_2100 = new Date("2026-06-11T20:00:00Z"); // 21:00 Dublin
const DUBLIN_1900 = new Date("2026-06-11T18:00:00Z"); // 19:00 Dublin

const baseAgent = {
  companyId: "company-1",
  agentId: "agent-1",
  adapterType: "claude_local",
  agentRuntimeConfig: {},
};

describe("runGateService.getRunGateBlock", () => {
  it("returns null when nothing is paused, no window is set, and the adapter is under its cap", async () => {
    const { db } = createDbStub([instanceRow(), companyRow(), countRow(0)]);
    const block = await runGateService(db).getRunGateBlock({ ...baseAgent, now: DUBLIN_1030 });
    expect(block).toBeNull();
  });

  it("defers every run while the instance is paused, including exempt adapters", async () => {
    const paused = instanceRow({ pauseAll: { reason: "maintenance", pausedAt: new Date().toISOString(), pausedBy: "davin" } });
    const { db } = createDbStub([paused]);
    const block = await runGateService(db).getRunGateBlock({
      ...baseAgent,
      adapterType: "paperclip_shell_handler",
    });
    expect(block?.kind).toBe("instance_paused");
    expect(block?.reason).toContain("maintenance");
  });

  it("defers runs for a paused adapter family but not for other families", async () => {
    const controls = { adapterPauses: { claude_local: { reason: "Max limits hit", pausedAt: new Date().toISOString(), pausedBy: "davin" } } };
    const { db } = createDbStub([instanceRow(controls)]);
    const block = await runGateService(db).getRunGateBlock({ ...baseAgent, adapterType: "claude_local" });
    expect(block?.kind).toBe("adapter_family_paused");
    expect(block?.reason).toContain("Max limits hit");

    const { db: db2 } = createDbStub([instanceRow(controls), companyRow(), countRow(0)]);
    const other = await runGateService(db2).getRunGateBlock({ ...baseAgent, adapterType: "codex_local" });
    expect(other).toBeNull();
  });

  it("defers runs while the company is paused, with the operator's reason", async () => {
    const { db } = createDbStub([
      instanceRow(),
      companyRow({ runPauseState: { active: true, reason: "books quarter close", pausedAt: new Date().toISOString(), pausedBy: "davin" } }),
    ]);
    const block = await runGateService(db).getRunGateBlock(baseAgent);
    expect(block?.kind).toBe("company_paused");
    expect(block?.reason).toContain("books quarter close");
  });

  it("treats an uncleared stop_mutation emergency stop as a company pause", async () => {
    const { db } = createDbStub([
      instanceRow(),
      companyRow({ emergencyStopState: { mode: "stop_mutation", reason: "runaway agent", createdAt: new Date().toISOString() } }),
    ]);
    const block = await runGateService(db).getRunGateBlock(baseAgent);
    expect(block?.kind).toBe("company_paused");
    expect(block?.reason).toContain("emergency stop");
    expect(block?.reason).toContain("runaway agent");
  });

  it("does not block runs for cleared or recovery-mode emergency stops", async () => {
    const cleared = createDbStub([
      instanceRow(),
      companyRow({ emergencyStopState: { mode: "stop_mutation", reason: "done", clearedAt: new Date().toISOString() } }),
      countRow(0),
    ]);
    expect(await runGateService(cleared.db).getRunGateBlock({ ...baseAgent, now: DUBLIN_1030 })).toBeNull();

    const recovery = createDbStub([
      instanceRow(),
      companyRow({ emergencyStopState: { mode: "recovery", reason: "recovering" } }),
      countRow(0),
    ]);
    expect(await runGateService(recovery.db).getRunGateBlock({ ...baseAgent, now: DUBLIN_1030 })).toBeNull();
  });

  it("defers runs outside the company activity window with a clear reason and next-open time", async () => {
    const { db } = createDbStub([instanceRow(), companyRow({ activityWindow: DUBLIN_BOOKS_WINDOW })]);
    const block = await runGateService(db).getRunGateBlock({ ...baseAgent, now: DUBLIN_1030 });
    expect(block?.kind).toBe("outside_activity_window");
    expect(block?.reason).toContain("sprint window");
    expect(block?.reason).toContain("00:00 (Europe/Dublin)");
    expect(block?.nextChangeAt).toBeInstanceOf(Date);
    // Next boundary is 00:00 Dublin = 23:00Z the same day.
    expect(block?.nextChangeAt?.toISOString()).toBe("2026-06-11T23:00:00.000Z");
  });

  it("starts runs inside the company activity window", async () => {
    const { db } = createDbStub([instanceRow(), companyRow({ activityWindow: DUBLIN_BOOKS_WINDOW }), countRow(0)]);
    const block = await runGateService(db).getRunGateBlock({ ...baseAgent, now: DUBLIN_0230 });
    expect(block).toBeNull();
  });

  it("bypasses the activity-window defer for a manual operator override (isManualOverride)", async () => {
    // Operator wakes from /heartbeat/invoke and /wakeup (triggerDetail "manual")
    // must run even in a dormant company — mirroring the enqueue-time dormancy
    // guard, which also lets manual wakes through. Window is bypassed, so the
    // flow falls through to the concurrency check (countRow needed).
    const { db } = createDbStub([
      instanceRow(),
      companyRow({ activityWindow: DUBLIN_BOOKS_WINDOW }),
      countRow(0),
    ]);
    const block = await runGateService(db).getRunGateBlock({
      ...baseAgent,
      isManualOverride: true,
      now: DUBLIN_1030,
    });
    expect(block).toBeNull();
  });

  it("still defers a manual override when the company is explicitly paused (override does not beat a pause)", async () => {
    const { db } = createDbStub([
      instanceRow(),
      companyRow({
        activityWindow: DUBLIN_BOOKS_WINDOW,
        runPauseState: { active: true, reason: "maintenance" },
      }),
    ]);
    const block = await runGateService(db).getRunGateBlock({
      ...baseAgent,
      isManualOverride: true,
      now: DUBLIN_1030,
    });
    expect(block?.kind).toBe("company_paused");
  });

  it("handles wrap-past-midnight windows (Recruitment 20:00-00:00)", async () => {
    const window = { timezone: "Europe/Dublin", startHour: 20, endHour: 0 };
    const open = createDbStub([instanceRow(), companyRow({ activityWindow: window }), countRow(0)]);
    expect(await runGateService(open.db).getRunGateBlock({ ...baseAgent, now: DUBLIN_2100 })).toBeNull();

    const closed = createDbStub([instanceRow(), companyRow({ activityWindow: window })]);
    const block = await runGateService(closed.db).getRunGateBlock({ ...baseAgent, now: DUBLIN_1900 });
    expect(block?.kind).toBe("outside_activity_window");
  });

  it("exempts paperclip_shell_handler from windows and concurrency", async () => {
    const { db, select } = createDbStub([instanceRow(), companyRow({ activityWindow: DUBLIN_BOOKS_WINDOW })]);
    const block = await runGateService(db).getRunGateBlock({
      ...baseAgent,
      adapterType: "paperclip_shell_handler",
      now: DUBLIN_1030,
    });
    expect(block).toBeNull();
    // Instance settings + company row only — no concurrency count query.
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("exempts agents with runtimeConfig.ignoreActivityWindow from the window but not from concurrency", async () => {
    const { db } = createDbStub([instanceRow(), companyRow({ activityWindow: DUBLIN_BOOKS_WINDOW }), countRow(3)]);
    const block = await runGateService(db).getRunGateBlock({
      ...baseAgent,
      agentRuntimeConfig: { ignoreActivityWindow: true },
      now: DUBLIN_1030,
    });
    expect(block?.kind).toBe("adapter_concurrency_limit");
    expect(block?.reason).toContain("3/3");
  });

  it("defers runs at the default claude_local cap of 3 and respects explicit overrides", async () => {
    const atCap = createDbStub([instanceRow(), companyRow(), countRow(3)]);
    const block = await runGateService(atCap.db).getRunGateBlock(baseAgent);
    expect(block?.kind).toBe("adapter_concurrency_limit");

    const raised = createDbStub([
      instanceRow({ adapterConcurrency: { claude_local: 5 } }),
      companyRow(),
      countRow(3),
    ]);
    expect(await runGateService(raised.db).getRunGateBlock(baseAgent)).toBeNull();
  });

  it("caps unknown adapter types at the default of 2", async () => {
    const { db } = createDbStub([instanceRow(), companyRow(), countRow(2)]);
    const block = await runGateService(db).getRunGateBlock({ ...baseAgent, adapterType: "antigravity_local" });
    expect(block?.kind).toBe("adapter_concurrency_limit");
    expect(block?.reason).toContain("2/2");
  });

  it("fetches adapterType and runtimeConfig from the agent row when not supplied", async () => {
    const { db } = createDbStub([
      [{ adapterType: "paperclip_shell_handler", runtimeConfig: {} }],
      instanceRow(),
      companyRow({ activityWindow: DUBLIN_BOOKS_WINDOW }),
    ]);
    const block = await runGateService(db).getRunGateBlock({
      companyId: "company-1",
      agentId: "agent-1",
      now: DUBLIN_1030,
    });
    expect(block).toBeNull();
  });
});

describe("run gate helpers", () => {
  it("normalizeInstanceRunControls fills concurrency defaults and drops invalid entries", () => {
    const controls = normalizeInstanceRunControls({
      adapterConcurrency: { claude_local: 7, bogus: 0, weird: "x" },
      adapterPauses: { codex_local: { reason: "limit", pausedAt: new Date().toISOString(), pausedBy: "davin" }, junk: "nope" },
      pauseAll: null,
    });
    expect(controls.adapterConcurrency.claude_local).toBe(7);
    expect(controls.adapterConcurrency.codex_local).toBe(3);
    expect(controls.adapterConcurrency.default).toBe(2);
    expect(controls.adapterConcurrency.bogus).toBeUndefined();
    expect(controls.adapterPauses.codex_local?.reason).toBe("limit");
    expect(controls.adapterPauses.junk).toBeUndefined();
    expect(controls.pauseAll).toBeNull();
  });

  it("resolveAdapterConcurrencyCap exempts the shell handler and falls back to default", () => {
    const controls = normalizeInstanceRunControls({});
    expect(resolveAdapterConcurrencyCap(controls, "paperclip_shell_handler")).toBeNull();
    expect(resolveAdapterConcurrencyCap(controls, "claude_local")).toBe(3);
    expect(resolveAdapterConcurrencyCap(controls, "codex_local")).toBe(3);
    expect(resolveAdapterConcurrencyCap(controls, "gemini_local")).toBe(2);
  });

  it("isActivityWindowExemptAgent honors adapter type and runtimeConfig flag", () => {
    expect(isActivityWindowExemptAgent({ adapterType: "paperclip_shell_handler", runtimeConfig: null })).toBe(true);
    expect(isActivityWindowExemptAgent({ adapterType: "claude_local", runtimeConfig: { ignoreActivityWindow: true } })).toBe(true);
    expect(isActivityWindowExemptAgent({ adapterType: "claude_local", runtimeConfig: { ignoreActivityWindow: "yes" } })).toBe(false);
    expect(isActivityWindowExemptAgent({ adapterType: "claude_local", runtimeConfig: null })).toBe(false);
  });

  it("window math: Dublin windows open/close at local hours and report boundaries", () => {
    const window = parseCompanyActivityWindow(DUBLIN_BOOKS_WINDOW);
    expect(window).not.toBeNull();
    expect(window?.sessionPurgeOnClose).toBe(true);
    expect(isActivityWindowOpen(window!, DUBLIN_0230)).toBe(true);
    expect(isActivityWindowOpen(window!, DUBLIN_1030)).toBe(false);

    const state = getActivityWindowState(window!, DUBLIN_1030);
    expect(state.open).toBe(false);
    // Window closed at 04:00 Dublin (03:00Z), reopens at 00:00 Dublin (23:00Z).
    expect(state.lastChangeAt?.toISOString()).toBe("2026-06-11T03:00:00.000Z");
    expect(state.nextChangeAt?.toISOString()).toBe("2026-06-11T23:00:00.000Z");
  });

  it("window math: parse rejects malformed windows and honors sessionPurgeOnClose=false", () => {
    expect(parseCompanyActivityWindow(null)).toBeNull();
    expect(parseCompanyActivityWindow({ timezone: "Not/AZone", startHour: 0, endHour: 4 })).toBeNull();
    expect(parseCompanyActivityWindow({ timezone: "Europe/Dublin", startHour: -1, endHour: 4 })).toBeNull();
    expect(parseCompanyActivityWindow({ timezone: "Europe/Dublin", startHour: 0, endHour: 24 })).toBeNull();
    const noPurge = parseCompanyActivityWindow({ ...DUBLIN_BOOKS_WINDOW, sessionPurgeOnClose: false });
    expect(noPurge?.sessionPurgeOnClose).toBe(false);
  });
});
