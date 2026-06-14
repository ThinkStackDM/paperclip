#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const HELP_TEXT = `Usage:
  node scripts/paperclip-recovery-hygiene.mjs configure-owner --company-id <uuid> --owner-agent-id <uuid|none> [--dry-run]
  node scripts/paperclip-recovery-hygiene.mjs cleanup --issue <issue-id-or-identifier> [--issue <...> ...] [--status cancelled] [--assignee-agent-id <uuid>] [--audit-issue <identifier> ...] [--reason <text>] [--comment-file <path>|-] [--dry-run]

Environment defaults:
  PAPERCLIP_API_URL
  PAPERCLIP_API_KEY
  PAPERCLIP_RUN_ID

Examples:
  node scripts/paperclip-recovery-hygiene.mjs configure-owner --company-id "$PAPERCLIP_COMPANY_ID" --owner-agent-id f949f432-0f92-497e-aa82-1c7cf8c6fb87
  node scripts/paperclip-recovery-hygiene.mjs cleanup --issue THIAAAAAA-3724 --issue THIAAAAAA-3751 --audit-issue THIAAAAAA-4406 --audit-issue THIAAAAAA-4495 --reason "Historical paused-agent recovery clutter"
`;

function fail(message) {
  throw new Error(message);
}

function shiftValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`Missing value for ${flag}`);
  }
  return value;
}

function normalizeNullableAgentId(value) {
  if (!value) return null;
  if (["none", "null", "clear"].includes(value.toLowerCase())) return null;
  return value;
}

function buildIssueLink(identifier) {
  const prefix = identifier.includes("-") ? identifier.split("-")[0] : "PAP";
  return `[${identifier}](/${prefix}/issues/${identifier})`;
}

export function buildCleanupComment(input = {}) {
  const auditIssueIdentifiers = Array.isArray(input.auditIssueIdentifiers) ? input.auditIssueIdentifiers : [];
  const trackedVehicle = auditIssueIdentifiers.length > 0
    ? auditIssueIdentifiers.map((identifier) => buildIssueLink(identifier)).join(", ")
    : null;
  const reason = input.reason?.trim() || "Historical paused-agent recovery clutter cleared after audit review.";

  return [
    "Closed under the recovery clutter audit/override policy.",
    "",
    trackedVehicle ? `- Tracked vehicle: ${trackedVehicle}` : null,
    `- Reason: ${reason}`,
    "- Action: this stale recovery/noise item was intentionally resolved in bulk instead of keeping a dead strand open.",
    "- Canonical work should continue on the tracked vehicle above; a fresh recovery can still be created later if new evidence requires it.",
  ].filter(Boolean).join("\n");
}

function readComment(commentFile) {
  if (!commentFile) return null;
  if (commentFile === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(commentFile, "utf8");
}

export function buildCleanupPatch(input) {
  const patch = {};
  if (input.status) patch.status = input.status;
  if (input.assigneeAgentId !== undefined) patch.assigneeAgentId = input.assigneeAgentId;
  if (input.comment) patch.comment = input.comment;
  return patch;
}

export function parseArgs(argv) {
  const args = [...argv];
  const mode = args.shift();
  if (!mode || mode === "--help" || mode === "-h") {
    return { mode: "help" };
  }

  const common = {
    apiUrl: process.env.PAPERCLIP_API_URL ?? null,
    apiKey: process.env.PAPERCLIP_API_KEY ?? null,
    runId: process.env.PAPERCLIP_RUN_ID ?? "manual-script",
    dryRun: false,
  };

  if (mode === "configure-owner") {
    const parsed = {
      ...common,
      mode,
      companyId: null,
      ownerAgentId: null,
    };
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      switch (arg) {
        case "--company-id":
          parsed.companyId = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--owner-agent-id":
          parsed.ownerAgentId = normalizeNullableAgentId(shiftValue(args, i, arg));
          i += 1;
          break;
        case "--api-url":
          parsed.apiUrl = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--api-key":
          parsed.apiKey = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--run-id":
          parsed.runId = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--dry-run":
          parsed.dryRun = true;
          break;
        default:
          fail(`Unknown argument: ${arg}`);
      }
    }
    if (!parsed.companyId) fail("--company-id is required");
    return parsed;
  }

  if (mode === "cleanup") {
    const parsed = {
      ...common,
      mode,
      issues: [],
      auditIssueIdentifiers: [],
      status: "cancelled",
      assigneeAgentId: undefined,
      reason: "",
      commentFile: null,
    };
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      switch (arg) {
        case "--issue":
        case "--issue-id":
          parsed.issues.push(shiftValue(args, i, arg));
          i += 1;
          break;
        case "--audit-issue":
          parsed.auditIssueIdentifiers.push(shiftValue(args, i, arg));
          i += 1;
          break;
        case "--status":
          parsed.status = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--assignee-agent-id":
          parsed.assigneeAgentId = normalizeNullableAgentId(shiftValue(args, i, arg));
          i += 1;
          break;
        case "--reason":
          parsed.reason = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--comment-file":
          parsed.commentFile = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--api-url":
          parsed.apiUrl = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--api-key":
          parsed.apiKey = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--run-id":
          parsed.runId = shiftValue(args, i, arg);
          i += 1;
          break;
        case "--dry-run":
          parsed.dryRun = true;
          break;
        default:
          fail(`Unknown argument: ${arg}`);
      }
    }
    if (parsed.issues.length === 0) fail("At least one --issue is required");
    return parsed;
  }

  fail(`Unknown mode: ${mode}`);
}

async function patchJson(url, apiKey, runId, body, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Paperclip-Run-Id": runId,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`PATCH ${url} failed with ${response.status}`);
    error.response = payload;
    throw error;
  }
  return payload;
}

export async function run(parsed, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const stdout = options.stdout ?? process.stdout;
  if (parsed.mode === "help") {
    stdout.write(`${HELP_TEXT}\n`);
    return [];
  }

  if (!parsed.apiUrl) fail("Missing API URL. Set PAPERCLIP_API_URL or pass --api-url.");
  if (!parsed.apiKey) fail("Missing API key. Set PAPERCLIP_API_KEY or pass --api-key.");

  if (parsed.mode === "configure-owner") {
    const payload = {
      strandedRecoveryOwnerAgentId: parsed.ownerAgentId,
    };
    if (parsed.dryRun) {
      stdout.write(`${JSON.stringify({ mode: parsed.mode, companyId: parsed.companyId, payload }, null, 2)}\n`);
      return [{ companyId: parsed.companyId, dryRun: true, payload }];
    }
    const result = await patchJson(
      `${parsed.apiUrl}/api/companies/${parsed.companyId}`,
      parsed.apiKey,
      parsed.runId,
      payload,
      fetchImpl,
    );
    stdout.write(`${JSON.stringify({ companyId: parsed.companyId, strandedRecoveryOwnerAgentId: result.strandedRecoveryOwnerAgentId }, null, 2)}\n`);
    return [result];
  }

  const comment = readComment(parsed.commentFile) ?? buildCleanupComment({
    auditIssueIdentifiers: parsed.auditIssueIdentifiers,
    reason: parsed.reason,
  });
  const patch = buildCleanupPatch({
    status: parsed.status,
    assigneeAgentId: parsed.assigneeAgentId,
    comment,
  });

  if (parsed.dryRun) {
    const preview = parsed.issues.map((issue) => ({ issue, patch }));
    stdout.write(`${JSON.stringify({ mode: parsed.mode, preview }, null, 2)}\n`);
    return preview;
  }

  const results = [];
  for (const issue of parsed.issues) {
    const result = await patchJson(
      `${parsed.apiUrl}/api/issues/${issue}`,
      parsed.apiKey,
      parsed.runId,
      patch,
      fetchImpl,
    );
    results.push({
      issue,
      id: result.id,
      identifier: result.identifier,
      status: result.status,
      assigneeAgentId: result.assigneeAgentId,
    });
  }
  stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  return results;
}

async function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    await run(parsed);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
