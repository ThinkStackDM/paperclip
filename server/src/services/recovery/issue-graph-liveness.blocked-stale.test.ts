import { describe, expect, it } from "vitest";
import {
  classifyIssueGraphLiveness,
  type IssueLivenessAgentInput,
  type IssueLivenessIssueInput,
} from "./issue-graph-liveness.js";

const NOW = new Date("2026-06-19T12:00:00Z");
const THREE_DAYS_AGO = new Date("2026-06-16T12:00:00Z");

const agent: IssueLivenessAgentInput = {
  id: "a1",
  companyId: "c1",
  name: "Engineer",
  role: "engineer",
  status: "idle",
};

function blockedIssue(overrides: Partial<IssueLivenessIssueInput> = {}): IssueLivenessIssueInput {
  return {
    id: "i1",
    companyId: "c1",
    identifier: "I-1",
    title: "Wedged parent",
    status: "blocked",
    assigneeAgentId: "a1",
    ...overrides,
  };
}

describe("issue-graph liveness: blocked_without_actionable_blocker", () => {
  it("flags a stale blocked issue with no actionable blocker chain or waiting path", () => {
    const findings = classifyIssueGraphLiveness({
      issues: [blockedIssue({ updatedAt: THREE_DAYS_AGO })],
      relations: [],
      agents: [agent],
      now: NOW,
      blockedStaleHours: 48,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("blocked_without_actionable_blocker");
    expect(findings[0].issueId).toBe("i1");
    expect(findings[0].recommendedOwnerAgentId).toBe("a1");
  });

  it("does NOT flag a freshly-blocked issue (staleness gate)", () => {
    const findings = classifyIssueGraphLiveness({
      issues: [blockedIssue({ updatedAt: NOW })],
      relations: [],
      agents: [agent],
      now: NOW,
      blockedStaleHours: 48,
    });
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag when the issue has an explicit waiting path (human owner)", () => {
    const findings = classifyIssueGraphLiveness({
      issues: [blockedIssue({ updatedAt: THREE_DAYS_AGO, assigneeUserId: "u1" })],
      relations: [],
      agents: [agent],
      now: NOW,
      blockedStaleHours: 48,
    });
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag when an unresolved blocker still exists (defers to the blocked-by states)", () => {
    const blocker = blockedIssue({ id: "i2", identifier: "I-2", title: "Live blocker", status: "in_progress", assigneeAgentId: "a1" });
    const findings = classifyIssueGraphLiveness({
      issues: [blockedIssue({ updatedAt: THREE_DAYS_AGO }), blocker],
      relations: [{ companyId: "c1", blockerIssueId: "i2", blockedIssueId: "i1" }],
      agents: [agent],
      now: NOW,
      blockedStaleHours: 48,
    });
    // i1 has a live (in_progress) blocker -> not a "no actionable blocker" wedge.
    expect(findings.some((f) => f.state === "blocked_without_actionable_blocker")).toBe(false);
  });
});
