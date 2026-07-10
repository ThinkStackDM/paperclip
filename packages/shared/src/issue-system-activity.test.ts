import { describe, expect, it } from "vitest";
import {
  buildIssueCommentSystemActivityPresentation,
  classifyIssueCommentSystemActivity,
} from "./issue-system-activity";

describe("issue system activity classification", () => {
  it("classifies board-action resolved boilerplate", () => {
    expect(classifyIssueCommentSystemActivity({
      body: "Board action resolved — no board decision is pending.\n\n- request_confirmation interaction: approved.",
      authorType: "agent",
      authorAgentId: "agent-1",
      authorUserId: null,
      presentation: null,
    })).toEqual({
      kind: "board_action_resolved",
      title: "Board action resolved",
      tone: "info",
    });
  });

  it("treats explicit system_notice presentation as system activity for non-user comments", () => {
    const presentation = buildIssueCommentSystemActivityPresentation({
      kind: "fallback_transfer",
      title: "Recovery routing note",
      tone: "neutral",
    });
    expect(classifyIssueCommentSystemActivity({
      body: "Reassigned to ClaudeFixer.",
      authorType: "agent",
      authorAgentId: "agent-1",
      authorUserId: null,
      presentation,
    })).toEqual({
      kind: "system_notice",
      title: "Recovery routing note",
      tone: "neutral",
    });
  });

  it("does not collapse matching text when the comment came from a user", () => {
    expect(classifyIssueCommentSystemActivity({
      body: "Board action resolved — no board decision is pending.",
      authorType: "user",
      authorAgentId: null,
      authorUserId: "board-user",
      presentation: null,
    })).toBeNull();
  });
});
