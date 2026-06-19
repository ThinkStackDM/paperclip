import { describe, expect, it } from "vitest";
import { normalizeExperimentalSettings } from "../services/instance-settings.js";

describe("instance settings service", () => {
  it("ignores retired experimental flags without resetting current settings", () => {
    expect(normalizeExperimentalSettings({
      enableEnvironments: true,
      enableIsolatedWorkspaces: true,
      enableIssuePlanDecompositions: true,
      enableCloudSync: true,
      autoRestartDevServerWhenIdle: true,
      enableIssueGraphLivenessAutoRecovery: true,
      issueGraphLivenessAutoRecoveryLookbackHours: 48,
      enableNewestFirstIssueThread: true,
    })).toEqual({
      enableEnvironments: true,
      enableIsolatedWorkspaces: true,
      enableIssuePlanDecompositions: true,
      enableCloudSync: true,
      autoRestartDevServerWhenIdle: true,
      enableIssueGraphLivenessAutoRecovery: true,
      issueGraphLivenessAutoRecoveryLookbackHours: 48,
      issueGraphLivenessExcludedCompanyIds: [],
    });
  });

  it("preserves issueGraphLivenessExcludedCompanyIds and defaults it to empty", () => {
    const companyId = "e212ce50-b524-408c-b3d4-0c6108d8c2e2";
    expect(
      normalizeExperimentalSettings({ issueGraphLivenessExcludedCompanyIds: [companyId] })
        .issueGraphLivenessExcludedCompanyIds,
    ).toEqual([companyId]);
    expect(normalizeExperimentalSettings({}).issueGraphLivenessExcludedCompanyIds).toEqual([]);
  });
});
