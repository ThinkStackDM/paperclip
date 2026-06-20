export interface ParsedAntigravityOutput {
  sessionId: string | null;
  summary: string;
  errorMessage: string | null;
}

const CONVERSATION_ID_RE =
  /(?:conversation|session)(?:\s+id)?\s*[:=]\s*([A-Za-z0-9._:-]+)/i;

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
