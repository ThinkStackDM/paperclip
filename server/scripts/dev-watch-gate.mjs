#!/usr/bin/env node
// Pre-reload compile gate for the dev watcher.
//
// The live Paperclip server runs `tsx watch src/index.ts`. On every save tsx
// tears down the running server and re-imports the entry; if the new code does
// not load (a half-saved file with a syntax error, or a transiently-missing
// import like `./run-gate.ts`) the restart crashes and NOTHING is left
// listening on :3100 — taking the whole fleet down until the file is valid
// again. This happened twice over the weekend.
//
// This gate is the cheap, side-effect-free check the supervisor runs BEFORE it
// swaps the running server: bundle the entry's source graph with esbuild. It
// then run a focused issue-create route smoke. The compile step does not
// execute app code (no port binding, no DB, no embedded Postgres), so it is
// safe to run against the live instance. It follows relative imports AND
// `@paperclipai/*` workspace packages (the source tsx will actually load),
// while treating real `node_modules` dependencies as external so the check
// stays fast (~0.2s) and only fails on OUR broken source. The route smoke is a
// targeted Vitest file that proves `POST /api/companies/:companyId/issues`
// still works before the watcher reports healthy.
//
// Exit 0  -> the candidate compiles and the issue-create route smoke passes;
//            the supervisor may reload.
// Exit !0 -> syntax error / unresolved import / route smoke failure; errors
//            printed to stderr and the supervisor KEEPS the currently-running
//            server. Fail safe: a bad edit can never take the server down, only
//            delay the next reload.
//
// Usage: node dev-watch-gate.mjs [entry] [--cwd <dir>]
//   entry defaults to "src/index.ts"; cwd defaults to the server package root.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeSmokeTestPath = "src/__tests__/issue-workspace-command-authz.test.ts";
const routeSmokeEnabled = process.env.PAPERCLIP_DEV_WATCH_ROUTE_SMOKE !== "0";

const args = process.argv.slice(2);
let entry = "src/index.ts";
let cwd = serverRoot;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--cwd") {
    cwd = path.resolve(args[i + 1] ?? cwd);
    i += 1;
  } else if (!args[i].startsWith("--")) {
    entry = args[i];
  }
}

let esbuild;
let vitestCliPath;
try {
  esbuild = require("esbuild");
} catch {
  // esbuild lives in the repo root node_modules, not the server package's.
  esbuild = require(path.resolve(serverRoot, "..", "node_modules", "esbuild"));
}

try {
  vitestCliPath = require.resolve("vitest/vitest.mjs");
} catch {
  vitestCliPath = require.resolve(path.resolve(serverRoot, "..", "node_modules", "vitest", "vitest.mjs"));
}

// Externalize everything that resolves into a real `node_modules` (third-party
// deps), but FOLLOW our own `@paperclipai/*` workspace packages so a broken edit
// inside a shared package is caught too. pnpm symlinks workspace packages under
// node_modules, so we key off the package-name prefix rather than the path.
const externalizeThirdParty = {
  name: "externalize-third-party",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (resolveArgs) => {
      if (resolveArgs.kind === "entry-point") return undefined;
      const id = resolveArgs.path;
      const isRelative = id.startsWith(".") || path.isAbsolute(id);
      if (isRelative) return undefined; // follow our own source
      if (id.startsWith("@paperclipai/")) return undefined; // follow workspace source
      return { path: id, external: true }; // real dependency: don't follow
    });
  },
};

function runIssueCreateRouteSmoke() {
  if (!routeSmokeEnabled) return Promise.resolve(true);
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [vitestCliPath, "run", "--reporter=dot", routeSmokeTestPath],
      {
        cwd,
        env: {
          ...process.env,
          CI: process.env.CI ?? "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      process.stderr.write(`[dev-watch-gate] route smoke failed to run: ${error.message}\n`);
      resolve(false);
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }
      if (stdout.trim().length > 0) process.stderr.write(stdout);
      if (stderr.trim().length > 0) process.stderr.write(stderr);
      process.stderr.write(
        `[dev-watch-gate] issue-create route smoke failed (${routeSmokeTestPath}, exit ${code ?? "null"})\n`,
      );
      resolve(false);
    });
  });
}

try {
  const result = await esbuild.build({
    entryPoints: [path.resolve(cwd, entry)],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    logLevel: "silent",
    absWorkingDir: cwd,
    plugins: [externalizeThirdParty],
  });
  if (result.errors.length > 0) {
    const formatted = await esbuild.formatMessages(result.errors, { kind: "error", color: true });
    process.stderr.write(formatted.join(""));
    process.exit(1);
  }
  if (!await runIssueCreateRouteSmoke()) {
    process.exit(1);
  }
  process.exit(0);
} catch (error) {
  // esbuild throws on compile failure; its `.errors` carry the resolve/parse
  // diagnostics. Anything else (esbuild missing, OOM) also fails the gate —
  // the supervisor treats a non-zero exit as "keep the running server".
  const errors = error?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const formatted = await esbuild.formatMessages(errors, { kind: "error", color: true });
    process.stderr.write(formatted.join(""));
  } else {
    process.stderr.write(`[dev-watch-gate] gate failed to run: ${error?.message ?? error}\n`);
  }
  process.exit(1);
}
