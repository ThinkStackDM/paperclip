import { describe, expect, it } from "vitest";
import {
  buildGeminiReactiveWindows,
  mapGeminiQuotaBuckets,
  type GeminiQuotaRunSample,
} from "./quota.js";

describe("mapGeminiQuotaBuckets", () => {
  it("converts remainingFraction into usedPercent and passes reset time through", () => {
    const windows = mapGeminiQuotaBuckets(
      [
        { modelId: "gemini-2.5-pro", remainingFraction: 0.25, resetTime: "2026-06-11T19:00:00Z" },
        { modelId: "gemini-2.5-flash", remainingFraction: 1 },
      ],
      "Google AI Pro",
    );

    expect(windows).toEqual([
      {
        label: "gemini-2.5-pro (Google AI Pro)",
        usedPercent: 75,
        resetsAt: "2026-06-11T19:00:00Z",
        valueLabel: null,
        detail: null,
      },
      {
        label: "gemini-2.5-flash (Google AI Pro)",
        usedPercent: 0,
        resetsAt: null,
        valueLabel: null,
        detail: null,
      },
    ]);
  });

  it("labels without a tier when none is provided and surfaces remainingAmount", () => {
    const windows = mapGeminiQuotaBuckets([
      { modelId: "gemini-2.5-pro", remainingFraction: 0.5, remainingAmount: "42" },
    ]);

    expect(windows).toEqual([
      {
        label: "gemini-2.5-pro",
        usedPercent: 50,
        resetsAt: null,
        valueLabel: "42 remaining",
        detail: null,
      },
    ]);
  });

  it("clamps out-of-range fractions and skips buckets with no usable data", () => {
    const windows = mapGeminiQuotaBuckets([
      { modelId: "over", remainingFraction: 1.5 },
      { modelId: "under", remainingFraction: -0.2 },
      { modelId: "", remainingFraction: 0.5 },
      { modelId: "empty" },
    ]);

    expect(windows).toEqual([
      { label: "over", usedPercent: 0, resetsAt: null, valueLabel: null, detail: null },
      { label: "under", usedPercent: 100, resetsAt: null, valueLabel: null, detail: null },
    ]);
  });

  it("converts numeric epoch reset times to iso", () => {
    const seconds = Date.UTC(2026, 5, 11, 19, 0, 0) / 1000;
    const [window] = mapGeminiQuotaBuckets([
      { modelId: "gemini-2.5-pro", remainingFraction: 0.5, resetTime: seconds },
    ]);
    expect(window?.resetsAt).toBe("2026-06-11T19:00:00.000Z");
  });

  it("returns no windows for null input", () => {
    expect(mapGeminiQuotaBuckets(null)).toEqual([]);
    expect(mapGeminiQuotaBuckets(undefined)).toEqual([]);
  });
});

describe("buildGeminiReactiveWindows", () => {
  const now = new Date("2026-06-11T12:00:00Z");

  function exhaustedSample(at: string): GeminiQuotaRunSample {
    return {
      at: new Date(at),
      failed: true,
      error: "ApiError: got status: 429 Too Many Requests. {\"error\":{\"code\":429,\"status\":\"RESOURCE_EXHAUSTED\"}}",
    };
  }

  function successSample(at: string): GeminiQuotaRunSample {
    return { at: new Date(at), failed: false };
  }

  it("returns an exhausted window when the latest decisive run is a quota failure", () => {
    const windows = buildGeminiReactiveWindows(
      [successSample("2026-06-11T10:00:00Z"), exhaustedSample("2026-06-11T11:30:00Z")],
      { now },
    );

    expect(windows).toEqual([
      {
        label: "Google AI (estimated)",
        usedPercent: 100,
        resetsAt: null,
        valueLabel: "Exhausted",
        detail: "Reactive estimate — last rate-limit at 2026-06-11T11:30:00.000Z",
      },
    ]);
  });

  it("recovers (no window) when a success follows the last rate-limit", () => {
    const windows = buildGeminiReactiveWindows(
      [exhaustedSample("2026-06-11T11:00:00Z"), successSample("2026-06-11T11:45:00Z")],
      { now },
    );
    expect(windows).toEqual([]);
  });

  it("ignores exhaustion older than the max age", () => {
    const windows = buildGeminiReactiveWindows([exhaustedSample("2026-06-11T01:00:00Z")], {
      now,
      maxAgeMs: 6 * 60 * 60 * 1000,
    });
    expect(windows).toEqual([]);
  });

  it("does not treat non-quota failures as exhaustion", () => {
    const windows = buildGeminiReactiveWindows(
      [{ at: new Date("2026-06-11T11:30:00Z"), failed: true, error: "Timed out after 600s" }],
      { now },
    );
    expect(windows).toEqual([]);
  });

  it("returns no windows when there are no samples", () => {
    expect(buildGeminiReactiveWindows([], { now })).toEqual([]);
  });
});
