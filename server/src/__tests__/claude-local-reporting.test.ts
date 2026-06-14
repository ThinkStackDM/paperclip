import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@paperclipai/adapter-claude-local/server";

async function writeFailingClaudeCommand(
  commandPath: string,
  options: { resultEvent: Record<string, unknown>; exitCode?: number },
): Promise<void> {
  const payload = JSON.stringify(options.resultEvent);
  const exit = options.exitCode ?? 1;
  const script = `#!/usr/bin/env node
console.log(${JSON.stringify(payload)});
process.exit(${exit});
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

async function setupExecuteEnv(root: string) {
  const workspace = path.join(root, "workspace");
  const binDir = path.join(root, "bin");
  const commandPath = path.join(binDir, "claude");
  await fs.mkdir(workspace, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  const previousHome = process.env.HOME;
  const previousPath = process.env.PATH;
  process.env.HOME = root;
  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
  return {
    workspace, commandPath,
    restore: () => {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    },
  };
}

describe("claude_local transient-upstream terminal reporting", () => {
  it("reports transient upstream errors to onLog", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-report-transient-"));
    const { workspace, commandPath, restore } = await setupExecuteEnv(root);
    await writeFailingClaudeCommand(commandPath, {
      resultEvent: {
        type: "result",
        subtype: "error",
        session_id: "claude-session-1",
        is_error: true,
        result: "You're out of extra usage · resets 4pm (America/Chicago)",
        errors: [{ type: "rate_limit_error", message: "You're out of extra usage" }],
      },
    });

    const logs: string[] = [];
    const onLog = async (stream: string, chunk: string) => {
      logs.push(chunk);
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 22, 10, 15, 0));

    try {
      await execute({
        runId: "run-claude-report",
        agent: { id: "agent-1", companyId: "co-1", name: "Test", adapterType: "claude_local", adapterConfig: {} },
        runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
        config: {
          command: commandPath,
          cwd: workspace,
          promptTemplate: "Do work.",
        },
        context: {},
        authToken: "tok",
        onLog,
      });

      const allLogs = logs.join("");
      expect(allLogs).toContain("[paperclip] Detected transient upstream error (e.g. rate limit).");
      expect(allLogs).toContain("Retry scheduled after 2026-04-22T21:00:00.000Z");
    } finally {
      vi.useRealTimers();
      restore();
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("reports rate-limit errors without reset metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-report-rate-limit-"));
    const { workspace, commandPath, restore } = await setupExecuteEnv(root);
    await writeFailingClaudeCommand(commandPath, {
      resultEvent: {
        type: "result",
        subtype: "error",
        session_id: "claude-session-1",
        is_error: true,
        result: "Overloaded",
        errors: [{ type: "overloaded_error", message: "Overloaded" }],
      },
    });

    const logs: string[] = [];
    const onLog = async (stream: string, chunk: string) => {
      logs.push(chunk);
    };

    try {
      await execute({
        runId: "run-claude-report-no-reset",
        agent: { id: "agent-1", companyId: "co-1", name: "Test", adapterType: "claude_local", adapterConfig: {} },
        runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
        config: {
          command: commandPath,
          cwd: workspace,
          promptTemplate: "Do work.",
        },
        context: {},
        authToken: "tok",
        onLog,
      });

      const allLogs = logs.join("");
      expect(allLogs).toContain("[paperclip] Detected transient upstream error (e.g. rate limit).");
    } finally {
      restore();
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
