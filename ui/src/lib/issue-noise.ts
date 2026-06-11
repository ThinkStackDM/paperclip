import type { Issue } from "@paperclipai/shared";

/**
 * Title fragments that identify machine-generated coordination traffic
 * (synthetic probes, watchdog fires, inbox handshakes). These issues are
 * created in bulk by monitoring routines and almost always end done or
 * cancelled without operator action, so high-volume issue views hide them
 * by default behind the "Hide coordination noise" visibility filter.
 */
export const COORDINATION_NOISE_TITLE_PATTERNS = [
  "mission control inbound",
  "mc inbound",
  "halt-trigger",
  "ack-sweep",
  "binding-invariant probe",
  "review silent active run",
  "review productivity",
  "fallback-monitor",
  "token-burn watchdog",
] as const;

export function isCoordinationNoiseIssue(issue: Pick<Issue, "title">): boolean {
  const title = issue.title.toLowerCase();
  return COORDINATION_NOISE_TITLE_PATTERNS.some((pattern) => title.includes(pattern));
}
