import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { testEnvironment as testOpenCodeEnvironment } from "@paperclipai/adapter-opencode-local/server";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import { buildWrappedOllamaConfig, resolveOllamaBaseUrl, resolveOllamaModelName } from "./config.js";
import { discoverOllamaModels } from "./models.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = parseObject(ctx.config);
  const requestedModel = asString(config.model, "").trim();
  const checks: AdapterEnvironmentCheck[] = [];

  let discoveredModels: string[] = [];
  try {
    discoveredModels = (await discoverOllamaModels({
      baseUrl: resolveOllamaBaseUrl(config),
    })).map((entry) => entry.id);
    checks.push({
      code: "ollama_models_discovered",
      level: "info",
      message: `Discovered ${discoveredModels.length} model(s) from local Ollama.`,
    });
  } catch (err) {
    checks.push({
      code: "ollama_models_unreachable",
      level: "error",
      message: err instanceof Error ? err.message : "Ollama model discovery failed.",
      detail: resolveOllamaBaseUrl(config),
      hint: "Start Ollama and confirm the local server is reachable before testing this adapter.",
    });
  }

  if (requestedModel) {
    const resolvedModel = resolveOllamaModelName(requestedModel);
    if (discoveredModels.length > 0 && !discoveredModels.includes(resolvedModel)) {
      checks.push({
        code: "ollama_model_missing",
        level: "error",
        message: `Configured Ollama model is not installed: ${resolvedModel}`,
        hint: `Run \`ollama pull ${resolvedModel}\` before assigning this adapter.`,
      });
    }
  }

  const wrappedConfig = buildWrappedOllamaConfig(config, discoveredModels);
  const openCodeResult = await testOpenCodeEnvironment({
    ...ctx,
    adapterType: "ollama_local",
    config: wrappedConfig,
  });

  const mergedChecks = [...checks, ...openCodeResult.checks];
  return {
    adapterType: "ollama_local",
    status: summarizeStatus(mergedChecks),
    checks: mergedChecks,
    testedAt: new Date().toISOString(),
  };
}
