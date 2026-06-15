import { execFileSync } from "node:child_process";

export type InstanceIdentity = {
  sourceDir: string;
  commit: string | null;
  pid: number;
  startedAt: string;
};

function resolveCommit(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

let cached: InstanceIdentity | null = null;

export function getInstanceIdentity(): InstanceIdentity {
  if (cached) return cached;
  const sourceDir = process.cwd();
  cached = {
    sourceDir,
    commit: resolveCommit(sourceDir),
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  return cached;
}

export function __resetInstanceIdentityForTests(): void {
  cached = null;
}
