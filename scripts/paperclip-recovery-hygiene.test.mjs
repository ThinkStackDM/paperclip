import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCleanupComment,
  buildCleanupPatch,
  parseArgs,
} from "./paperclip-recovery-hygiene.mjs";

test("buildCleanupComment renders tracked vehicle links and reason", () => {
  const comment = buildCleanupComment({
    auditIssueIdentifiers: ["THIAAAAAA-4406", "THIAAAAAA-4495"],
    reason: "Historical paused-agent recovery clutter",
  });

  assert.match(comment, /\[THIAAAAAA-4406\]\(\/THIAAAAAA\/issues\/THIAAAAAA-4406\)/);
  assert.match(comment, /\[THIAAAAAA-4495\]\(\/THIAAAAAA\/issues\/THIAAAAAA-4495\)/);
  assert.match(comment, /Historical paused-agent recovery clutter/);
});

test("buildCleanupPatch includes status, assignee, and comment", () => {
  const patch = buildCleanupPatch({
    status: "cancelled",
    assigneeAgentId: "agent-123",
    comment: "cleanup",
  });

  assert.deepEqual(patch, {
    status: "cancelled",
    assigneeAgentId: "agent-123",
    comment: "cleanup",
  });
});

test("parseArgs handles configure-owner including owner clearing", () => {
  const parsed = parseArgs([
    "configure-owner",
    "--company-id",
    "company-123",
    "--owner-agent-id",
    "none",
    "--dry-run",
  ]);

  assert.equal(parsed.mode, "configure-owner");
  assert.equal(parsed.companyId, "company-123");
  assert.equal(parsed.ownerAgentId, null);
  assert.equal(parsed.dryRun, true);
});

test("parseArgs handles cleanup with repeated issues and defaults", () => {
  const parsed = parseArgs([
    "cleanup",
    "--issue",
    "THIAAAAAA-3724",
    "--issue-id",
    "THIAAAAAA-3751",
    "--audit-issue",
    "THIAAAAAA-4406",
    "--reason",
    "Historical paused-agent recovery clutter",
  ]);

  assert.equal(parsed.mode, "cleanup");
  assert.deepEqual(parsed.issues, ["THIAAAAAA-3724", "THIAAAAAA-3751"]);
  assert.deepEqual(parsed.auditIssueIdentifiers, ["THIAAAAAA-4406"]);
  assert.equal(parsed.status, "cancelled");
  assert.equal(parsed.reason, "Historical paused-agent recovery clutter");
});
