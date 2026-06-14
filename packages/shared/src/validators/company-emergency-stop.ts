import { z } from "zod";
import {
  COMPANY_EMERGENCY_STOP_ALLOWLIST_ACTIONS,
  COMPANY_EMERGENCY_STOP_MODES,
} from "../types/company-emergency-stop.js";

export const companyEmergencyStopModeSchema = z.enum(COMPANY_EMERGENCY_STOP_MODES);
export const companyEmergencyStopAllowlistActionSchema = z.enum(COMPANY_EMERGENCY_STOP_ALLOWLIST_ACTIONS);

export const companyEmergencyStopStateSchema = z.object({
  mode: companyEmergencyStopModeSchema,
  reason: z.string().nullable(),
  linkedIssueId: z.string().uuid().nullable(),
  linkedIssueIdentifier: z.string().min(1).nullable(),
  ownerType: z.enum(["user", "agent"]).nullable(),
  ownerId: z.string().min(1).nullable(),
  createdAt: z.coerce.date().nullable(),
  clearedAt: z.coerce.date().nullable(),
  clearedByType: z.enum(["user", "agent"]).nullable(),
  clearedById: z.string().min(1).nullable(),
  allowlist: z.array(companyEmergencyStopAllowlistActionSchema),
});

export const setCompanyEmergencyStopSchema = z.object({
  mode: z.enum(["stop_mutation", "recovery"]),
  reason: z.string().trim().min(1).max(2000),
  linkedIssueId: z.string().uuid().nullable().optional(),
  linkedIssueIdentifier: z.string().trim().min(1).nullable().optional(),
  allowlist: z.array(companyEmergencyStopAllowlistActionSchema).max(10).optional().default([]),
}).strict();

export const clearCompanyEmergencyStopSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  linkedIssueId: z.string().uuid().nullable().optional(),
  linkedIssueIdentifier: z.string().trim().min(1).nullable().optional(),
}).strict();

export type CompanyEmergencyStopStateInput = z.infer<typeof companyEmergencyStopStateSchema>;
export type SetCompanyEmergencyStop = z.infer<typeof setCompanyEmergencyStopSchema>;
export type ClearCompanyEmergencyStop = z.infer<typeof clearCompanyEmergencyStopSchema>;
