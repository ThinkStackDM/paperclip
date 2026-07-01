#!/usr/bin/env node
/**
 * Waiting-state integrity reaper.
 *
 * Read-only by default: scans open Paperclip issues across all companies and
 * reports stranded waiting-state candidates. Use --sync-paperclip to
 * create/update one TSMC rollup issue.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";
const DEFAULT_OUT_DIR =
  process.env.WAITING_STATE_OUT_DIR || "/Users/glad0s/TSKB/Operator/Waiting State Integrity";
const TSMC_COMPANY_ID = "e6361895-a6a4-438d-bb76-b17a0ad026cb";
const ROLLUP_ASSIGNEE_USER_ID = "local-board";
const OPEN_STATUSES = ["todo", "in_progress", "in_review", "blocked"];
const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const PAGE_LIMIT = 1000;

const LEGACY_ALIAS_RULES = [
  { alias: "kiss", canonical: "TSK" },
  { alias: "tsd", canonical: "DP" },
  { alias: "thiaaa-yt", canonical: "TSM" },
  { alias: "thiaaa-pod", canonical: "DP" },
  { alias: "thiaa-recruitment", canonical: "TSR" },
  { alias: "thiaaaaaa", canonical: "TSMC" },
];

function parseArgs(argv) {
  const args = {
    api: DEFAULT_API,
    outDir: DEFAULT_OUT_DIR,
    syncPaperclip: false,
    maxIssueBodyItems: 40,
    staleTodoDays: 3,
    staleReviewDays: 2,
    staleInProgressHours: 6,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api") args.api = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--sync-paperclip") args.syncPaperclip = true;
    else if (arg === "--max-issue-body-items") args.maxIssueBodyItems = Number(argv[++i]);
    else if (arg === "--stale-todo-days") args.staleTodoDays = Number(argv[++i]);
    else if (arg === "--stale-review-days") args.staleReviewDays = Number(argv[++i]);
    else if (arg === "--stale-in-progress-hours") args.staleInProgressHours = Number(argv[++i]);
    else if (arg === "--help") {
      console.log("Usage: waiting-state-integrity-reaper.mjs [--out-dir PATH] [--sync-paperclip]");
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
  if (Array.isArray(data?.issues)) return data.issues;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.companies)) return data.companies;
  return [];
}

async function listAllIssues(api, companyId, params) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const search = new URLSearchParams({
      ...params,
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });
    const page = asArray(await request(api, "GET", `/api/companies/${companyId}/issues?${search}`));
    rows.push(...page);
    if (page.length < PAGE_LIMIT) break;
  }
  return rows;
}

function companyPrefix(company) {
  return company.issuePrefix || company.prefix || company.shortName || company.name;
}

function issueText(issue) {
  return `${issue.title || ""}\n${issue.description || ""}`.trim();
}

function issueLink(item) {
  return `/${item.prefix}/issues/${item.identifier}`;
}

function ageDays(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function ageHours(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 3_600_000));
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\b[a-z]{2,}-\d+\b/gi, "<ticket>")
    .replace(/\bpr #?\d+\b/gi, "pr <n>")
    .replace(/\b\d{4}-\d{2}-\d{2}(?:t[\d:.z+-]+)?\b/gi, "<date>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

function hasExternalOwnerAction(issue) {
  const text = issue.description || "";
  return /^\s*external owner\s*:\s*\S.+$/im.test(text) && /^\s*external action\s*:\s*\S.+$/im.test(text);
}

function ownerLabel(issue) {
  if (issue.assigneeAgentId) return `agent:${issue.assigneeAgentId.slice(0, 8)}`;
  if (issue.assigneeUserId) return `user:${issue.assigneeUserId}`;
  return "none";
}

function baseIssue(issue, company) {
  const prefix = companyPrefix(company);
  return {
    id: issue.id,
    identifier: issue.identifier,
    prefix,
    companyId: company.id,
    companyName: company.name,
    title: issue.title || "",
    status: issue.status,
    priority: issue.priority || "",
    ownerLabel: ownerLabel(issue),
    assigneeAgentId: issue.assigneeAgentId || null,
    assigneeUserId: issue.assigneeUserId || null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    staleDays: ageDays(issue.updatedAt),
    staleHours: ageHours(issue.updatedAt),
  };
}

function severityScore(severity) {
  if (severity === "critical") return 100;
  if (severity === "high") return 80;
  if (severity === "medium") return 55;
  return 30;
}

function addFinding(findings, issue, company, type, severity, summary, details = {}) {
  const item = {
    ...baseIssue(issue, company),
    type,
    severity,
    summary,
    score: severityScore(severity) + Math.min(ageDays(issue.updatedAt) || 0, 21),
    ...details,
  };
  findings.push(item);
}

function detectLegacyAliases(issue) {
  const text = issueText(issue).toLowerCase();
  return LEGACY_ALIAS_RULES.filter((rule) => {
    const escaped = rule.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9-])${escaped}([^a-z0-9-]|$)`, "i").test(text);
  });
}

function classifyIssue(issue, company, args, findings) {
  if (/^(waiting-state integrity|human action queue|incident rollup broker|routine quiet mode)\b/i.test(issue.title || "")) return;

  const blockedBy = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
  if (issue.status === "blocked") {
    if (blockedBy.length === 0 && !hasExternalOwnerAction(issue)) {
      addFinding(
        findings,
        issue,
        company,
        "blocked_no_first_class_blocker",
        "high",
        "Blocked but has no first-class blocker or external-owner action.",
        { blockedBy: [] },
      );
    }
    const terminal = blockedBy.filter((blocker) => TERMINAL_STATUSES.has(blocker.status));
    if (terminal.length > 0) {
      addFinding(
        findings,
        issue,
        company,
        terminal.length === blockedBy.length ? "blocked_only_terminal_blockers" : "blocked_has_terminal_blockers",
        terminal.length === blockedBy.length ? "high" : "medium",
        terminal.length === blockedBy.length
          ? "Blocked only by terminal blockers."
          : "Blocked by at least one terminal blocker that may need clearing.",
        { blockedBy, terminalBlockers: terminal },
      );
    }
  }

  const noOwner = !issue.assigneeAgentId && !issue.assigneeUserId;
  if (issue.status === "in_review") {
    const hasKnownWaitPath =
      issue.boardActionRequired ||
      issue.activeRun ||
      issue.activeRecoveryAction ||
      issue.successfulRunHandoff ||
      issue.monitorNextCheckAt ||
      issue.assigneeAgentId ||
      issue.assigneeUserId;
    if (noOwner && !hasKnownWaitPath) {
      addFinding(
        findings,
        issue,
        company,
        "in_review_no_owner_or_visible_wait_path",
        "high",
        "In review with no owner and no visible waiting path in the list projection.",
      );
    } else if ((ageDays(issue.updatedAt) || 0) >= args.staleReviewDays && !issue.activeRun) {
      addFinding(
        findings,
        issue,
        company,
        "stale_in_review",
        "medium",
        `In review has been idle for ${ageDays(issue.updatedAt)} day(s).`,
      );
    }
  }

  if (issue.status === "in_progress" && !issue.activeRun && (ageHours(issue.updatedAt) || 0) >= args.staleInProgressHours) {
    addFinding(
      findings,
      issue,
      company,
      "in_progress_no_active_run",
      "high",
      `In progress has no active run and has been idle for ${ageHours(issue.updatedAt)} hour(s).`,
    );
  }

  if (issue.status === "todo" && (ageDays(issue.updatedAt) || 0) >= args.staleTodoDays) {
    addFinding(
      findings,
      issue,
      company,
      "stale_todo",
      issue.priority === "critical" || issue.priority === "high" ? "high" : "medium",
      `Todo has been idle for ${ageDays(issue.updatedAt)} day(s).`,
    );
  }

  const aliases = detectLegacyAliases(issue);
  if (aliases.length > 0) {
    addFinding(
      findings,
      issue,
      company,
      "legacy_classifier_alias",
      "low",
      `Legacy shorthand detected: ${aliases.map((a) => `${a.alias} -> ${a.canonical}`).join(", ")}.`,
      { aliases },
    );
  }
}

function duplicateFindings(allIssues, companiesById) {
  const groups = new Map();
  for (const issue of allIssues) {
    if (/^(waiting-state integrity|human action queue|incident rollup broker|routine quiet mode)\b/i.test(issue.title || "")) continue;
    const key = normalizeTitle(issue.title);
    if (!key || key.length < 12) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(issue);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedTitle, group]) => ({
      type: "duplicate_open_title",
      severity: "medium",
      normalizedTitle,
      count: group.length,
      score: 55 + Math.min(group.length, 20),
      items: group
        .map((issue) => ({
          ...baseIssue(issue, companiesById.get(issue.companyId)),
          status: issue.status,
        }))
        .sort((a, b) => a.identifier.localeCompare(b.identifier)),
    }))
    .sort((a, b) => b.count - a.count || a.normalizedTitle.localeCompare(b.normalizedTitle));
}

function countsBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function collect(api, args) {
  const companies = asArray(await request(api, "GET", "/api/companies"));
  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const allIssues = [];
  const findings = [];

  for (const company of companies) {
    const issues = await listAllIssues(api, company.id, {
      status: OPEN_STATUSES.join(","),
      includeBlockedBy: "true",
      includeBlockedInboxAttention: "true",
      includeRoutineExecutions: "true",
      sortField: "updated",
      sortDir: "desc",
    });
    allIssues.push(...issues);
    for (const issue of issues) {
      classifyIssue(issue, company, args, findings);
    }
  }

  findings.sort((a, b) => b.score - a.score || a.identifier.localeCompare(b.identifier));
  const duplicates = duplicateFindings(allIssues, companiesById);
  const summary = {
    openIssuesScanned: allIssues.length,
    findings: findings.length,
    duplicateGroups: duplicates.length,
    byType: countsBy(findings, (item) => item.type),
    bySeverity: countsBy(findings, (item) => item.severity),
    byCompany: countsBy(findings, (item) => item.prefix),
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "paperclip-api",
    openStatuses: OPEN_STATUSES,
    summary,
    findings,
    duplicateGroups: duplicates,
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

function findingTable(rows) {
  return markdownTable(rows, [
    { label: "Score", value: (i) => i.score },
    { label: "Issue", value: (i) => `[${i.identifier}](${issueLink(i)})` },
    { label: "Co", value: (i) => i.prefix },
    { label: "State", value: (i) => i.status },
    { label: "Type", value: (i) => i.type },
    { label: "Owner", value: (i) => i.ownerLabel },
    { label: "Summary", value: (i) => i.summary },
  ]);
}

function buildMarkdown(report, maxIssueBodyItems) {
  const top = report.findings.slice(0, maxIssueBodyItems);
  return [
    "# Waiting-State Integrity",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This is a read-only invariant scan for stranded waiting states. It does not change source issue state.",
    "",
    "## Summary",
    "",
    `- Open issues scanned: **${report.summary.openIssuesScanned}**`,
    `- Findings: **${report.summary.findings}**`,
    `- Duplicate open-title groups: **${report.summary.duplicateGroups}**`,
    "",
    "### By Type",
    "",
    markdownTable(report.summary.byType, [
      { label: "Type", value: (r) => r.key },
      { label: "Count", value: (r) => r.count },
    ]),
    "",
    "### By Severity",
    "",
    markdownTable(report.summary.bySeverity, [
      { label: "Severity", value: (r) => r.key },
      { label: "Count", value: (r) => r.count },
    ]),
    "",
    "### By Company",
    "",
    markdownTable(report.summary.byCompany, [
      { label: "Company", value: (r) => r.key },
      { label: "Count", value: (r) => r.count },
    ]),
    "",
    "## Highest Priority Findings",
    "",
    findingTable(top),
    "",
    "## Duplicate Open-Title Groups",
    "",
    report.duplicateGroups.length
      ? report.duplicateGroups.slice(0, 20).map((group) => {
          const links = group.items
            .map((i) => `[${i.identifier}](${issueLink(i)}) ${i.status}`)
            .join(", ");
          return `- **${group.normalizedTitle}** (${group.count}): ${links}`;
        }).join("\n")
      : "_None._",
    "",
    "## Safe Operating Rule",
    "",
    "Treat this as a triage lens. Source issues should only be changed after opening the linked case and confirming its thread state.",
    "",
  ].join("\n");
}

async function writeReport(report, outDir, maxIssueBodyItems) {
  await mkdir(outDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `waiting-state-integrity-${stamp}.json`);
  const mdPath = path.join(outDir, `waiting-state-integrity-${stamp}.md`);
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
    `/api/companies/${TSMC_COMPANY_ID}/issues?q=${encodeURIComponent("Waiting-State Integrity")}&limit=20`,
  );
  const matches = asArray(data).filter((issue) => /waiting-state integrity/i.test(issue.title || ""));
  const active = matches.find((issue) => !["done", "cancelled"].includes(issue.status));
  return active || matches[0] || null;
}

function issueBody(report, latestMdPath) {
  return [
    "## Waiting-State Integrity",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This is the single portfolio rollup for stranded waiting-state candidates. Source issues are not changed by this rollup.",
    "",
    `- Open issues scanned: **${report.summary.openIssuesScanned}**`,
    `- Findings: **${report.summary.findings}**`,
    `- Duplicate groups: **${report.summary.duplicateGroups}**`,
    `- Full local report: \`${latestMdPath}\``,
    "",
    "### Top Findings",
    "",
    findingTable(report.findings.slice(0, 25)),
    "",
    "### Next Use",
    "",
    "Work the top findings from linked source issues. Keep this card as the compact health view and avoid making state changes from the rollup alone.",
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
    title: "Waiting-State Integrity — portfolio hygiene rollup",
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
    openIssuesScanned: report.summary.openIssuesScanned,
    findings: report.summary.findings,
    duplicateGroups: report.summary.duplicateGroups,
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
