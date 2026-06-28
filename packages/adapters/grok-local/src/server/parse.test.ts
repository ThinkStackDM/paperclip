import { describe, expect, it } from "vitest";
import { isGrokUnknownSessionError, parseGrokJsonl } from "./parse.js";

describe("parseGrokJsonl", () => {
  it("collects streamed thought/text content and final session metadata", () => {
    const parsed = parseGrokJsonl([
      JSON.stringify({ type: "thought", data: "Plan" }),
      JSON.stringify({ type: "thought", data: " first." }),
      JSON.stringify({ type: "text", data: "hel" }),
      JSON.stringify({ type: "text", data: "lo" }),
      JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "sess-1", requestId: "req-1" }),
    ].join("\n"));

    expect(parsed).toEqual({
      sessionId: "sess-1",
      summary: "hello",
      thought: "Plan first.",
      errorMessage: null,
      stopReason: "EndTurn",
      requestId: "req-1",
      disposition: null,
    });
  });

  it("extracts and strips the final PAPERCLIP_DISPOSITION token", () => {
    const stdout = [
      JSON.stringify({ type: "text", data: "Fixed the issue and verified the targeted tests pass.\n" }),
      JSON.stringify({ type: "text", data: 'PAPERCLIP_DISPOSITION: {"status":"done","hasBlocker":false}' }),
      JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "sess-1", requestId: "req-1" }),
    ].join("\n");

    expect(parseGrokJsonl(stdout)).toEqual({
      sessionId: "sess-1",
      summary: "Fixed the issue and verified the targeted tests pass.",
      thought: "",
      errorMessage: null,
      stopReason: "EndTurn",
      requestId: "req-1",
      disposition: {
        status: "done",
        hasBlocker: false,
      },
    });
  });

  it("reads structured error payloads", () => {
    const parsed = parseGrokJsonl([
      JSON.stringify({ type: "error", error: { message: "Authentication required" } }),
    ].join("\n"));

    expect(parsed.errorMessage).toBe("Authentication required");
  });

  it("separates reasoning turns that grok streaming-json glues together", () => {
    const parsed = parseGrokJsonl([
      JSON.stringify({ type: "thought", data: "The user uses `" }),
      JSON.stringify({ type: "thought", data: "ls" }),
      JSON.stringify({ type: "thought", data: "`" }),
      JSON.stringify({ type: "thought", data: "The" }),
      JSON.stringify({ type: "thought", data: " `" }),
      JSON.stringify({ type: "thought", data: "ls" }),
      JSON.stringify({ type: "thought", data: "`" }),
      JSON.stringify({ type: "thought", data: " returned" }),
      JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "sess-1" }),
    ].join("\n"));

    expect(parsed.thought).toBe("The user uses `ls`\nThe `ls` returned");
  });

  it("preserves assistant text chunks verbatim", () => {
    const parsed = parseGrokJsonl([
      JSON.stringify({ type: "text", data: "Done." }),
      JSON.stringify({ type: "text", data: "Next" }),
      JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "sess-1" }),
    ].join("\n"));

    expect(parsed.summary).toBe("Done.Next");
  });
});

describe("isGrokUnknownSessionError", () => {
  it("detects stale resume failures", () => {
    expect(isGrokUnknownSessionError("", "session not found")).toBe(true);
    expect(isGrokUnknownSessionError("", "everything fine")).toBe(false);
  });
});
