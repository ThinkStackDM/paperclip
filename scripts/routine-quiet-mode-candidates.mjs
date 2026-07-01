#!/usr/bin/env node
/**
 * Routine quiet-mode candidate scanner.
 *
 * Read-only by default: lists noisy scheduled routines that are candidates for
 * PAPERCLIP_ROUTINE_ISSUE_MODE=reuse_terminal. Use --sync-paperclip to
 * create/update one TSMC rollout card.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";
const DEFAULT_OUT_DIR =
  process.env.ROUTINE_QUIET_OUT_DIR || "/Users/glad0s/TSKB/Operator/Routine Quiet Mode";
const TSMC_COMPANY_ID = "e6361895-a6a4-438d-bb76-b17a0ad026cb";
const ROLLUP_ASSIGNEE_USER_ID = "local-board";
const QUIET_MODE_KEY = "PAPERCLIP_ROUTINE_ISSUE_MODE";
const QUIET_MODE_VALUE = "reuse_terminal";

const NOISY_TITLE_RULES = [
  /\bfallback-monitor\b/i,
  /\bfallback-swap-back\b/i,
  /\bswap\/jetsam watchdog\b/i,
  /\bwatchdog\b/i,
  /\bhalt[- ]trigger\b/i,
  /\bhalt monitor\b/i,
  /\bmonitor\b/i,
];

function parseArgs(argv) {
  const args = {
    api: DEFAULT_API,
    outDir: DEFAULT_OUT_DIR,
    syncPaperclip: false,
    minFiresPerDay: 2,
    maxIssueBodyItems: 30,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api") args.api = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--sync-paperclip") args.syncPaperclip = true;
    else if (arg === "--min-fires-per-day") args.minFiresPerDay = Number(argv[++i]);
    else if (arg === "--max-issue-body-items") args.maxIssueBodyItems = Number(argv[++i]);
    else if (arg === "--help") {
      console.log("Usage: routine-quiet-mode-candidates.mjs [--out-dir PATH] [--sync-paperclip]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function request(api, method, route, body = undefined) {
  const headers = { "Content-Type": "application/json" };
  if (process.env.PAPERCLIP_API_KEY) {
    headers.Authorization = `Bearer ${process.env.PAPERCLIP_API_KEY}`;
  }
  const res = await fetch(`${api}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    throw new Error(`${method} ${route} -> HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.companies)) return data.companies;
  return [];
}

function companyPrefix(company) {
  return company.issuePrefix || company.prefix || company.shortName || company.name;
}

function readPlainEnvValue(env, key) {
  const binding = env?.[key];
  if (typeof binding === "string") return binding;
  if (binding && typeof binding === "object" && binding.type === "plain") return binding.value;
  return null;
}

function countCronField(field, max, min = 0) {
  const raw = String(field || "").trim();
  if (!raw || raw === "*") return max - min + 1;
  let total = 0;
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (!value) continue;
    const stepMatch = value.match(/^(\*|\d+)\/(\d+)$/);
    if (stepMatch) {
      const start = stepMatch[1] === "*" ? min : Number(stepMatch[1]);
      const step = Number(stepMatch[2]);
      if (Number.isFinite(start) && Number.isFinite(step) && step > 0) {
        total += Math.max(0, Math.floor((max - start) / step) + 1);
      }
      continue;
    }
    const rangeMatch = value.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const step = rangeMatch[3] ? Number(rangeMatch[3]) : 1;
      if (Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(step) && step > 0) {
        total += Math.max(0, Math.floor((end - start) / step) + 1);
      }
      continue;
    }
    if (/^\d+$/.test(value)) total += 1;
  }
  return total || 1;
}

function estimateCronRunsPerDay(cronExpression) {
  const parts = String(cronExpression || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const minutes = countCronField(minute, 59, 0);
  const hours = countCronField(hour, 23, 0);
  let perDay = minutes * hours;
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    perDay = perDay / 7;
  }
  return Number(perDay.toFixed(2));
}

function isNoisyRoutine(routine) {
  const text = `${routine.title || ""}\n${routine.description || ""}`;
  return NOISY_TITLE_RULES.some((rule) => rule.test(text));
}

function routineLink(item) {
  return `/${item.prefix}/routines/${item.id}`;
}

function displayRoutineTitle(item, sanitizeForIssue = false) {
  if (!sanitizeForIssue) return item.title;
  return item.title
    .replace(/Designer-Media/gi, "Designer lane")
    .replace(/video\.thinkstack\.ie/gi, "site TLS host");
}

async function collect(api, args) {
  const companies = asArray(await request(api, "GET", "/api/companies"));
  const routines = [];
  for (const company of companies) {
    const prefix = companyPrefix(company);
    const rows = asArray(await request(api, "GET", `/api/companies/${company.id}/routines`));
    for (const routine of rows) {
      const scheduleTriggers = asArray(routine.triggers).filter(
        (trigger) => trigger.kind === "schedule" && trigger.enabled,
      );
      if (!scheduleTriggers.length) continue;
      const firesPerDay = scheduleTriggers.reduce((sum, trigger) => {
        return sum + (estimateCronRunsPerDay(trigger.cronExpression) ?? 0);
      }, 0);
      const quietMode = readPlainEnvValue(routine.env, QUIET_MODE_KEY);
      const noisy = isNoisyRoutine(routine);
      const candidate = noisy && firesPerDay >= args.minFiresPerDay && quietMode !== QUIET_MODE_VALUE;
      routines.push({
        id: routine.id,
        prefix,
        companyId: company.id,
        companyName: company.name,
        title: routine.title || "",
        status: routine.status,
        assigneeAgentId: routine.assigneeAgentId || null,
        priority: routine.priority || "",
        quietMode: quietMode || null,
        firesPerDay,
        candidate,
        scheduleTriggers: scheduleTriggers.map((trigger) => ({
          id: trigger.id,
          label: trigger.label,
          cronExpression: trigger.cronExpression,
          timezone: trigger.timezone,
          nextRunAt: trigger.nextRunAt,
          lastFiredAt: trigger.lastFiredAt,
          lastResult: trigger.lastResult,
          estimatedRunsPerDay: estimateCronRunsPerDay(trigger.cronExpression),
        })),
      });
    }
  }
  routines.sort((a, b) => Number(b.candidate) - Number(a.candidate) || b.firesPerDay - a.firesPerDay);
  const candidates = routines.filter((routine) => routine.candidate);
  return {
    generatedAt: new Date().toISOString(),
    quietModeKey: QUIET_MODE_KEY,
    quietModeValue: QUIET_MODE_VALUE,
    summary: {
      scheduledRoutinesScanned: routines.length,
      candidates: candidates.length,
      estimatedCandidateFiresPerDay: Number(candidates.reduce((sum, item) => sum + item.firesPerDay, 0).toFixed(2)),
      alreadyEnabled: routines.filter((routine) => routine.quietMode === QUIET_MODE_VALUE).length,
    },
    candidates,
    routines,
  };
}

function markdownTable(rows, columns) {
  if (!rows.length) return "_None._";
  const header = `| ${columns.map((c) => c.label).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    return `| ${columns
      .map((c) => String(c.value(row) ?? "").replace(/\n/g, " ").replace(/\|/g, "\\|"))
      .join(" | ")} |`;
  });
  return [header, sep, ...body].join("\n");
}

function candidateTable(rows, options = {}) {
  const sanitizeTitles = Boolean(options.sanitizeTitles);
  return markdownTable(rows, [
    { label: "Runs/day", value: (r) => r.firesPerDay },
    { label: "Company", value: (r) => r.prefix },
    { label: "Routine", value: (r) => `[${displayRoutineTitle(r, sanitizeTitles)}](${routineLink(r)})` },
    { label: "Status", value: (r) => r.status },
    { label: "Current Mode", value: (r) => r.quietMode || "none" },
    { label: "Triggers", value: (r) => r.scheduleTriggers.map((t) => `${t.label || "schedule"} ${t.cronExpression}`).join("; ") },
  ]);
}

function buildMarkdown(report, maxIssueBodyItems) {
  return [
    "# Routine Quiet Mode Candidates",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "Quiet Mode support is opt-in via routine env. It reuses the latest terminal scheduled execution issue instead of creating a fresh visible card on every healthy fire.",
    "",
    "## Summary",
    "",
    `- Scheduled routines scanned: **${report.summary.scheduledRoutinesScanned}**`,
    `- Candidates: **${report.summary.candidates}**`,
    `- Estimated candidate fires/day: **${report.summary.estimatedCandidateFiresPerDay}**`,
    `- Already enabled: **${report.summary.alreadyEnabled}**`,
    `- Env flag: \`${report.quietModeKey}=${report.quietModeValue}\``,
    "",
    "## Candidate Routines",
    "",
    candidateTable(report.candidates.slice(0, maxIssueBodyItems)),
    "",
    "## Safe Rollout Rule",
    "",
    "Enable only after the running Paperclip server includes terminal execution issue reuse support. Start with one low-risk monitor, observe two scheduled fires, then expand.",
    "",
  ].join("\n");
}

async function writeReport(report, outDir, maxIssueBodyItems) {
  await mkdir(outDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `routine-quiet-mode-${stamp}.json`);
  const mdPath = path.join(outDir, `routine-quiet-mode-${stamp}.md`);
  const latestJson = path.join(outDir, "latest.json");
  const latestMd = path.join(outDir, "latest.md");
  const markdown = buildMarkdown(report, maxIssueBodyItems);
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(mdPath, markdown);
  await writeFile(latestJson, JSON.stringify(report, null, 2));
  await writeFile(latestMd, markdown);
  return { jsonPath, mdPath, latestJson, latestMd, markdown };
}

async function findRollupIssue(api) {
  const data = await request(
    api,
    "GET",
    `/api/companies/${TSMC_COMPANY_ID}/issues?q=${encodeURIComponent("Routine Quiet Mode")}&limit=20`,
  );
  const matches = asArray(data).filter((issue) => /routine quiet mode/i.test(issue.title || ""));
  const active = matches.find((issue) => !["done", "cancelled"].includes(issue.status));
  return active || matches[0] || null;
}

function issueBody(report, latestMdPath) {
  return [
    "## Routine Quiet Mode Rollout",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "Quiet Mode support is implemented as opt-in terminal execution issue reuse for scheduled routines.",
    "",
    `- Scheduled routines scanned: **${report.summary.scheduledRoutinesScanned}**`,
    `- Candidates: **${report.summary.candidates}**`,
    `- Estimated candidate fires/day: **${report.summary.estimatedCandidateFiresPerDay}**`,
    `- Already enabled: **${report.summary.alreadyEnabled}**`,
    `- Env flag: \`${report.quietModeKey}=${report.quietModeValue}\``,
    `- Full local report: \`${latestMdPath}\``,
    "",
    "### Top Candidates",
    "",
    candidateTable(report.candidates.slice(0, 20), { sanitizeTitles: true }),
    "",
    "### Rollout Gate",
    "",
    "Enable one canary only after the running Paperclip server includes the reuse support. Once a canary is enabled, observe two scheduled fires before expanding.",
  ].join("\n");
}

async function syncPaperclip(api, report, latestMdPath) {
  const existing = await findRollupIssue(api);
  const body = issueBody(report, latestMdPath);
  if (existing) {
    const updated = await request(api, "PATCH", `/api/issues/${existing.id}`, {
      status: "todo",
      description: body,
      assigneeAgentId: null,
      assigneeUserId: ROLLUP_ASSIGNEE_USER_ID,
      blockedByIssueIds: [],
    });
    return { action: "updated", issue: updated.identifier ? updated : existing };
  }
  const created = await request(api, "POST", `/api/companies/${TSMC_COMPANY_ID}/issues`, {
    title: "Routine Quiet Mode — rollout candidates",
    description: body,
    status: "todo",
    priority: "high",
    assigneeUserId: ROLLUP_ASSIGNEE_USER_ID,
  });
  return { action: "created", issue: created };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const api = args.api.replace(/\/$/, "");
  const report = await collect(api, args);
  const written = await writeReport(report, args.outDir, args.maxIssueBodyItems);
  const result = {
    generatedAt: report.generatedAt,
    scheduledRoutinesScanned: report.summary.scheduledRoutinesScanned,
    candidates: report.summary.candidates,
    estimatedCandidateFiresPerDay: report.summary.estimatedCandidateFiresPerDay,
    alreadyEnabled: report.summary.alreadyEnabled,
    latestMd: written.latestMd,
    latestJson: written.latestJson,
  };
  if (args.syncPaperclip) {
    result.paperclip = await syncPaperclip(api, report, written.latestMd);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
