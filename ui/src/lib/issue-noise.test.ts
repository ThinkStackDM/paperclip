import { describe, expect, it } from "vitest";
import { isCoordinationNoiseIssue } from "./issue-noise";
import { applyIssueFilters, defaultIssueFilterState, normalizeIssueFilterState } from "./issue-filters";
import type { Issue } from "@paperclipai/shared";

function issueWithTitle(title: string): Issue {
  return { id: title, title, status: "done", priority: "medium" } as unknown as Issue;
}

describe("isCoordinationNoiseIssue", () => {
  it("matches known synthetic coordination titles case-insensitively", () => {
    const noisy = [
      "Mission Control Inbound (Secondary)",
      "MC Inbound handshake",
      "Halt-trigger probe",
      "ack-sweep 2026-06-11",
      "binding-invariant probe #12",
      "Review silent active run for THIAAA-42",
      "Review productivity for THIAAA-101",
      "fallback-monitor fire",
      "MC token-burn watchdog",
    ];
    for (const title of noisy) {
      expect(isCoordinationNoiseIssue(issueWithTitle(title)), title).toBe(true);
    }
  });

  it("does not match real work", () => {
    const real = [
      "Stand up build & deploy pipeline + ship Site #3",
      "Draft privacy policy + About page",
      "Fix MCInboundHandler error state",
      "Audit duplicate queue alerts and propose consolidation plan",
    ];
    for (const title of real) {
      expect(isCoordinationNoiseIssue(issueWithTitle(title)), title).toBe(false);
    }
  });
});

describe("hideNoiseIssues filter state", () => {
  it("defaults to hiding noise and treats missing persisted keys as ON", () => {
    expect(defaultIssueFilterState.hideNoiseIssues).toBe(true);
    expect(normalizeIssueFilterState({}).hideNoiseIssues).toBe(true);
    expect(normalizeIssueFilterState({ hideNoiseIssues: false }).hideNoiseIssues).toBe(false);
  });

  it("filters noise only when the routine-visibility views enable it", () => {
    const issues = [issueWithTitle("MC token-burn watchdog"), issueWithTitle("Ship the landing page")];
    const state = { ...defaultIssueFilterState };
    expect(applyIssueFilters(issues, state, null, true).map((issue) => issue.title)).toEqual([
      "Ship the landing page",
    ]);
    expect(applyIssueFilters(issues, state, null, false)).toHaveLength(2);
    expect(
      applyIssueFilters(issues, { ...state, hideNoiseIssues: false }, null, true),
    ).toHaveLength(2);
  });
});
