import { z } from "zod";
import { isValidActivityWindowTimezone } from "../types/company-activity-window.js";

export const companyActivityWindowSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidActivityWindowTimezone, { message: "timezone must be a valid IANA timezone" }),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  sessionPurgeOnClose: z.boolean().optional().default(true),
}).strict();

export const setCompanyActivityWindowSchema = z.object({
  window: companyActivityWindowSchema.nullable(),
}).strict();

export const setCompanyRunPauseSchema = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();

export type CompanyActivityWindowInput = z.infer<typeof companyActivityWindowSchema>;
export type SetCompanyActivityWindow = z.infer<typeof setCompanyActivityWindowSchema>;
export type SetCompanyRunPause = z.infer<typeof setCompanyRunPauseSchema>;
