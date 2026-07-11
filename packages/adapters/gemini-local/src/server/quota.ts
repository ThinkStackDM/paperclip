import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderQuotaResult, QuotaWindow } from "@paperclipai/adapter-utils";
import { detectGeminiQuotaExhausted } from "./parse.js";

// Source labels surfaced on ProviderQuotaResult.source so the UI/Controller can
// tell a live provider reading apart from a locally-derived estimate.
export const GEMINI_QUOTA_SOURCE_CODE_ASSIST = "gemini-code-assist";
export const GEMINI_QUOTA_SOURCE_HEARTBEAT_ESTIMATE = "gemini-heartbeat-estimate";

// Code Assist (the API the gemini CLI talks to for OAuth/"Login with Google"
// users, i.e. Google AI Pro/Free tiers) endpoint + version. Mirrors the values
// hard-coded in @google/gemini-cli's packages/core/src/code_assist/server.ts.
const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com";
const CODE_ASSIST_API_VERSION = "v1internal";

const GEMINI_DIR = ".gemini";
const OAUTH_CREDS_FILENAME = "oauth_creds.json";

/** Resolve the gemini CLI config dir, honoring the same overrides the CLI uses. */
export function geminiConfigDir(): string {
  const home = process.env.GEMINI_CLI_HOME?.trim() || os.homedir();
  return path.join(home, GEMINI_DIR);
}

interface GeminiOAuthCreds {
  accessToken: string;
  /** ms-epoch expiry, when present in oauth_creds.json */
  expiryDate: number | null;
}

interface GeminiOAuthCredsFile {
  access_token?: unknown;
  expiry_date?: unknown;
}

/**
 * Read the OAuth access token the gemini CLI persists under ~/.gemini/oauth_creds.json.
 * The CLI refreshes this file on every run, so an active deployment keeps it fresh;
 * we use the stored token directly (the same approach claude-local/codex-local take)
 * rather than performing our own refresh.
 */
export async function readGeminiOAuthCreds(configDir = geminiConfigDir()): Promise<GeminiOAuthCreds | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(configDir, OAUTH_CREDS_FILENAME), "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const file = parsed as GeminiOAuthCredsFile;
  const accessToken = typeof file.access_token === "string" ? file.access_token.trim() : "";
  if (!accessToken) return null;
  const expiryDate =
    typeof file.expiry_date === "number" && Number.isFinite(file.expiry_date) ? file.expiry_date : null;
  return { accessToken, expiryDate };
}

