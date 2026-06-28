import type { AdapterModel } from "@paperclipai/adapter-utils";
import { resolveOllamaTagsUrl } from "./config.js";

const CACHE_TTL_MS = 30_000;

type CachedModels = {
  expiresAt: number;
  tagsUrl: string;
  models: AdapterModel[];
};

let cached: CachedModels | null = null;

function normalizeModelNames(payload: unknown): AdapterModel[] {
  const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const models = Array.isArray(record.models) ? record.models : [];
  const names = new Set<string>();
  for (const entry of models) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const name = (entry as Record<string, unknown>).name;
    if (typeof name !== "string" || !name.trim()) continue;
    names.add(name.trim());
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }))
    .map((name) => ({ id: name, label: name }));
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status} for ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverOllamaModels(input: {
  baseUrl?: string;
  timeoutMs?: number;
} = {}): Promise<AdapterModel[]> {
  const tagsUrl = resolveOllamaTagsUrl({ baseUrl: input.baseUrl });
  const now = Date.now();
  if (cached && cached.tagsUrl === tagsUrl && cached.expiresAt > now) {
    return cached.models;
  }
  const models = normalizeModelNames(await fetchJson(tagsUrl, input.timeoutMs ?? 10_000));
  cached = {
    tagsUrl,
    expiresAt: now + CACHE_TTL_MS,
    models,
  };
  return models;
}

export async function listOllamaModels(): Promise<AdapterModel[]> {
  try {
    return await discoverOllamaModels();
  } catch {
    return [];
  }
}

export async function refreshOllamaModels(): Promise<AdapterModel[]> {
  cached = null;
  return listOllamaModels();
}
