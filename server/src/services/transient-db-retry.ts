import { isTransientDbError } from "../errors.js";
import { logger } from "../middleware/logger.js";

const DEFAULT_TRANSIENT_DB_RETRY_ATTEMPTS = 3;
const DEFAULT_TRANSIENT_DB_RETRY_DELAY_MS = 250;

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function readTransientDbRetryAttempts() {
  return readPositiveIntegerEnv(
    "PAPERCLIP_TRANSIENT_DB_RETRY_ATTEMPTS",
    DEFAULT_TRANSIENT_DB_RETRY_ATTEMPTS,
  );
}

function readTransientDbRetryDelayMs() {
  return readPositiveIntegerEnv(
    "PAPERCLIP_TRANSIENT_DB_RETRY_DELAY_MS",
    DEFAULT_TRANSIENT_DB_RETRY_DELAY_MS,
  );
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransientDbRetry<T>(
  operation: string,
  action: (attempt: number) => Promise<T>,
  context: Record<string, unknown> = {},
): Promise<T> {
  const maxAttempts = Math.max(1, readTransientDbRetryAttempts());
  const baseDelayMs = readTransientDbRetryDelayMs();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      const retryable = isTransientDbError(error);
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = Math.max(0, baseDelayMs * attempt);
      logger.warn(
        {
          err: error,
          operation,
          attempt,
          maxAttempts,
          delayMs,
          ...context,
        },
        "transient database error; retrying operation",
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`Transient retry loop exhausted unexpectedly for ${operation}`);
}
