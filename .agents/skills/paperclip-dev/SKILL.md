---
name: paperclip-dev
required: false
description: >
  Develop and operate a local Paperclip instance — start and stop servers,
  pull updates from master, run builds and tests, manage worktrees, back up
  databases, and diagnose problems. Use whenever you need to work on the
  Paperclip codebase itself or keep a running instance healthy.
---

# Paperclip Dev

This skill covers the day-to-day workflows for developing and operating a local Paperclip instance. It assumes you are working inside the Paperclip repo checkout with `origin` pointing to `git@github.com:paperclipai/paperclip.git`.

> **OPEN SOURCE HYGIENE:** This repository is public-facing. Treat anything you push to `origin` as publishable. Never commit or push secrets, API keys, tokens, private logs, PII, customer data, or machine-local configuration that should stay private. Keep git history tidy as well: avoid pushing throwaway branches, noisy checkpoint commits, or speculative work that does not need to be shared upstream.

> **MANDATORY:** Before running any CLI command, building, testing, or managing worktrees, you MUST read `doc/DEVELOPING.md` in the Paperclip repo. It is the canonical reference for all `paperclipai` CLI commands, their options, build/test workflows, database operations, worktree management, and diagnostics. Do NOT guess at flags or options — read the doc first.

## Quick Command Reference

These are the most common commands. For full option tables and details, see `doc/DEVELOPING.md`.

| Task | Command |
|------|---------|
| Start server (first time or normal) | `npx paperclipai run` |
| Dev mode with hot reload | `pnpm dev` |
| Stop dev server | `pnpm dev:stop` |
| Build | `pnpm build` |
| Type-check | `pnpm typecheck` |
| Run tests | `pnpm test` |
| Run migrations | `pnpm db:migrate` |
| Regenerate Drizzle client | `pnpm db:generate` |
| Back up database | `npx paperclipai db:backup` |
| Health check | `npx paperclipai doctor --repair` |
| Print env vars | `npx paperclipai env` |
| Trigger agent heartbeat | `npx paperclipai heartbeat run --agent-id <id>` |
| Install agent skills locally | `npx paperclipai agent local-cli <agent> --company-id <id>` |

## Pulling from Master

```bash
git fetch origin && git pull origin master
pnpm install && pnpm build
```

If schema changes landed, also run `pnpm db:generate && pnpm db:migrate`.

## Worktrees

Paperclip worktrees combine git worktrees with isolated Paperclip instances — each gets its own database, server port, and environment seeded from the primary instance.

> **MANDATORY:** Before creating or managing worktrees, you MUST read the "Worktree-local Instances" and "Worktree CLI Reference" sections in `doc/DEVELOPING.md`. That is the canonical reference for all worktree commands, their options, seed modes, and environment variables.

> ⚠️ **Symlink hazard — do NOT run `pnpm install` from inside a `paperclip-wt-*` worktree.** It can repoint the shared `@paperclipai/*` workspace symlinks at the worktree's `node_modules`, which clobbers the **main** server's links → `ERR_MODULE_NOT_FOUND` crash-loop (this caused a real ~1h fleet outage). Build inside a worktree with `pnpm build` only; if you must install deps, do it in an isolated worktree `node_modules` and verify the main instance's `@paperclipai` symlinks still point at the main tree afterward (repoint them back if not).

### When to Use Worktrees

- Starting a feature branch that needs its own Paperclip environment
- Running parallel agent work without cross-contaminating the primary instance
- Testing Paperclip changes in isolation before merging

### Command Overview

The CLI has two tiers (see `doc/DEVELOPING.md` for full option tables):

| Command | Purpose |
|---------|---------|
| `worktree:make <name>` | Create worktree + isolated instance in one step |
| `worktree:list` | List worktrees and their Paperclip status |
| `worktree:merge-history` | Preview/import issue history between worktrees |
| `worktree:cleanup <name>` | Remove worktree, branch, and instance data |
| `worktree init` | Bootstrap instance inside existing worktree |
| `worktree env` | Print shell exports for worktree instance |
| `worktree reseed` | Refresh worktree DB from another instance |
| `worktree repair` | Fix broken/missing worktree instance metadata |

### Typical Workflow

```bash
# 1. Create a worktree for a feature
npx paperclipai worktree:make my-feature --start-point origin/main

# 2. Enter it and print its env
cd ../paperclip-wt-my-feature
npx paperclipai worktree env

# 3. Start the isolated server
npx paperclipai run

# 4. Build / test your changes
pnpm build
pnpm test
```

## Diagnostics

### Server will not boot

1. Read `doc/DEVELOPING.md` first for the canonical run/build/db commands.
2. Run `npx paperclipai doctor --repair`.
3. Confirm `.env` / exported vars match the instance you expect (`npx paperclipai env`).
4. Rebuild and re-run migrations if the schema or generated client drifted:

```bash
pnpm build
pnpm db:generate
pnpm db:migrate
```

### Worktree is broken or missing metadata

```bash
npx paperclipai worktree:list
npx paperclipai worktree repair <name>
```

If the worktree DB is stale, reseed it from the primary instance per the documented workflow in `doc/DEVELOPING.md`.

### Need a safe backup before risky work

```bash
npx paperclipai db:backup
```

## Guardrails

- Read `doc/DEVELOPING.md` before using any CLI documented here.
- Prefer the smallest build/test command that proves the change.
- Do not guess at worktree or database flags; the doc is canonical.
- Treat any command that touches shared symlinks or worktree state as high risk and verify the primary instance still works afterward.
