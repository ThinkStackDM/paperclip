import { describe, expect, it } from "vitest";
import { getActivityWindowScheduleSkip } from "../services/run-gate.ts";

/**
 * Skip-at-schedule path: the periodic schedulers (heartbeat tickTimers and the
 * issue-monitor tick) call getActivityWindowScheduleSkip BEFORE enqueuing an
 * automated wakeup. A non-null result means the agent's company is outside its
 * activity window and the agent is not window-exempt, so the scheduler must NOT
 * enqueue — leaving the company cleanly dormant instead of piling up deferred
 * queued runs.
 *
 * Mirrors run-gate-service.test.ts: same Dublin windows + instants, same
 * exemption rules (ACTIVITY_WINDOW_EXEMPT_ADAPTER_TYPES shell handlers and
 * runtimeConfig.ignoreActivityWindow agents stay runnable).
 */
const DUBLIN_CAPITAL_WINDOW = { timezone: "Europe/Dublin", startHour: 12, endHour: 16 };
const DUBLIN_BOOKS_WINDOW = { timezone: "Europe/Dublin", startHour: 0, endHour: 4 };

// June 2026: Dublin is on IST (UTC+1).
const DUBLIN_1400 = new Date("2026-06-11T13:00:00Z"); // 14:00 Dublin — inside 12-16
const DUBLIN_2056 = new Date("2026-06-11T19:56:00Z"); // 20:56 Dublin — outside 12-16
const DUBLIN_0230 = new Date("2026-06-11T01:30:00Z"); // 02:30 Dublin — inside 00-04

describe("getActivityWindowScheduleSkip", () => {
  it("skips a non-exempt agent whose company is outside its window, with a clear reason + reopen time", () => {
    const skip = getActivityWindowScheduleSkip({
      activityWindow: DUBLIN_CAPITAL_WINDOW,
      adapterType: "claude_local",
      runtimeConfig: {},
      companyName: "ThinkStack Capital",
      now: DUBLIN_2056,
    });
    expect(skip).not.toBeNull();
    expect(skip?.reason).toContain("ThinkStack Capital");
    expect(skip?.reason).toContain("sprint window");
    expect(skip?.reason).toContain("12:00 (Europe/Dublin)");
    // Window reopens at 12:00 Dublin tomorrow = 11:00Z 2026-06-12.
    expect(skip?.nextChangeAt).toBeInstanceOf(Date);
    expect(skip?.nextChangeAt?.toISOString()).toBe("2026-06-12T11:00:00.000Z");
  });

  it("does NOT skip when the company window is open (agent should enqueue normally)", () => {
    expect(
      getActivityWindowScheduleSkip({
        activityWindow: DUBLIN_CAPITAL_WINDOW,
        adapterType: "claude_local",
        runtimeConfig: {},
        companyName: "ThinkStack Capital",
        now: DUBLIN_1400,
      }),
    ).toBeNull();
  });

  it("does NOT skip a company with no activity window (always active)", () => {
    expect(
      getActivityWindowScheduleSkip({
        activityWindow: null,
        adapterType: "claude_local",
        runtimeConfig: {},
        companyName: "ThinkStack Capital",
        now: DUBLIN_2056,
      }),
    ).toBeNull();
  });

  it("does NOT skip a shell-handler / compiler agent even when the company is closed", () => {
    // Fallback-Compiler runs the around-window handshake/liveness routines.
    expect(
      getActivityWindowScheduleSkip({
        activityWindow: DUBLIN_CAPITAL_WINDOW,
        adapterType: "paperclip_shell_handler",
        runtimeConfig: {},
        companyName: "ThinkStack Capital",
        now: DUBLIN_2056,
      }),
    ).toBeNull();
  });

  it("does NOT skip an ignoreActivityWindow agent even when the company is closed", () => {
    // Capital's PolymarketEngineer hourly eval opts out of the window.
    expect(
      getActivityWindowScheduleSkip({
        activityWindow: DUBLIN_CAPITAL_WINDOW,
        adapterType: "gemini_local",
        runtimeConfig: { ignoreActivityWindow: true },
        companyName: "ThinkStack Capital",
        now: DUBLIN_2056,
      }),
    ).toBeNull();
  });

  it("treats a non-boolean ignoreActivityWindow as NOT exempt (skips when closed)", () => {
    const skip = getActivityWindowScheduleSkip({
      activityWindow: DUBLIN_CAPITAL_WINDOW,
      adapterType: "gemini_local",
      runtimeConfig: { ignoreActivityWindow: "yes" },
      companyName: "ThinkStack Capital",
      now: DUBLIN_2056,
    });
    expect(skip).not.toBeNull();
  });

  it("handles a different window (Books 00-04): open inside, skipped outside", () => {
    expect(
      getActivityWindowScheduleSkip({
        activityWindow: DUBLIN_BOOKS_WINDOW,
        adapterType: "codex_local",
        runtimeConfig: {},
        companyName: "ThinkStack Books",
        now: DUBLIN_0230,
      }),
    ).toBeNull();

    const skip = getActivityWindowScheduleSkip({
      activityWindow: DUBLIN_BOOKS_WINDOW,
      adapterType: "codex_local",
      runtimeConfig: {},
      companyName: "ThinkStack Books",
      now: DUBLIN_2056,
    });
    expect(skip?.reason).toContain("00:00 (Europe/Dublin)");
  });

  it("ignores malformed windows (treated as always active, never skipped)", () => {
    expect(
      getActivityWindowScheduleSkip({
        activityWindow: { timezone: "Not/AZone", startHour: 12, endHour: 16 },
        adapterType: "claude_local",
        runtimeConfig: {},
        companyName: "ThinkStack Capital",
        now: DUBLIN_2056,
      }),
    ).toBeNull();
  });

  it("falls back to a generic company label when no name is supplied", () => {
    const skip = getActivityWindowScheduleSkip({
      activityWindow: DUBLIN_CAPITAL_WINDOW,
      adapterType: "claude_local",
      runtimeConfig: null,
      now: DUBLIN_2056,
    });
    expect(skip?.reason.startsWith("Company is outside")).toBe(true);
  });
});
