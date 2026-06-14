import { describe, expect, it } from "vitest";
import { buildAntigravityArgs } from "./execute.js";
import { parseAntigravityOutput } from "./parse.js";
import { sessionCodec } from "./index.js";

describe("antigravity_local execute helpers", () => {
  it("builds agy print-mode args for fresh sessions", () => {
    expect(buildAntigravityArgs({
      prompt: "Do the work",
      printTimeout: "10m0s",
      sessionId: null,
      autoApprove: true,
      sandbox: false,
      extraDirs: ["/tmp/extra"],
      extraArgs: ["--log-file", "/tmp/agy.log"],
    })).toEqual([
      "--print",
      "Do the work",
      "--print-timeout",
      "10m0s",
      "--dangerously-skip-permissions",
      "--add-dir",
      "/tmp/extra",
      "--log-file",
      "/tmp/agy.log",
    ]);
  });

  it("builds agy conversation resume args for saved sessions", () => {
    expect(buildAntigravityArgs({
      prompt: "Resume this",
      printTimeout: "5m0s",
      sessionId: "conv-123",
      autoApprove: false,
      sandbox: true,
      extraDirs: [],
      extraArgs: [],
    })).toEqual([
      "--print",
      "Resume this",
      "--print-timeout",
      "5m0s",
      "--conversation",
      "conv-123",
      "--sandbox",
    ]);
  });

  it("serializes conversation session ids", () => {
    expect(sessionCodec.deserialize({ conversationId: "conv-123", cwd: "/repo" })).toEqual({
      sessionId: "conv-123",
      cwd: "/repo",
    });
    expect(sessionCodec.serialize({ sessionId: "conv-123", cwd: "/repo" })).toEqual({
      sessionId: "conv-123",
      cwd: "/repo",
    });
    expect(sessionCodec.getDisplayId?.({ conversation_id: "conv-123" })).toBe("conv-123");
  });

  it("extracts conversation ids when agy prints them", () => {
    expect(parseAntigravityOutput("Conversation ID: conv-123\nDone").sessionId).toBe("conv-123");
  });
});
