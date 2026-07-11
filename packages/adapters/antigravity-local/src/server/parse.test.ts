import { describe, expect, it } from "vitest";
import { detectAntigravityQuotaExhausted } from "./parse.js";

describe("detectAntigravityQuotaExhausted", () => {
  it("requires a strong quota signature and parses the reset countdown", () => {
    const now = new Date("2026-07-11T10:00:00.000Z");
    const result = detectAntigravityQuotaExhausted({
      stderr: "Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 1d 2h 3m 4s.",
      now,
    });

    expect(result.exhausted).toBe(true);
    expect(result.matchedLine).toContain("Individual quota reached");
    expect(result.resetAt?.toISOString()).toBe("2026-07-12T12:03:04.000Z");
  });

  it("does not treat a bare 429 as quota exhaustion", () => {
    const result = detectAntigravityQuotaExhausted({
      stderr: "HTTP 429 Too Many Requests",
    });

    expect(result).toEqual({
      exhausted: false,
      matchedLine: null,
      resetAt: null,
    });
  });
});
