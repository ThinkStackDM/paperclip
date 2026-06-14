import type {
  InstanceExperimentalSettings,
  InstanceGeneralSettings,
  InstanceRunControls,
  IssueGraphLivenessAutoRecoveryPreview,
  PatchInstanceGeneralSettings,
  PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import { api } from "./client";

export const instanceSettingsApi = {
  getRunControls: () =>
    api.get<InstanceRunControls>("/instance/settings/run-controls"),
  pauseInstanceRuns: (reason?: string) =>
    api.post<InstanceRunControls>("/instance/settings/run-controls/pause", reason ? { reason } : {}),
  resumeInstanceRuns: () =>
    api.delete<InstanceRunControls>("/instance/settings/run-controls/pause"),
  pauseAdapterFamily: (adapterType: string, reason?: string) =>
    api.post<InstanceRunControls>("/instance/settings/run-controls/adapter-pauses", {
      adapterType,
      ...(reason ? { reason } : {}),
    }),
  resumeAdapterFamily: (adapterType: string) =>
    api.delete<InstanceRunControls>(
      `/instance/settings/run-controls/adapter-pauses/${encodeURIComponent(adapterType)}`,
    ),
  patchAdapterConcurrency: (adapterConcurrency: Record<string, number | null>) =>
    api.patch<InstanceRunControls>("/instance/settings/run-controls/concurrency", { adapterConcurrency }),
  getGeneral: () =>
    api.get<InstanceGeneralSettings>("/instance/settings/general"),
  updateGeneral: (patch: PatchInstanceGeneralSettings) =>
    api.patch<InstanceGeneralSettings>("/instance/settings/general", patch),
  getExperimental: () =>
    api.get<InstanceExperimentalSettings>("/instance/settings/experimental"),
  updateExperimental: (patch: PatchInstanceExperimentalSettings) =>
    api.patch<InstanceExperimentalSettings>("/instance/settings/experimental", patch),
  previewIssueGraphLivenessAutoRecovery: (input: { lookbackHours?: number }) =>
    api.post<IssueGraphLivenessAutoRecoveryPreview>(
      "/instance/settings/experimental/issue-graph-liveness-auto-recovery/preview",
      input,
    ),
  runIssueGraphLivenessAutoRecovery: (input: { lookbackHours?: number }) =>
    api.post<{
      findings: number;
      autoRecoveryEnabled: boolean;
      lookbackHours: number;
      cutoff: string;
      escalationsCreated: number;
      existingEscalations: number;
      skipped: number;
      skippedAutoRecoveryDisabled: number;
      skippedOutsideLookback: number;
      escalationIssueIds: string[];
    }>(
      "/instance/settings/experimental/issue-graph-liveness-auto-recovery/run",
      input,
    ),
};
