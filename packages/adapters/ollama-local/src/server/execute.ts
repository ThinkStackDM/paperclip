import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { execute as executeOpenCode } from "@paperclipai/adapter-opencode-local/server";
import { buildWrappedOllamaConfig, resolveOllamaBaseUrl } from "./config.js";
import { discoverOllamaModels } from "./models.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const discoveredModels = await discoverOllamaModels({
    baseUrl: resolveOllamaBaseUrl(ctx.config),
  }).catch(() => []);
  const wrappedConfig = buildWrappedOllamaConfig(
    ctx.config,
    discoveredModels.map((entry) => entry.id),
  );
  return executeOpenCode({
    ...ctx,
    config: wrappedConfig,
  });
}
