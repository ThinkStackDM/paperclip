import type { Issue } from "@paperclipai/shared";

/**
 * An issue is an "actionable ask" when its attention carries a concrete decision the user can
 * resolve in one hop — a linked approval or a pending thread interaction (confirmation / question).
 * These are the needles the Portfolio "Needs you" section surfaces and highlights; everything else
 * (blocked-chain context, recovery, missing disposition) is the haystack it was hiding in.
 */
export function isActionableAsk(issue: Pick<Issue, "blockedInboxAttention">): boolean {
  const attention = issue.blockedInboxAttention;
  return Boolean(attention && (attention.approvalId || attention.interactionId));
}

export type NeedsYouForest = {
  byId: Map<string, Issue>;
  childrenOf: Map<string, string[]>;
  /** Top-of-chain issues, ordered by where the cluster first appears in the source list. */
  roots: string[];
};

/**
 * Fold the flat "Needs you" list into a forest so a buried approval no longer reads as a flat row
 * disconnected from the work it gates. Edges point ancestor → descendant (top of chain → the deep
 * leaf that holds the ask), drawn from three relationships already present on the payload:
 *   • sub-issues   — child.parentId === ancestor.id
 *   • blockers     — ancestor.blockedBy[].id (and recursive terminalBlockers) === descendant.id
 *   • attention    — ancestor.blockedInboxAttention.leafIssue.id === descendant.id
 * Only issues that are themselves in the list become nodes; non-flagged links are skipped (a chain
 * with a single flagged member just renders flat, exactly as before).
 */
export function buildNeedsYouForest(issues: Issue[]): NeedsYouForest {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const indexById = new Map(issues.map((issue, index) => [issue.id, index]));

  // child id -> candidate ancestor ids (a child can be reachable from several ancestors in a DAG).
  const candidates = new Map<string, Set<string>>();
  const addEdge = (parentId: string, childId: string) => {
    if (parentId === childId || !byId.has(parentId) || !byId.has(childId)) return;
    let set = candidates.get(childId);
    if (!set) {
      set = new Set();
      candidates.set(childId, set);
    }
    set.add(parentId);
  };
  for (const issue of issues) {
    if (issue.parentId) addEdge(issue.parentId, issue.id);
    for (const blocker of issue.blockedBy ?? []) {
      addEdge(issue.id, blocker.id);
      for (const terminal of blocker.terminalBlockers ?? []) addEdge(issue.id, terminal.id);
    }
    const leaf = issue.blockedInboxAttention?.leafIssue;
    if (leaf?.id) addEdge(issue.id, leaf.id);
  }

  // Longest distance from any root, used to pick a single parent per node so a linear chain stays
  // linear (A→B→C, not A→{B,C}). Memoised DFS with an on-stack guard against cyclic relations.
  const depthMemo = new Map<string, number>();
  const onStack = new Set<string>();
  const depthOf = (id: string): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    if (onStack.has(id)) return 0;
    onStack.add(id);
    let best = 0;
    for (const parent of candidates.get(id) ?? []) best = Math.max(best, depthOf(parent) + 1);
    onStack.delete(id);
    depthMemo.set(id, best);
    return best;
  };

  const parentOf = new Map<string, string>();
  const wouldCycle = (childId: string, parentId: string): boolean => {
    const seen = new Set<string>();
    let cur: string | undefined = parentId;
    while (cur) {
      if (cur === childId) return true;
      if (seen.has(cur)) return true;
      seen.add(cur);
      cur = parentOf.get(cur);
    }
    return false;
  };
  for (const issue of issues) {
    const cands = candidates.get(issue.id);
    if (!cands) continue;
    let chosen: string | null = null;
    let chosenDepth = -1;
    for (const parent of cands) {
      const d = depthOf(parent);
      if (d > chosenDepth) {
        chosenDepth = d;
        chosen = parent;
      }
    }
    if (chosen && !wouldCycle(issue.id, chosen)) parentOf.set(issue.id, chosen);
  }

  const childrenOf = new Map<string, string[]>();
  for (const [childId, parentId] of parentOf) {
    const arr = childrenOf.get(parentId) ?? [];
    arr.push(childId);
    childrenOf.set(parentId, arr);
  }

  const subtreeMinIndexMemo = new Map<string, number>();
  const subtreeMinIndex = (id: string): number => {
    const cached = subtreeMinIndexMemo.get(id);
    if (cached !== undefined) return cached;
    let min = indexById.get(id) ?? 0;
    for (const child of childrenOf.get(id) ?? []) min = Math.min(min, subtreeMinIndex(child));
    subtreeMinIndexMemo.set(id, min);
    return min;
  };
  for (const [, children] of childrenOf) {
    children.sort((a, b) => subtreeMinIndex(a) - subtreeMinIndex(b));
  }

  const roots = issues
    .map((issue) => issue.id)
    .filter((id) => !parentOf.has(id))
    .sort((a, b) => subtreeMinIndex(a) - subtreeMinIndex(b));

  return { byId, childrenOf, roots };
}

/** Count the actionable asks and total members within a chain subtree, for the chain's hint line. */
export function chainStats(rootId: string, forest: NeedsYouForest): { size: number; asks: number } {
  let size = 0;
  let asks = 0;
  const walk = (id: string) => {
    const issue = forest.byId.get(id);
    if (!issue) return;
    size += 1;
    if (isActionableAsk(issue)) asks += 1;
    for (const child of forest.childrenOf.get(id) ?? []) walk(child);
  };
  walk(rootId);
  return { size, asks };
}
