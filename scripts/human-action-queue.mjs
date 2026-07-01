#!/usr/bin/env node
/**
 * Human Action Queue generator.
 *
 * Read-only by default: scans open Paperclip issues across all companies,
 * classifies likely human-only/external actions, and writes a markdown + JSON
 * rollup. Use --sync-paperclip to create/update one TSMC rollup issue.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";
const DEFAULT_OUT_DIR =
  process.env.HAQ_OUT_DIR || "/Users/glad0s/TSKB/Operator/Human Action Queue";
const TSMC_COMPANY_ID = "e6361895-a6a4-438d-bb76-b17a0ad026cb";
const ROLLUP_ASSIGNEE_USER_ID = "local-board";
const OPEN_STATUSES = ["todo", "in_progress", "in_review", "blocked"];

const CATEGORY_RULES = [
  {
    id: "credentials_secrets",
    label: "Credentials / Secrets",
    priority: 100,
    regex:
      /\b(secret|secrets|credential|credentials|api key|token|bearer|password|env var|environment variable|vercel env|cf web analytics|measurement id)\b/i,
  },
  {
    id: "oauth_session",
    label: "OAuth / Session",
    priority: 95,
    regex:
      /\b(oauth|reauth|re-auth|authenticate|authentication|login|session cookie|cookie|consent screen|google auth)\b/i,
  },
  {
    id: "account_vendor",
    label: "Account / Vendor",
    priority: 90,
    regex:
      /\b(reactivate|account|vendor|nordpass|canva|etsy|printify|mailerlite|pinterest|substack|postiz|linkedin page|terms of service|verify email|kyc)\b/i,
  },
  {
    id: "github_review_merge",
    label: "GitHub / PR",
    priority: 85,
    regex:
      /\b(github|pull request|merge pr|pr #|review action|devinfoley|upstream merge)\b/i,
  },
  {
    id: "spend_approval",
    label: "Spend / Approval",
    priority: 80,
    regex:
      /\b(spend|purchase|paid tier|approve|approval|affiliate program|professional services)\b/i,
  },
  {
    id: "publishing_gate",
    label: "Publish Gate",
    priority: 70,
    regex:
      /\b(board publish|publish .*youtube|publish .*etsy|youtube.*publish|etsy.*publish|launch gate|go-live)\b/i,
  },
  {
    id: "human_operator",
    label: "Human / Operator",
    priority: 98,
    regex:
      /\b(human|operator|board action required|action required|board-gated|manual session|manual submission|external unblock)\b/i,
  },
];

const EXCLUDE_RULES = [
  /\b(binding[- ]probe|liveness probe|heartbeat|watchdog|fallback-monitor|fallback-swap-back)\b/i,
  /\back-sweep\b/i,
];

function parseArgs(argv) {
  const args = {
    api: DEFAULT_API,
    outDir: DEFAULT_OUT_DIR,
    syncPaperclip: false,
    maxIssueBodyItems: 35,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api") args.api = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--sync-paperclip") args.syncPaperclip = true;
    else if (arg === "--max-issue-body-items") args.maxIssueBodyItems = Number(argv[++i]);
    else if (arg === "--help") {
      console.log(`Usage: human-action-queue.mjs [--out-dir PATH] [--sync-paperclip]`);
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

function issueText(issue) {
  return `${issue.title || ""}\n${issue.description || ""}`.trim();
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

function ageDays(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function classify(issue) {
  const text = issueText(issue);
  if (!text) return null;
  if (/^human action queue\b/i.test(issue.title || "")) return null;
  if (EXCLUDE_RULES.some((rule) => rule.test(text))) return null;

  const matches = CATEGORY_RULES.filter((rule) => rule.regex.test(text));
  if (!matches.length) return null;

  matches.sort((a, b) => b.priority - a.priority);
  const noOwner = !issue.assigneeAgentId && !issue.assigneeUserId;
  const statusBoost = issue.status === "blocked" ? 20 : issue.status === "in_review" ? 12 : 0;
  const noOwnerBoost = noOwner ? 18 : 0;
  const staleBoost = Math.min(ageDays(issue.updatedAt) || 0, 21);

  return {
    category: matches[0].id,
    categoryLabel: matches[0].label,
    reasonTags: matches.map((m) => m.id),
    queueScore: matches[0].priority + statusBoost + noOwnerBoost + staleBoost,
    noOwner,
    ageDays: ageDays(issue.createdAt),
    staleDays: ageDays(issue.updatedAt),
  };
}

function companyPrefix(company) {
  return company.issuePrefix || company.prefix || company.shortName || company.name;
}

function issueLink(item) {
  return `/${item.prefix}/issues/${item.identifier}`;
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

function buildMarkdown(report, maxIssueBodyItems) {
  const top = report.items.slice(0, maxIssueBodyItems);
  const noOwner = report.items.filter((item) => item.noOwner).slice(0, 20);
  const blocked = report.items.filter((item) => item.status === "blocked").slice(0, 20);
  const duplicateGroups = report.duplicateGroups.slice(0, 12);
  const cols = [
    { label: "Score", value: (i) => i.queueScore },
    { label: "Issue", value: (i) => `[${i.identifier}](${issueLink(i)})` },
    { label: "Co", value: (i) => i.prefix },
    { label: "State", value: (i) => i.status },
    { label: "Category", value: (i) => i.categoryLabel },
    { label: "Owner", value: (i) => i.ownerLabel },
    { label: "Title", value: (i) => i.title },
  ];
  return [
    "# Human Action Queue",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This queue is a read-only rollup of likely human-only or external-account actions across Paperclip. It does not change source issue state.",
    "",
    "## Summary",
    "",
    `- Items: **${report.items.length}**`,
    `- No-owner items: **${report.summary.noOwner}**`,
    `- Blocked items: **${report.summary.blocked}**`,
    `- In review items: **${report.summary.inReview}**`,
    `- Possible duplicate groups: **${report.duplicateGroups.length}**`,
    "",
    "### By Category",
    "",
    markdownTable(report.summary.byCategory, [
      { label: "Category", value: (r) => r.category },
      { label: "Count", value: (r) => r.count },
    ]),
    "",
    "### By Company",
    "",
    markdownTable(report.summary.byCompany, [
      { label: "Company", value: (r) => r.company },
      { label: "Count", value: (r) => r.count },
    ]),
    "",
    "## Highest Priority",
    "",
    markdownTable(top, cols),
    "",
    "## No Owner",
    "",
    markdownTable(noOwner, cols),
    "",
    "## Blocked",
    "",
    markdownTable(blocked, cols),
    "",
    "## Possible Duplicate Groups",
    "",
    duplicateGroups.length
      ? duplicateGroups
          .map((group) => {
            const links = group.items
              .map((i) => `[${i.identifier}](${issueLink(i)}) ${i.status}`)
              .join(", ");
            return `- **${group.normalizedTitle}** (${group.items.length}): ${links}`;
          })
          .join("\n")
      : "_None._",
    "",
    "## Safe Operating Rule",
    "",
    "Use this queue to focus operator attention only. Do not close or reassign source issues from this report without checking the underlying issue thread.",
    "",
  ].join("\n");
}

function countsBy(items, fn) {
  const counts = new Map();
  for (const item of items) {
    const key = fn(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ [fn.name || "key"]: key, key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function summarize(items) {
  const byCategory = countsBy(items, (item) => item.categoryLabel).map((r) => ({
    category: r.key,
    count: r.count,
  }));
  const byCompany = countsBy(items, (item) => item.prefix).map((r) => ({
    company: r.key,
    count: r.count,
  }));
  return {
    byCategory,
    byCompany,
    noOwner: items.filter((i) => i.noOwner).length,
    blocked: items.filter((i) => i.status === "blocked").length,
    inReview: items.filter((i) => i.status === "in_review").length,
  };
}

function duplicateGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedTitle, group]) => ({
      normalizedTitle,
      items: group
        .slice()
        .sort((a, b) => b.queueScore - a.queueScore || a.identifier.localeCompare(b.identifier)),
    }))
    .sort((a, b) => b.items.length - a.items.length || b.items[0].queueScore - a.items[0].queueScore);
}

async function collect(api) {
  const companies = asArray(await request(api, "GET", "/api/companies"));
  const issues = [];
  for (const company of companies) {
    const prefix = companyPrefix(company);
    for (const status of OPEN_STATUSES) {
      const data = await request(
        api,
        "GET",
        `/api/companies/${company.id}/issues?status=${encodeURIComponent(status)}&limit=1000`,
      );
      for (const issue of asArray(data)) {
        const classification = classify(issue);
        if (!classification) continue;
        issues.push({
          id: issue.id,
          identifier: issue.identifier,
          prefix,
          companyId: company.id,
          companyName: company.name,
          title: issue.title || "",
          status: issue.status,
          priority: issue.priority || "",
          assigneeAgentId: issue.assigneeAgentId || null,
          assigneeUserId: issue.assigneeUserId || null,
          ownerLabel: issue.assigneeAgentId
            ? `agent:${issue.assigneeAgentId.slice(0, 8)}`
            : issue.assigneeUserId
              ? "user"
              : "none",
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          ...classification,
        });
      }
    }
  }
  issues.sort((a, b) => b.queueScore - a.queueScore || a.prefix.localeCompare(b.prefix));
  return {
    generatedAt: new Date().toISOString(),
    source: "paperclip-api",
    openStatuses: OPEN_STATUSES,
    items: issues,
    summary: summarize(issues),
    duplicateGroups: duplicateGroups(issues),
  };
}

async function writeReport(report, outDir, maxIssueBodyItems) {
  await mkdir(outDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `human-action-queue-${stamp}.json`);
  const mdPath = path.join(outDir, `human-action-queue-${stamp}.md`);
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
    `/api/companies/${TSMC_COMPANY_ID}/issues?q=${encodeURIComponent("Human Action Queue")}&status=todo,in_progress,in_review,blocked&limit=20`,
  );
  return asArray(data).find((issue) => /human action queue/i.test(issue.title || "")) || null;
}

function issueBody(report, latestMdPath) {
  const top = report.items.slice(0, 20);
  return [
    "## Human Action Queue",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This is the single portfolio rollup for human-only/external-account actions. Source issues are not changed by this queue.",
    "",
    `- Items: **${report.items.length}**`,
    `- No-owner: **${report.summary.noOwner}**`,
    `- Blocked: **${report.summary.blocked}**`,
    `- In review: **${report.summary.inReview}**`,
    `- Full local report: \`${latestMdPath}\``,
    "",
    "### Highest Priority",
    "",
    markdownTable(top, [
      { label: "Score", value: (i) => i.queueScore },
      { label: "Issue", value: (i) => `[${i.identifier}](${issueLink(i)})` },
      { label: "Co", value: (i) => i.prefix },
      { label: "State", value: (i) => i.status },
      { label: "Category", value: (i) => i.categoryLabel },
      { label: "Owner", value: (i) => i.ownerLabel },
      { label: "Title", value: (i) => i.title },
    ]),
    "",
    "### Next Use",
    "",
    "Work this card top-down when operator time is available. Use the linked source issues for action and audit; keep this rollup as the focused view.",
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
    title: "Human Action Queue — portfolio operator rollup",
    description: body,
    status: "todo",
    priority: "high",
    assigneeUserId: ROLLUP_ASSIGNEE_USER_ID,
  });
  return { action: "created", issue: created };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await collect(args.api.replace(/\/$/, ""));
  const written = await writeReport(report, args.outDir, args.maxIssueBodyItems);
  const result = {
    generatedAt: report.generatedAt,
    itemCount: report.items.length,
    noOwner: report.summary.noOwner,
    blocked: report.summary.blocked,
    inReview: report.summary.inReview,
    duplicateGroups: report.duplicateGroups.length,
    latestMd: written.latestMd,
    latestJson: written.latestJson,
  };
  if (args.syncPaperclip) {
    result.paperclip = await syncPaperclip(args.api.replace(/\/$/, ""), report, written.latestMd);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
