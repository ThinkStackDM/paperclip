/**
 * Fallback "sister" lanes: cloned agents named after their primary with a
 * provider suffix (e.g. "GLaD0S-Codex", "GLaD0S-Grok"). Agent lists detect
 * the suffix to badge the lane and keep clones grouped under their primary
 * instead of scattering them through the list.
 */
export const FALLBACK_LANE_SUFFIXES = ["Codex", "Grok", "Hermes", "Gemini"] as const;

export type FallbackLane = (typeof FALLBACK_LANE_SUFFIXES)[number];

export type AgentFallbackLane = {
  base: string;
  lane: FallbackLane;
};

export function getAgentFallbackLane(name: string): AgentFallbackLane | null {
  for (const lane of FALLBACK_LANE_SUFFIXES) {
    const suffix = `-${lane}`;
    if (name.length > suffix.length && name.endsWith(suffix)) {
      return { base: name.slice(0, -suffix.length), lane };
    }
  }
  return null;
}

/**
 * Reorders agents so fallback-lane clones sit directly after their primary
 * agent. Agents without a lane suffix, and clones whose primary is not in
 * the list, keep their original relative order.
 */
export function groupAgentFallbackLanes<T extends { name: string }>(agents: T[]): T[] {
  const names = new Set(agents.map((agent) => agent.name));
  const clonesByBase = new Map<string, T[]>();
  for (const agent of agents) {
    const laneInfo = getAgentFallbackLane(agent.name);
    if (!laneInfo || !names.has(laneInfo.base)) continue;
    const clones = clonesByBase.get(laneInfo.base) ?? [];
    clones.push(agent);
    clonesByBase.set(laneInfo.base, clones);
  }
  if (clonesByBase.size === 0) return agents;

  const result: T[] = [];
  for (const agent of agents) {
    const laneInfo = getAgentFallbackLane(agent.name);
    if (laneInfo && names.has(laneInfo.base)) continue; // emitted after its primary
    result.push(agent);
    const clones = clonesByBase.get(agent.name);
    if (clones) result.push(...clones);
  }
  return result;
}
