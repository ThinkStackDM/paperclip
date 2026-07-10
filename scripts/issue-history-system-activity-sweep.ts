import { and, asc, eq, isNull } from "../server/node_modules/drizzle-orm/index.js";
import {
  companies,
  createDb,
  issueComments,
  issues,
} from "../packages/db/src/index.js";
import {
  buildIssueCommentSystemActivityPresentation,
  classifyIssueCommentSystemActivity,
} from "../packages/shared/src/index.js";
import { loadConfig } from "../server/src/config.js";

function parseFlag(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

type IssueSummary = {
  companyId: string;
  identifier: string | null;
  title: string;
  totalComments: number;
  matchedComments: number;
  matchedClusters: number;
  previousMatched: boolean;
};

async function main() {
  const config = loadConfig();
  const dbUrl =
    process.env.DATABASE_URL?.trim()
    || config.databaseUrl
    || `postgres://paperclip:paperclip@127.0.0.1:${config.embeddedPostgresPort}/paperclip`;

  const db = createDb(dbUrl);
  const companyId = parseFlag("--company");
  const apply = hasFlag("--apply");
  const sampleLimit = Number.parseInt(parseFlag("--sample-limit") ?? "20", 10);
  const samples: Array<{
    commentId: string;
    companyId: string;
    issueId: string;
    identifier: string | null;
    title: string;
    classification: string;
    preview: string;
  }> = [];

  const companyRows = companyId
    ? [{ id: companyId }]
    : await db.select({ id: companies.id }).from(companies);

  if (companyRows.length === 0) {
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", companies: 0, matchedComments: 0 }, null, 2));
    return;
  }

  const issueSummaries = new Map<string, IssueSummary>();
  const candidates: Array<{
    id: string;
    presentation: ReturnType<typeof buildIssueCommentSystemActivityPresentation>;
  }> = [];

  for (const company of companyRows) {
    const rows = await db
      .select({
        commentId: issueComments.id,
        companyId: issueComments.companyId,
        issueId: issueComments.issueId,
        body: issueComments.body,
        authorType: issueComments.authorType,
        authorAgentId: issueComments.authorAgentId,
        authorUserId: issueComments.authorUserId,
        presentation: issueComments.presentation,
        issueIdentifier: issues.identifier,
        issueTitle: issues.title,
      })
      .from(issueComments)
      .innerJoin(issues, eq(issues.id, issueComments.issueId))
      .where(and(eq(issueComments.companyId, company.id), isNull(issueComments.deletedAt)))
      .orderBy(
        asc(issueComments.issueId),
        asc(issueComments.createdAt),
        asc(issueComments.id),
      );

    for (const row of rows) {
      const summary = issueSummaries.get(row.issueId) ?? {
        companyId: row.companyId,
        identifier: row.issueIdentifier ?? null,
        title: row.issueTitle,
        totalComments: 0,
        matchedComments: 0,
        matchedClusters: 0,
        previousMatched: false,
      };
      summary.totalComments += 1;

      const classification = classifyIssueCommentSystemActivity({
        body: row.body,
        authorType: row.authorType,
        authorAgentId: row.authorAgentId,
        authorUserId: row.authorUserId,
        presentation: row.presentation,
      });

      if (classification) {
        summary.matchedComments += 1;
        if (!summary.previousMatched) {
          summary.matchedClusters += 1;
        }
        summary.previousMatched = true;
        candidates.push({
          id: row.commentId,
          presentation: buildIssueCommentSystemActivityPresentation(classification),
        });
        if (samples.length < sampleLimit) {
          samples.push({
            commentId: row.commentId,
            companyId: row.companyId,
            issueId: row.issueId,
            identifier: row.issueIdentifier ?? null,
            title: row.issueTitle,
            classification: classification.kind,
            preview: row.body.slice(0, 240),
          });
        }
      } else {
        summary.previousMatched = false;
      }

      issueSummaries.set(row.issueId, summary);
    }
  }

  let appliedCount = 0;
  if (apply) {
    for (const candidate of candidates) {
      await db
        .update(issueComments)
        .set({
          presentation: candidate.presentation,
          updatedAt: new Date(),
        })
        .where(eq(issueComments.id, candidate.id));
      appliedCount += 1;
    }
  }

  const issueStats = [...issueSummaries.values()].map((summary) => ({
    companyId: summary.companyId,
    identifier: summary.identifier,
    title: summary.title,
    totalComments: summary.totalComments,
    visibleRowsBefore: summary.totalComments,
    visibleRowsAfter: summary.totalComments - summary.matchedComments + summary.matchedClusters,
    collapsedComments: summary.matchedComments,
    collapsedBands: summary.matchedClusters,
  }));

  const report = {
    mode: apply ? "apply" : "dry-run",
    companies: companyRows.length,
    issuesScanned: issueStats.length,
    matchedComments: candidates.length,
    appliedComments: appliedCount,
    medianVisibleRowsBefore: median(issueStats.map((stat) => stat.visibleRowsBefore)),
    medianVisibleRowsAfter: median(issueStats.map((stat) => stat.visibleRowsAfter)),
    samples,
    topIssuesByReduction: issueStats
      .map((stat) => ({
        ...stat,
        visibleRowReduction: stat.visibleRowsBefore - stat.visibleRowsAfter,
      }))
      .filter((stat) => stat.visibleRowReduction > 0)
      .sort((a, b) => b.visibleRowReduction - a.visibleRowReduction)
      .slice(0, sampleLimit),
  };

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Issue history system-activity sweep failed: ${message}`);
  process.exitCode = 1;
});
