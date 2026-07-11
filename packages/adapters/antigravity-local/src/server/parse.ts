export interface ParsedAntigravityOutput {
  sessionId: string | null;
  summary: string;
  errorMessage: string | null;
}

export interface AntigravityQuotaExhaustedMatch {
  exhausted: boolean;
  matchedLine: string | null;
  resetAt: Date | null;
}

const CONVERSATION_ID_RE =
  /(?:conversation|session)(?:\s+id)?\s*[:=]\s*([A-Za-z0-9._:-]+)/i;
const ANTIGRAVITY_QUOTA_EXHAUSTED_RE =
  /(?:resource[ _-]?exhausted|resource has been exhausted|quota (?:exceeded|exhausted|reached)|individual quota reached|exceeded your[^.\n]{0,40}quota|ineligible[ _-]?tier|upgrade your subscription to increase your limits)/i;
const ANTIGRAVITY_RESET_IN_RE =
  /resets?\s+in\s+(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/i;

export function parseAntigravityOutput(stdout: string, stderr = ""): ParsedAntigravityOutput {
  const sessionId =
    CONVERSATION_ID_RE.exec(stdout)?.[1]?.trim() ??
    CONVERSATION_ID_RE.exec(stderr)?.[1]?.trim() ??
    null;
  return {
    sessionId,
    summary: stdout.trim(),
    errorMessage: null,
  };
}

export function isAntigravityUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`;
  return /unknown\s+(?:conversation|session)|(?:conversation|session)(?:\s+.*)?\s+not\s+found|invalid\s+(?:conversation|session)/i.test(haystack);
}

function parseResetAtFromQuotaLine(line: string, now: Date): Date | null {
  const match = ANTIGRAVITY_RESET_IN_RE.exec(line);
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const totalMs =
    (days * 24 * 60 * 60 * 1000) +
    (hours * 60 * 60 * 1000) +
    (minutes * 60 * 1000) +
    (seconds * 1000);
  if (totalMs <= 0) return null;
  return new Date(now.getTime() + totalMs);
}

export function detectAntigravityQuotaExhausted(input: {
  stderr: string;
  now?: Date;
}): AntigravityQuotaExhaustedMatch {
  const messages = input.stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matchedLine = messages.find((line) => ANTIGRAVITY_QUOTA_EXHAUSTED_RE.test(line)) ?? null;
  const now = input.now ?? new Date();
  return {
    exhausted: Boolean(matchedLine),
    matchedLine,
    resetAt: matchedLine ? parseResetAtFromQuotaLine(matchedLine, now) : null,
  };
}
