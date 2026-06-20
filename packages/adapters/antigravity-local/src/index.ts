export const type = "antigravity_local";
export const label = "Antigravity (local)";

export const DEFAULT_ANTIGRAVITY_LOCAL_MODEL = "antigravity";

export const models = [
  { id: DEFAULT_ANTIGRAVITY_LOCAL_MODEL, label: "Antigravity" },
];

export const agentConfigurationDoc = `# antigravity_local agent configuration

Adapter: antigravity_local

Use when:
- You want Paperclip to run Google's Antigravity \`agy\` CLI locally on the host machine
- The host has already completed local \`agy\` login
- You want Paperclip to resume saved Antigravity conversations with \`--conversation <id>\`

Don't use when:
- You need API-key based authentication. This adapter uses local \`agy\` login and does not require or read a Google API key.
- Antigravity is not installed or authenticated on the machine that runs Paperclip
- You need a webhook-style external invocation (use http or openclaw_gateway)
- You only need a one-shot script without an AI coding agent loop (use process)

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file. Paperclip stages it into the execution workspace as \`AGENTS.md\` when possible.
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "agy"
- printTimeout (string, optional): \`agy --print-timeout\` value. Defaults to \`5m0s\`.
- autoApprove (boolean, optional): pass \`--dangerously-skip-permissions\` for unattended execution. Defaults to true.
- sandbox (boolean, optional): pass \`--sandbox\`. Defaults to false.
- extraDirs (string[], optional): additional workspace directories passed as repeated \`--add-dir\`.
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Runs use \`agy --print --prompt <prompt>\` for non-interactive execution.
- Sessions resume with \`--conversation <sessionId>\` when the saved session cwd matches the current cwd.
- Authentication is managed by the local Antigravity CLI. Run \`agy\` login/setup on the host before assigning this adapter.
`;
