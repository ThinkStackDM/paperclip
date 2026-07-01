#!/usr/bin/env node
/**
 * Incident rollup broker.
 *
 * Read-only by default: samples recent noisy Paperclip recovery/watchdog issues
 * across all companies, groups them into stable incident fingerprints, and
 * writes a markdown + JSON rollup. Use --sync-paperclip to create/update one
 * TSMC rollup issue.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";
const DEFAULT_OUT_DIR =
  process.env.INCIDENT_ROLLUP_OUT_DIR || "/Users/glad0s/TSKB/Operator/Incident Rollups";
const TSMC_COMPANY_ID = "e6361895-a6a4-438d-bb76-b17a0ad026cb";
const ROLLUP_ASSIGNEE_USER_ID = "local-board";
const ALL_STATUSES = ["todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const OPEN_STATUSES = new Set(["todo", "in_progress", "in_review", "blocked"]);
const PAGE_LIMIT = 1000;

const QUERY_PATTERNS = [
  "fallback-monitor",
  "fallback-swap-back",
  "Unblock liveness incident",
  "Swap/jetsam watchdog",
  "Review productivity for",
  "ack-sweep",
  "binding-probe",
  "halt-trigger",
  "halt monitor",
  "recovery",
  "OAuth",
  "auth invalid",
  "missing disposition",
];

function parseArgs(argv) {
  const args = {
    api: DEFAULT_API,
    outDir: DEFAULT_OUT_DIR,
    syncPaperclip: false,
    windowDays: 7,
    maxIssueBodyItems: 30,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api") args.api = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--sync-paperclip") args.syncPaperclip = true;
    else if (arg === "--window-days") args.windowDays = Number(argv[++i]);
    else if (arg === "--max-issue-body-items") args.maxIssueBodyItems = Number(argv[++i]);
    else if (arg === "--help") {
      console.log("Usage: incident-rollup-broker.mjs [--window-days 7] [--out-dir PATH] [--sync-paperclip]");
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

function issueLink(item) {
  return `/${item.prefix}/issues/${item.identifier}`;
}

function issueText(issue) {
  return `${issue.title || ""}\n${issue.description || ""}`.trim();
}

function parseTicket(text) {
  const match = String(text || "").match(/\b([A-Z]{2,10}-\d+)\b/);
  return match?.[1] ?? null;
}

function readIncidentKey(text) {
  const match = String(text || "").match(/Incident key:\s*`?([^`\n]+)`?/i);
  return match?.[1]?.trim() || null;
}

function classifyIncident(issue, prefix) {
  const title = issue.title || "";
  const text = issueText(issue);
  const lower = text.toLowerCase();
  const sourceTicket = parseTicket(text);
  const incidentKey = readIncidentKey(text);

  if (/^(incident rollup broker|waiting-state integrity|human action queue|routine quiet mode)\b/i.test(title)) {
    return null;
  }

  if (/\bfallback-monitor\b/i.test(title)) {
    return {
      family: "fallback-monitor",
      fingerprint: `${prefix}:routine:fallback-monitor`,
      target: prefix,
      reason: "scheduled fallback monitor fire",
    };
  }
  if (/\bfallback-swap-back\b/i.test(title)) {
    return {
      family: "fallback-swap-back",
      fingerprint: `${prefix}:routine:fallback-swap-back`,
      target: prefix,
      reason: "scheduled fallback swap-back fire",
    };
  }
  if (/unblock liveness incident/i.test(title) || /harness[_ -]liveness/i.test(lower)) {
    const target = sourceTicket || issue.identifier;
    return {
      family: "harness-liveness",
      fingerprint: incidentKey || `${prefix}:harness-liveness:${target}`,
      target,
      reason: "harness liveness recovery",
    };
  }
  if (/swap\/jetsam watchdog/i.test(title)) {
    return {
      family: "swap-jetsam-watchdog",
      fingerprint: `${prefix}:watchdog:swap-jetsam`,
      target: prefix,
      reason: "swap/jetsam watchdog fire",
    };
  }
  if (/review productivity for/i.test(title)) {
    const target = sourceTicket || issue.identifier;
    return {
      family: "productivity-review",
      fingerprint: `${prefix}:productivity-review:${target}`,
      target,
      reason: "productivity review recovery",
    };
  }
  if (/\back-sweep\b/i.test(title) || /\back[- ]?reconcile\b/i.test(title)) {
    return {
      family: "ack-sweep",
      fingerprint: `${prefix}:comms:ack-sweep`,
      target: prefix,
      reason: "ack reconciliation/sweep",
    };
  }
  if (/\bbinding[- ]probe\b/i.test(title)) {
    return {
      family: "binding-probe",
      fingerprint: `${prefix}:comms:binding-probe`,
      target: prefix,
      reason: "intercompany binding probe",
    };
  }
  if (/\bhalt[- ]trigger\b/i.test(lower) || /\bhalt monitor\b/i.test(lower)) {
    return {
      family: "halt-monitor",
      fingerprint: `${prefix}:risk:halt-monitor`,
      target: prefix,
      reason: "halt/risk monitor fire",
    };
  }
  if (/\bmissing disposition\b/i.test(lower)) {
    return {
      family: "missing-disposition",
      fingerprint: `${prefix}:recovery:missing-disposition:${sourceTicket || issue.identifier}`,
      target: sourceTicket || issue.identifier,
      reason: "missing disposition recovery",
    };
  }
  if (/\b(oauth|auth invalid|reauth|session cookie|token expired)\b/i.test(lower)) {
    return {
      family: "auth-session",
      fingerprint: `${prefix}:auth-session:${sourceTicket || "external-account"}`,
      target: sourceTicket || prefix,
      reason: "auth/session recovery",
    };
  }
  if (/\brecovery\b/i.test(lower) && /\b(blocked|stranded|stale|liveness|resume)\b/i.test(lower)) {
    return {
      family: "general-recovery",
      fingerprint: `${prefix}:recovery:${sourceTicket || issue.identifier}`,
      target: sourceTicket || issue.identifier,
      reason: "general recovery card",
    };
  }
  return null;
}

function toIssueSummary(issue, company, classification) {
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
    originKind: issue.originKind || null,
    originId: issue.originId || null,
    originFingerprint: issue.originFingerprint || null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    ...classification,
  };
}

function newestDate(values) {
  const timestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function oldestDate(values) {
  const timestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps)).toISOString();
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

function groupIncidents(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.fingerprint)) groups.set(item.fingerprint, []);
    groups.get(item.fingerprint).push(item);
  }
  return [...groups.entries()]
    .map(([fingerprint, group]) => {
      const sorted = group
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const open = sorted.filter((item) => OPEN_STATUSES.has(item.status));
      return {
        fingerprint,
        family: sorted[0].family,
        target: sorted[0].target,
        reason: sorted[0].reason,
        company: sorted[0].prefix,
        count: sorted.length,
        openCount: open.length,
        firstSeenAt: oldestDate(sorted.map((item) => item.createdAt)),
        lastSeenAt: newestDate(sorted.map((item) => item.updatedAt)),
        sampleItems: sorted.slice(0, 8),
      };
    })
    .sort((a, b) => b.count - a.count || b.openCount - a.openCount || a.fingerprint.localeCompare(b.fingerprint));
}

async function collect(api, args) {
  const companies = asArray(await request(api, "GET", "/api/companies"));
  const sinceMs = Date.now() - args.windowDays * 86_400_000;
  const issueMap = new Map();

  for (const company of companies) {
    for (const query of QUERY_PATTERNS) {
      const rows = await listAllIssues(api, company.id, {
        status: ALL_STATUSES.join(","),
        includeRoutineExecutions: "true",
        includePluginOperations: "true",
        sortField: "updated",
        sortDir: "desc",
        q: query,
      });
      for (const issue of rows) {
        const createdMs = new Date(issue.createdAt).getTime();
        const updatedMs = new Date(issue.updatedAt).getTime();
        if (
          Number.isFinite(createdMs) &&
          Number.isFinite(updatedMs) &&
          createdMs < sinceMs &&
          updatedMs < sinceMs
        ) {
          continue;
        }
        const prefix = companyPrefix(company);
        const classification = classifyIncident(issue, prefix);
        if (!classification) continue;
        issueMap.set(issue.id, toIssueSummary(issue, company, classification));
      }
    }
  }

  const items = [...issueMap.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const groups = groupIncidents(items);
  const summary = {
    windowDays: args.windowDays,
    sampledIssues: items.length,
    fingerprints: groups.length,
    openIssues: items.filter((item) => OPEN_STATUSES.has(item.status)).length,
    byFamily: countsBy(items, (item) => item.family),
    byCompany: countsBy(items, (item) => item.prefix),
  };
  return {
    generatedAt: new Date().toISOString(),
    source: "paperclip-api",
    queryPatterns: QUERY_PATTERNS,
    summary,
    groups,
    items,
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

function groupTable(groups) {
  return markdownTable(groups, [
    { label: "Count", value: (g) => g.count },
    { label: "Open", value: (g) => g.openCount },
    { label: "Company", value: (g) => g.company },
    { label: "Family", value: (g) => g.family },
    { label: "Target", value: (g) => g.target },
    { label: "Fingerprint", value: (g) => `\`${g.fingerprint}\`` },
  ]);
}

function buildMarkdown(report, maxIssueBodyItems) {
  const topGroups = report.groups.slice(0, maxIssueBodyItems);
  return [
    "# Incident Rollups",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This is a read-only rollup of repeated recovery/watchdog symptoms. It does not change source issue state.",
    "",
    "## Summary",
    "",
    `- Window: **${report.summary.windowDays} day(s)**`,
    `- Sampled matching issues: **${report.summary.sampledIssues}**`,
    `- Incident fingerprints: **${report.summary.fingerprints}**`,
    `- Open matching issues: **${report.summary.openIssues}**`,
    "",
    "### By Family",
    "",
    markdownTable(report.summary.byFamily, [
      { label: "Family", value: (r) => r.key },
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
    "## Top Incident Fingerprints",
    "",
    groupTable(topGroups),
    "",
    "## Sample Links",
    "",
    topGroups.length
      ? topGroups.map((group) => {
          const links = group.sampleItems
            .map((item) => `[${item.identifier}](${issueLink(item)}) ${item.status}`)
            .join(", ");
          return `- **${group.family} / ${group.target}** (${group.count}, open ${group.openCount}): ${links}`;
        }).join("\n")
      : "_None._",
    "",
    "## Safe Operating Rule",
    "",
    "Use this report to decide where a canonical incident should replace repeated symptom cards. Do not cancel or relink source issues from this rollup without checking the underlying threads.",
    "",
  ].join("\n");
}

async function writeReport(report, outDir, maxIssueBodyItems) {
  await mkdir(outDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `incident-rollups-${stamp}.json`);
  const mdPath = path.join(outDir, `incident-rollups-${stamp}.md`);
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
    `/api/companies/${TSMC_COMPANY_ID}/issues?q=${encodeURIComponent("Incident Rollup Broker")}&limit=20`,
  );
  const matches = asArray(data).filter((issue) => /incident rollup broker/i.test(issue.title || ""));
  const active = matches.find((issue) => !["done", "cancelled"].includes(issue.status));
  return active || matches[0] || null;
}

function issueBody(report, latestMdPath) {
  return [
    "## Incident Rollup Broker",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This is the single portfolio rollup for repeated recovery/watchdog symptoms. Source issues are not changed by this broker pass.",
    "",
    `- Window: **${report.summary.windowDays} day(s)**`,
    `- Sampled matching issues: **${report.summary.sampledIssues}**`,
    `- Incident fingerprints: **${report.summary.fingerprints}**`,
    `- Open matching issues: **${report.summary.openIssues}**`,
    `- Full local report: \`${latestMdPath}\``,
    "",
    "### Top Fingerprints",
    "",
    groupTable(report.groups.slice(0, 20)),
    "",
    "### Next Use",
    "",
    "Use the top fingerprints to decide which families should be converted into canonical incidents or quiet rollup behavior.",
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
    title: "Incident Rollup Broker — recovery/noise rollup",
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
    windowDays: report.summary.windowDays,
    sampledIssues: report.summary.sampledIssues,
    fingerprints: report.summary.fingerprints,
    openIssues: report.summary.openIssues,
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
