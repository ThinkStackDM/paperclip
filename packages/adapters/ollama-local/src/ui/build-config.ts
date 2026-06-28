import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { buildOpenCodeLocalConfig } from "@paperclipai/adapter-opencode-local/ui";
import { DEFAULT_OLLAMA_LOCAL_MODEL, buildOllamaOpenCodeModelId, normalizeOllamaModelName } from "../index.js";

export function buildOllamaLocalConfig(values: CreateConfigValues): Record<string, unknown> {
  const normalizedModel = normalizeOllamaModelName(values.model) || DEFAULT_OLLAMA_LOCAL_MODEL;
  return buildOpenCodeLocalConfig({
    ...values,
    model: buildOllamaOpenCodeModelId(normalizedModel),
  });
}
