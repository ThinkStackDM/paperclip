import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import {
  DEFAULT_OLLAMA_LOCAL_BASE_URL,
  DEFAULT_OLLAMA_LOCAL_MODEL,
  DEFAULT_OLLAMA_PROVIDER,
  buildOllamaOpenCodeModelId,
  normalizeOllamaModelName,
} from "../index.js";

function normalizeBasePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") return "/v1";
  if (trimmed === "/api" || trimmed === "/api/chat" || trimmed === "/api/generate") return "/v1";
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export function resolveOllamaBaseUrl(input: unknown): string {
  const record = parseObject(input);
  const fromConfig = asString(record.baseUrl, "").trim();
  const fromEnv = typeof process.env.PAPERCLIP_OLLAMA_BASE_URL === "string"
    ? process.env.PAPERCLIP_OLLAMA_BASE_URL.trim()
    : "";
  const candidate = fromConfig || fromEnv || DEFAULT_OLLAMA_LOCAL_BASE_URL;
  try {
    const url = new URL(candidate);
    url.pathname = normalizeBasePath(url.pathname);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_OLLAMA_LOCAL_BASE_URL;
  }
}

export function resolveOllamaTagsUrl(input: unknown): string {
  const url = new URL(resolveOllamaBaseUrl(input));
  const prefix = url.pathname.replace(/\/+$/, "").replace(/\/v1$/, "");
  url.pathname = `${prefix || ""}/api/tags`.replace(/\/{2,}/g, "/");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function resolveOllamaModelName(input: unknown): string {
  return normalizeOllamaModelName(input) || DEFAULT_OLLAMA_LOCAL_MODEL;
}

export function buildOllamaProviderDeclaration(models: readonly string[], baseUrl: string): Record<string, unknown> {
  const modelEntries = Object.fromEntries(
    [...new Set(models.map((value) => normalizeOllamaModelName(value)).filter(Boolean).sort())]
      .map((model) => [model, { name: model }]),
  );
  return {
    [DEFAULT_OLLAMA_PROVIDER]: {
      npm: "@ai-sdk/openai-compatible",
      name: "Local Ollama",
      options: {
        baseURL: baseUrl,
      },
      models: modelEntries,
    },
  };
}

export function buildWrappedOllamaConfig(
  config: Record<string, unknown>,
  discoveredModels: readonly string[] = [],
): Record<string, unknown> {
  const modelName = resolveOllamaModelName(config.model);
  const openCodeModelId = buildOllamaOpenCodeModelId(modelName);
  const providerDeclaration = buildOllamaProviderDeclaration(
    [...discoveredModels, modelName],
    resolveOllamaBaseUrl(config),
  );
  const env = {
    ...parseObject(config.env),
    PAPERCLIP_OPENCODE_PROVIDERS: JSON.stringify(providerDeclaration),
    PAPERCLIP_OPENCODE_SMALL_MODEL: openCodeModelId,
  };

  return {
    ...config,
    model: openCodeModelId,
    env,
  };
}
