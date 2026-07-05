import { beforeEach, describe, expect, it, vi } from "vitest";
import { queueIssueAssignmentWakeup } from "../services/issue-assignment-wakeup.ts";
import { logger } from "../middleware/logger.js";

vi.mock("../middleware/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("queueIssueAssignmentWakeup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downgrades non-invokable assignment wake conflicts to info", async () => {
    const err = Object.assign(new Error("Agent is not invokable in its current state"), {
      status: 409,
      details: { reason: "paused", agentStatus: "paused" },
    });
    const wakeup = vi.fn().mockRejectedValue(err);

    const result = await queueIssueAssignmentWakeup({
      heartbeat: { wakeup },
      issue: { id: "issue-1", assigneeAgentId: "agent-1", status: "todo" },
      reason: "issue_assigned",
      mutation: "assign",
      contextSource: "issues.patch",
    });

    expect(result).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        err,
        issueId: "issue-1",
        assigneeAgentId: "agent-1",
      }),
      "skipping assignment wake for non-invokable assignee",
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("keeps unexpected wake failures at warn", async () => {
    const err = new Error("socket timeout");
    const wakeup = vi.fn().mockRejectedValue(err);

    const result = await queueIssueAssignmentWakeup({
      heartbeat: { wakeup },
      issue: { id: "issue-2", assigneeAgentId: "agent-2", status: "todo" },
      reason: "issue_assigned",
      mutation: "assign",
      contextSource: "issues.patch",
    });

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err, issueId: "issue-2" }),
      "failed to wake assignee on issue assignment",
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("rethrows after logging when requested", async () => {
    const err = Object.assign(new Error("Agent is not invokable because its reporting chain is invalid"), {
      status: 409,
      details: { reason: "manager_terminated", invalidOrgChain: true },
    });
    const wakeup = vi.fn().mockRejectedValue(err);

    await expect(() => queueIssueAssignmentWakeup({
      heartbeat: { wakeup },
      issue: { id: "issue-3", assigneeAgentId: "agent-3", status: "todo" },
      reason: "issue_assigned",
      mutation: "assign",
      contextSource: "issues.patch",
      rethrowOnError: true,
    })).rejects.toBe(err);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        err,
        issueId: "issue-3",
        assigneeAgentId: "agent-3",
      }),
      "skipping assignment wake for non-invokable assignee",
    );
  });
});
