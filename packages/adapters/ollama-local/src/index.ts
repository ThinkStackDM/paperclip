export const type = "ollama_local";
export const label = "Ollama (local)";

export const DEFAULT_OLLAMA_PROVIDER = "ollama";
export const DEFAULT_OLLAMA_LOCAL_MODEL = "qwen3:8b";
export const DEFAULT_OLLAMA_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";

export function normalizeOllamaModelName(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) return trimmed;
  return trimmed.slice(slashIndex + 1).trim();
}

export function buildOllamaOpenCodeModelId(value: unknown): string {
  const modelName = normalizeOllamaModelName(value);
  if (!modelName) return "";
  return `${DEFAULT_OLLAMA_PROVIDER}/${modelName}`;
}

export const models = [
  { id: DEFAULT_OLLAMA_LOCAL_MODEL, label: DEFAULT_OLLAMA_LOCAL_MODEL },
];

export const agentConfigurationDoc = `# ollama_local agent configuration

Adapter: ollama_local

Use when:
- You want Paperclip to run local Ollama models as agentic lanes through the OpenCode runtime
- The host machine already has Ollama running and serving models on localhost
- You want Paperclip session resume, skills, and issue-workflow behavior against local models

Don't use when:
- Ollama is not running or the target model is not pulled on the machine that runs Paperclip
- You need a webhook-style external invocation (use http or openclaw_gateway)
- You only need one-shot direct local-model calls without the Paperclip agent loop (use the benchmark's direct ollama adapter)

Core fields:
- model (string, required): Ollama model tag such as qwen3:8b or gemma3:12b
- baseUrl (string, optional): Ollama OpenAI-compatible base URL. Defaults to http://127.0.0.1:11434/v1
- cwd (string, optional): default absolute working directory fallback for the agent process
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- dangerouslySkipPermissions (boolean, optional): pass through to the underlying OpenCode runtime
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional OpenCode CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Paperclip discovers installed models from Ollama's native /api/tags endpoint.
- At runtime this adapter injects an OpenCode provider config that points at the local Ollama OpenAI-compatible endpoint.
- Agent model ids stay in plain Ollama form (for example qwen3:8b); Paperclip maps them to the underlying ollama/<model> OpenCode form automatically.
- If OpenCode is missing, the underlying runtime can be installed separately before the first run.
`;
