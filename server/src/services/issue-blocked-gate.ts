// A blocked issue with no first-class blocker relation is only legitimate when the
// description names an explicit external gate. Shared by the route-level guard in
// routes/issues.ts and the service-level enter-blocked guard in services/issues.ts so
// every writer enforces the same contract. Lives in its own module so route tests that
// mock services/issues.js keep the real implementation.
export function hasExplicitExternalOwnerAction(description: unknown): boolean {
  if (typeof description !== "string" || description.trim().length === 0) return false;
  const owner = description.match(/^\s*external owner\s*:\s*(.+)$/im)?.[1]?.trim();
  const action = description.match(/^\s*external action\s*:\s*(.+)$/im)?.[1]?.trim();
  return Boolean(owner && action);
}
