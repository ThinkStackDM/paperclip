import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../adapters/registry.js", () => ({
  listServerAdapters: vi.fn(),
}));

import { listServerAdapters } from "../adapters/registry.js";
import { fetchAllQuotaWindows } from "../services/quota-windows.js";

describe("fetchAllQuotaWindows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns adapter results without waiting for a slower provider to finish forever", async () => {
    vi.mocked(listServerAdapters).mockReturnValue([
      {
        type: "codex_local",
        getQuotaWindows: vi.fn().mockResolvedValue({
          provider: "openai",
          source: "codex-rpc",
          ok: true,
          windows: [{ label: "5h limit", usedPercent: 2, resetsAt: null, valueLabel: null, detail: null }],
        }),
      },
      {
        type: "claude_local",
        getQuotaWindows: vi.fn(() => new Promise(() => {})),
      },
    ] as never);

    const promise = fetchAllQuotaWindows();
    await vi.advanceTimersByTimeAsync(20_001);
    const results = await promise;

    expect(results).toEqual([
      {
        provider: "openai",
        source: "codex-rpc",
        ok: true,
        windows: [{ label: "5h limit", usedPercent: 2, resetsAt: null, valueLabel: null, detail: null }],
      },
      {
        provider: "anthropic",
        ok: false,
        error: "quota polling timed out after 20s",
        windows: [],
      },
    ]);
  });

  it("falls back to a reactive estimate when the gemini live read fails and recent runs were rate-limited", async () => {
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
    vi.mocked(listServerAdapters).mockReturnValue([
      {
        type: "gemini_local",
        getQuotaWindows: vi.fn().mockResolvedValue({
          provider: "google",
          ok: false,
          error: "Gemini Code Assist quota: gemini OAuth token is expired",
          windows: [],
        }),
      },
    ] as never);

    // Minimal drizzle query-builder stub returning one quota-exhausted gemini run.
    const rows = [
      {
        error: 'ApiError: got status: 429 Too Many Requests. {"error":{"status":"RESOURCE_EXHAUSTED"}}',
        stdoutExcerpt: null,
        stderrExcerpt: null,
        resultJson: null,
        exitCode: 1,
        finishedAt: new Date("2026-06-11T11:40:00Z"),
        createdAt: new Date("2026-06-11T11:40:00Z"),
      },
    ];
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "from", "innerJoin", "where", "orderBy"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.limit = vi.fn(() => Promise.resolve(rows));
    const db = builder as never;

    const results = await fetchAllQuotaWindows(db);

    expect(results).toEqual([
      {
        provider: "google",
        source: "gemini-heartbeat-estimate",
        ok: true,
        windows: [
          {
            label: "Google AI (estimated)",
            usedPercent: 100,
            resetsAt: null,
            valueLabel: "Exhausted",
            detail: "Reactive estimate — last rate-limit at 2026-06-11T11:40:00.000Z",
          },
        ],
      },
    ]);
  });

  it("keeps the live gemini result when it succeeds (no db query needed)", async () => {
    const geminiGetQuotaWindows = vi.fn().mockResolvedValue({
      provider: "google",
      source: "gemini-code-assist",
      ok: true,
      windows: [{ label: "gemini-2.5-pro", usedPercent: 40, resetsAt: null, valueLabel: null, detail: null }],
    });
    vi.mocked(listServerAdapters).mockReturnValue([
      { type: "gemini_local", getQuotaWindows: geminiGetQuotaWindows },
    ] as never);

    const limit = vi.fn();
    const db = { select: vi.fn(() => ({ from: vi.fn() })), limit } as never;

    const results = await fetchAllQuotaWindows(db);

    expect(results[0]?.source).toBe("gemini-code-assist");
    expect(limit).not.toHaveBeenCalled();
  });
});