/** Project id used to scope Code Assist quota lookups, when set in the environment. */
function geminiProjectIdFromEnv(): string | null {
  for (const key of ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT_ID"]) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** fetch with an abort-based timeout so a hanging provider api doesn't block the response indefinitely */
export async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function codeAssistPost(method: string, token: string, body: unknown): Promise<unknown> {
  const resp = await fetchWithTimeout(
    `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`Code Assist ${method} returned ${resp.status} — gemini OAuth token expired or lacks access`);
  }
  if (!resp.ok) {
    throw new Error(`Code Assist ${method} returned ${resp.status}`);
  }
  return resp.json();
}

interface CodeAssistTier {
  id?: string | null;
  name?: string | null;
}

interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | null;
  currentTier?: CodeAssistTier | null;
  paidTier?: CodeAssistTier | null;
}

const CLIENT_METADATA = {
  ideType: "IDE_UNSPECIFIED",
  platform: "PLATFORM_UNSPECIFIED",
  pluginType: "GEMINI",
};

export async function loadCodeAssist(token: string, projectId: string | null): Promise<LoadCodeAssistResponse> {
  const body: Record<string, unknown> = {
    metadata: { ...CLIENT_METADATA, ...(projectId ? { duetProject: projectId } : {}) },
  };
  if (projectId) body.cloudaicompanionProject = projectId;
  const result = await codeAssistPost("loadCodeAssist", token, body);
  return (typeof result === "object" && result !== null ? result : {}) as LoadCodeAssistResponse;
}

interface QuotaBucket {
  modelId?: string | null;
  remainingFraction?: number | null;
  remainingAmount?: string | number | null;
  resetTime?: string | number | null;
}

interface RetrieveUserQuotaResponse {
  buckets?: QuotaBucket[] | null;
}

export async function retrieveUserQuota(token: string, projectId: string): Promise<RetrieveUserQuotaResponse> {
  const result = await codeAssistPost("retrieveUserQuota", token, { project: projectId });
  return (typeof result === "object" && result !== null ? result : {}) as RetrieveUserQuotaResponse;
}

function normalizeResetTime(resetTime: string | number | null | undefined): string | null {
  if (resetTime == null) return null;
  if (typeof resetTime === "number" && Number.isFinite(resetTime)) {
    // Heuristic: seconds vs milliseconds since epoch.
    const ms = resetTime < 1e12 ? resetTime * 1000 : resetTime;
    return new Date(ms).toISOString();
  }
  if (typeof resetTime === "string" && resetTime.trim().length > 0) return resetTime.trim();
  return null;
}

/** Convert a 0-1 "remaining fraction" into a 0-100 "used percent". */
function usedPercentFromRemainingFraction(fraction: number | null | undefined): number | null {
  if (fraction == null || !Number.isFinite(fraction)) return null;
  const clampedFraction = Math.min(1, Math.max(0, fraction));
  return Math.round((1 - clampedFraction) * 100);
}

function remainingAmountLabel(amount: string | number | null | undefined): string | null {
  if (typeof amount === "number" && Number.isFinite(amount)) return `${amount} remaining`;
  if (typeof amount === "string" && amount.trim().length > 0) {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) return `${parsed} remaining`;
  }
  return null;
}

/**
 * Map Code Assist quota buckets into QuotaWindow rows. Pure + exported for tests.
 * One bucket per model; remainingFraction is the share of the window still
 * available, so usedPercent is its complement.
 */
export function mapGeminiQuotaBuckets(
  buckets: QuotaBucket[] | null | undefined,
  tierName: string | null = null,
): QuotaWindow[] {
  if (!Array.isArray(buckets)) return [];
  const windows: QuotaWindow[] = [];
  for (const bucket of buckets) {
    const modelId = typeof bucket.modelId === "string" ? bucket.modelId.trim() : "";
    if (!modelId) continue;
    if (bucket.remainingFraction == null && bucket.remainingAmount == null) continue;
    windows.push({
      label: tierName ? `${modelId} (${tierName})` : modelId,
      usedPercent: usedPercentFromRemainingFraction(bucket.remainingFraction),
      resetsAt: normalizeResetTime(bucket.resetTime),
      valueLabel: remainingAmountLabel(bucket.remainingAmount),
      detail: null,
    });
  }
  return windows;
}

export interface GeminiCodeAssistQuota {
  windows: QuotaWindow[];
  projectId: string | null;
  tierName: string | null;
}

/**
 * Proactive quota read: ask Code Assist for the signed-in user's per-model
 * remaining quota using the gemini CLI's local OAuth token.
 */
export async function fetchGeminiCodeAssistQuota(): Promise<GeminiCodeAssistQuota> {
  const creds = await readGeminiOAuthCreds();
  if (!creds) {
    throw new Error("no local gemini OAuth credentials (expected ~/.gemini/oauth_creds.json)");
  }
  if (creds.expiryDate != null && creds.expiryDate <= Date.now()) {
    throw new Error("gemini OAuth token is expired — run a gemini agent or `gemini` to refresh it");
  }

  let projectId = geminiProjectIdFromEnv();
  const load = await loadCodeAssist(creds.accessToken, projectId);
  projectId =
    projectId ??
    (typeof load.cloudaicompanionProject === "string" && load.cloudaicompanionProject.trim().length > 0
      ? load.cloudaicompanionProject.trim()
      : null);
  const tierName =
    (typeof load.paidTier?.name === "string" && load.paidTier.name.trim().length > 0
      ? load.paidTier.name.trim()
      : null) ??
    (typeof load.currentTier?.name === "string" && load.currentTier.name.trim().length > 0
      ? load.currentTier.name.trim()
      : null);

  if (!projectId) {
    throw new Error("could not resolve a Google Cloud project for gemini quota lookup");
  }

  const quota = await retrieveUserQuota(creds.accessToken, projectId);
  return { windows: mapGeminiQuotaBuckets(quota.buckets, tierName), projectId, tierName };
}

// ---------------------------------------------------------------------------
// Reactive fallback — derive an "exhausted" estimate from recent run failures
// ---------------------------------------------------------------------------

/** One recent gemini_local heartbeat run, as seen by the reactive estimator. */
export interface GeminiQuotaRunSample {
  /** when the run finished (or was last observed) */
  at: Date;
  /** whether the run failed; a non-failed run counts as a successful gemini call */
  failed: boolean;
  error?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  parsed?: Record<string, unknown> | null;
}

export interface GeminiReactiveOptions {
  /** current time, injectable for tests */
  now?: Date;
  /** ignore exhaustion signals older than this; defaults to 6h */
  maxAgeMs?: number;
}

const DEFAULT_REACTIVE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function sampleLooksExhausted(sample: GeminiQuotaRunSample): boolean {
  if (!sample.failed) return false;
  return detectGeminiQuotaExhausted({
    parsed: sample.parsed ?? null,
    stderr: sample.stderr ?? sample.error ?? "",
  }).exhausted;
}

/**
 * Build a reactive quota estimate from recent gemini_local runs. Returns a single
 * "exhausted" window (usedPercent 100) when the most recent decisive signal is a
 * rate-limit/quota failure and nothing has succeeded since. Pure + exported for tests.
 *
 * This is intentionally coarse: the gemini CLI exposes no reset timestamp on a
 * rejected request, so resetsAt is left null and the window is clearly labelled an
 * estimate. Its job is to flip Google quota from "invisible" to "visibly exhausted"
 * for the session-limit watcher and the Controller quota bars.
 */
export function buildGeminiReactiveWindows(
  samples: GeminiQuotaRunSample[],
  options: GeminiReactiveOptions = {},
): QuotaWindow[] {
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_REACTIVE_MAX_AGE_MS;

  let latestExhaustionAt: Date | null = null;
  let latestSuccessAt: Date | null = null;
  for (const sample of samples) {
    if (sampleLooksExhausted(sample)) {
      if (!latestExhaustionAt || sample.at > latestExhaustionAt) latestExhaustionAt = sample.at;
    } else if (!sample.failed) {
      if (!latestSuccessAt || sample.at > latestSuccessAt) latestSuccessAt = sample.at;
    }
  }

  if (!latestExhaustionAt) return [];
  if (now.getTime() - latestExhaustionAt.getTime() > maxAgeMs) return [];
  // A successful call after the last rejection means the pool recovered.
  if (latestSuccessAt && latestSuccessAt > latestExhaustionAt) return [];

  return [
    {
      label: "Google AI (estimated)",
      usedPercent: 100,
      resetsAt: null,
      valueLabel: "Exhausted",
      detail: `Reactive estimate — last rate-limit at ${latestExhaustionAt.toISOString()}`,
    },
  ];
}

function formatProviderError(source: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${source}: ${message}`;
}

/**
 * Adapter entrypoint. Returns the proactive Code Assist reading when available.
 * The reactive heartbeat estimate lives server-side (it needs DB access the
 * adapter doesn't have); on failure here the server falls back to that estimate.
 */
export async function getQuotaWindows(): Promise<ProviderQuotaResult> {
  try {
    const quota = await fetchGeminiCodeAssistQuota();
    return {
      provider: "google",
      source: GEMINI_QUOTA_SOURCE_CODE_ASSIST,
      ok: true,
      windows: quota.windows,
    };
  } catch (error) {
    return {
      provider: "google",
      ok: false,
      error: formatProviderError("Gemini Code Assist quota", error),
      windows: [],
    };
  }
}
