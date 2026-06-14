export const COMPANY_EMERGENCY_STOP_MODES = [
  "normal",
  "stop_mutation",
  "recovery",
] as const;

export const COMPANY_EMERGENCY_STOP_MUTATION_CATEGORIES = [
  "issue_creation",
  "issue_mutation",
  "routine_provisioning",
  "outbound_dispatch",
  "fallback_reassign",
  "agent_lifecycle",
  "evidence_write",
  "emergency_alert",
] as const;

export const COMPANY_EMERGENCY_STOP_ALLOWLIST_ACTIONS = [
  "emergency_alert",
] as const;

export type CompanyEmergencyStopMode = (typeof COMPANY_EMERGENCY_STOP_MODES)[number];
export type CompanyEmergencyStopMutationCategory =
  (typeof COMPANY_EMERGENCY_STOP_MUTATION_CATEGORIES)[number];
export type CompanyEmergencyStopAllowlistAction =
  (typeof COMPANY_EMERGENCY_STOP_ALLOWLIST_ACTIONS)[number];

export interface CompanyEmergencyStopState {
  mode: CompanyEmergencyStopMode;
  reason: string | null;
  linkedIssueId: string | null;
  linkedIssueIdentifier: string | null;
  ownerType: "user" | "agent" | null;
  ownerId: string | null;
  createdAt: Date | null;
  clearedAt: Date | null;
  clearedByType: "user" | "agent" | null;
  clearedById: string | null;
  allowlist: CompanyEmergencyStopAllowlistAction[];
}
