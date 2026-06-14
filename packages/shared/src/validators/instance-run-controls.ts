import { z } from "zod";

const adapterTypeSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9_:-]+$/i, {
  message: "adapterType must be an adapter type identifier",
});

export const setInstanceRunPauseSchema = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();

export const setInstanceAdapterPauseSchema = z.object({
  adapterType: adapterTypeSchema,
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();

export const patchInstanceAdapterConcurrencySchema = z.object({
  adapterConcurrency: z.record(
    adapterTypeSchema,
    z.number().int().min(1).max(50).nullable(),
  ),
}).strict();

export type SetInstanceRunPause = z.infer<typeof setInstanceRunPauseSchema>;
export type SetInstanceAdapterPause = z.infer<typeof setInstanceAdapterPauseSchema>;
export type PatchInstanceAdapterConcurrency = z.infer<typeof patchInstanceAdapterConcurrencySchema>;
