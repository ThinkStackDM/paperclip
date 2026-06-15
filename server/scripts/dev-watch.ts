// Gated dev watcher for the live Paperclip server.
//
// PREVIOUS behaviour: this script spawned `tsx watch src/index.ts`. tsx watch
// reloads on EVERY save by tearing the server down and re-importing the entry.
// If a fleet engineer's half-saved edit did not load (a syntax error, or a
// transiently-missing import like `./run-gate.ts`), the restart crashed and
// nothing was left listening on :3100 — taking all 7 companies down until the
// file became valid again. This was the platform's single point of failure and
// it fired twice over the weekend.
//
// NEW behaviour: we own the watch/restart loop and run a compile gate
// (scripts/dev-watch-gate.mjs, an esbuild bundle that executes no code) BEFORE
// swapping the running server. The currently-running server keeps serving the
// fleet the entire time the candidate is broken; a save only triggers a reload
// once it compiles cleanly. The guarantee is one-directional and fail-safe: a
// bad edit can NEVER take the server down — at worst it delays the next reload.
//
// Scope: the watcher reacts to edits under server/src (the documented SPOF
// surface). The gate itself follows the full source graph — server/src AND
// `@paperclipai/*` workspace packages — so a broken shared-package edit also
// blocks the reload rather than crashing the server. Workspace-package edits do
// not, on their own, trigger a reload in this version (a follow-up could widen
// the watch set); they are picked up on the next server/src save.
//
// Overridable via env for isolated testing (defaults target the live server):
//   PAPERCLIP_DEV_WATCH_ENTRY  entry file, relative to cwd   (default src/index.ts)
//   PAPERCLIP_DEV_WATCH_CWD    working dir for server + gate  (default server root)
//   PAPERCLIP_DEV_WATCH_DIR    directory to watch recursively (default <cwd>/src)
//   PAPERCLIP_DEV_WATCH_GATE   gate script path               (default scripts/dev-watch-gate.mjs)
import { spawn, type ChildProcess } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tsxCliPath = require.resolve("tsx/cli");
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cwd = path.resolve(process.env.PAPERCLIP_DEV_WATCH_CWD || serverRoot);
const entry = process.env.PAPERCLIP_DEV_WATCH_ENTRY || "src/index.ts";
const watchDir = path.resolve(process.env.PAPERCLIP_DEV_WATCH_DIR || path.join(cwd, "src"));
const gateScript = path.resolve(process.env.PAPERCLIP_DEV_WATCH_GATE || path.join(serverRoot, "scripts", "dev-watch-gate.mjs"));

const DEBOUNCE_MS = 250;
const SHUTDOWN_GRACE_MS = 10_000;
const RELOAD_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]);

let child: ChildProcess | null = null;
let childExited: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | null = null;
let restarting = false;
let pendingReload = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;

function log(message: string): void {
  process.stderr.write(`[dev-watch ${new Date().toISOString().slice(11, 19)}] ${message}\n`);
}

function startChild(): void {
  const spawned = spawn(process.execPath, [tsxCliPath, entry], { cwd, env: process.env, stdio: "inherit" });
  child = spawned;
  childExited = new Promise((resolve) => {
    spawned.on("exit", (code, signal) => {
      if (child === spawned) child = null;
      resolve({ code, signal });
      if (shuttingDown || restarting) return;
      // Unexpected exit while not reloading: the running code crashed at runtime
      // (not a gated reload). Match the previous tsx-watch wrapper — propagate so
      // the dev-runner / launchd KeepAlive can restart the whole stack.
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      log(`server exited unexpectedly (code ${code}); exiting for supervisor restart`);
      process.exit(code ?? 0);
    });
  });
  spawned.on("error", (error) => {
    log(`failed to spawn server: ${error.message}`);
    process.exit(1);
  });
}

async function stopChild(): Promise<void> {
  const current = child;
  if (!current || !childExited) return;
  current.kill("SIGTERM");
  const killTimer = setTimeout(() => {
    try {
      current.kill("SIGKILL");
    } catch {
      // already gone
    }
  }, SHUTDOWN_GRACE_MS);
  try {
    await childExited;
  } finally {
    clearTimeout(killTimer);
  }
}

function runGate(): Promise<boolean> {
  return new Promise((resolve) => {
    const gate = spawn(process.execPath, [gateScript, entry, "--cwd", cwd], {
      cwd,
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
    });
    gate.on("exit", (code) => resolve(code === 0));
    gate.on("error", (error) => {
      // Fail safe: if we cannot even run the gate, do NOT reload — keep the
      // currently-running server serving the fleet.
      log(`gate failed to run (${error.message}); keeping current server`);
      resolve(false);
    });
  });
}

async function reload(reason: string): Promise<void> {
  if (restarting) return; // a reload is in flight; pendingReload will re-trigger
  if (!pendingReload) return;
  pendingReload = false;
  restarting = true;
  try {
    log(`change detected (${reason}); checking compile before reload…`);
    const ok = await runGate();
    if (!ok) {
      log("⚠ reload BLOCKED — candidate did not compile; keeping the running server up. Fix the error above.");
      return;
    }
    log("✓ compile clean — reloading server");
    await stopChild();
    startChild();
  } finally {
    restarting = false;
    if (pendingReload) scheduleReload("coalesced changes");
  }
}

function scheduleReload(reason: string): void {
  pendingReload = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void reload(reason);
  }, DEBOUNCE_MS);
}

function shouldReact(filename: string | null): boolean {
  if (!filename) return true; // unknown change — react to be safe
  const normalized = filename.split(path.sep).join("/");
  if (
    normalized.includes("node_modules/") ||
    normalized.includes("/dist/") ||
    normalized.startsWith("dist/") ||
    normalized.includes("/.git/") ||
    normalized.includes("__tests__/") ||
    normalized.endsWith(".test.ts") ||
    normalized.endsWith(".test.tsx")
  ) {
    return false;
  }
  const ext = path.extname(normalized);
  if (ext && !RELOAD_EXTENSIONS.has(ext)) return false; // ignore editor temp/.swp files
  return true;
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    watcher.close();
  } catch {
    // ignore
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  const current = child;
  if (!current) {
    process.exit(0);
    return;
  }
  current.on("exit", (code) => process.exit(code ?? 0));
  current.kill(signal);
  setTimeout(() => {
    try {
      current.kill("SIGKILL");
    } catch {
      // already gone
    }
  }, SHUTDOWN_GRACE_MS).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const watcher = watch(watchDir, { recursive: true }, (_event, filename) => {
  const name = typeof filename === "string" ? filename : filename ? filename.toString() : null;
  if (!shouldReact(name)) return;
  scheduleReload(name ?? "src");
});

log(`gated watcher active — edits under ${path.relative(cwd, watchDir) || watchDir} reload only after a clean compile`);
log(`gate: ${path.relative(serverRoot, gateScript)} · a broken edit keeps the running server up instead of crashing it`);
startChild();
