import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  ensurePathInEnv,
  parseObject,
} from "@paperclipai/adapter-utils/server-utils";
import {
  describeAdapterExecutionTarget,
  ensureAdapterExecutionTargetCommandResolvable,
  ensureAdapterExecutionTargetDirectory,
  resolveAdapterExecutionTargetCwd,
  runAdapterExecutionTargetProcess,
} from "@paperclipai/adapter-utils/execution-target";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function normalizeEnv(input: unknown): Record<string, string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "agy");
  const target = ctx.executionTarget ?? null;
  const targetIsRemote = target?.kind === "remote";
  const cwd = resolveAdapterExecutionTargetCwd(target, asString(config.cwd, ""), process.cwd());
  const targetLabel = targetIsRemote
    ? ctx.environmentName ?? describeAdapterExecutionTarget(target)
    : null;
  const runId = `antigravity-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (targetLabel) {
    checks.push({
      code: "antigravity_environment_target",
      level: "info",
      message: `Probing inside environment: ${targetLabel}`,
    });
  }

  try {
    await ensureAdapterExecutionTargetDirectory(runId, target, cwd, {
      cwd,
      env: {},
      createIfMissing: true,
    });
    checks.push({
      code: "antigravity_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "antigravity_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const env = normalizeEnv(config.env);
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });

  try {
    await ensureAdapterExecutionTargetCommandResolvable(command, target, cwd, runtimeEnv);
    checks.push({
      code: "antigravity_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "antigravity_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const canRunHelp =
    checks.every((check) => check.code !== "antigravity_cwd_invalid" && check.code !== "antigravity_command_unresolvable");

  if (canRunHelp) {
    const helpProbe = await runAdapterExecutionTargetProcess(
      runId,
      target,
      command,
      ["--help"],
      {
        cwd,
        env,
        timeoutSec: Math.max(1, asNumber(config.helloProbeTimeoutSec, 20)),
        graceSec: 5,
        onLog: async () => {},
      },
    );

    const output = `${helpProbe.stdout}\n${helpProbe.stderr}`;
    if (helpProbe.timedOut) {
      checks.push({
        code: "antigravity_help_probe_timed_out",
        level: "warn",
        message: "`agy --help` timed out.",
      });
    } else if ((helpProbe.exitCode ?? 1) !== 0) {
      checks.push({
        code: "antigravity_help_probe_failed",
        level: "error",
        message: "`agy --help` failed.",
        detail: output.trim(),
      });
    } else if (!/--print/.test(output) || !/--conversation/.test(output)) {
      checks.push({
        code: "antigravity_help_probe_incomplete",
        level: "warn",
        message: "`agy --help` did not list the expected print/conversation flags.",
        detail: output.trim(),
      });
    } else {
      checks.push({
        code: "antigravity_help_probe_ok",
        level: "info",
        message: "`agy --help` exposes print and conversation flags.",
      });
    }
  }

  return {
    adapterType: "antigravity_local",
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
