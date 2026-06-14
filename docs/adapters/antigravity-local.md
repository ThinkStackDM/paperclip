---
title: Antigravity Local
summary: Google Antigravity agy CLI local adapter setup and configuration
---

The `antigravity_local` adapter runs Google's Antigravity `agy` CLI locally. It uses print mode for unattended Paperclip heartbeats and can resume a saved Antigravity conversation with `--conversation`.

## Prerequisites

- Antigravity CLI installed (`agy` command available)
- Local `agy` login completed on the machine that runs Paperclip
- No Google API key is required by this adapter

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | Yes | Working directory for the agent process (absolute path; created automatically if missing when permissions allow) |
| `promptTemplate` | string | No | Prompt used for all runs |
| `instructionsFilePath` | string | No | Markdown instructions file staged into the workspace as `AGENTS.md` when possible |
| `command` | string | No | CLI command to run. Defaults to `agy`. |
| `printTimeout` | string | No | `agy --print-timeout` value. Defaults to `5m0s`. |
| `autoApprove` | boolean | No | Passes `--dangerously-skip-permissions` for unattended operation. Defaults to `true`. |
| `sandbox` | boolean | No | Passes `--sandbox`. Defaults to `false`. |
| `extraDirs` | string[] | No | Extra workspace directories passed as repeated `--add-dir` flags |
| `extraArgs` | string[] | No | Additional CLI arguments |
| `env` | object | No | Environment variables (supports secret refs) |
| `timeoutSec` | number | No | Process timeout (0 = no timeout) |
| `graceSec` | number | No | Grace period before force-kill |

## Authentication

Authentication is handled by the local Antigravity CLI. Run the normal `agy` login/setup flow on the Paperclip host before assigning this adapter. Do not configure a Google API key for this adapter unless another local tool in the same environment needs it.

## Session Persistence

The adapter persists Antigravity conversation IDs when the CLI output exposes one. On the next wake, it resumes a saved conversation with:

```sh
agy --print --prompt "<prompt>" --conversation <sessionId>
```

Session resume is cwd-aware: if the saved session belongs to a different working directory, the adapter starts a fresh conversation instead. If resume fails with an unknown conversation/session error, the adapter retries once without `--conversation`.

## Environment Test

Use the "Test Environment" button in the UI to validate the adapter config. It checks:

- `agy` is installed and accessible
- Working directory is absolute and available
- `agy --help` exposes print and conversation flags
