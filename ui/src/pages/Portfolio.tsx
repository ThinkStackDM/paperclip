import { useEffect, useMemo, type CSSProperties } from "react";
import { useQueries } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import type { Agent, Company, Issue } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { isCoordinationNoiseIssue } from "../lib/issue-noise";
import { getAgentFallbackLane } from "../lib/agent-lanes";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { AgentLaneBadge } from "../components/AgentLaneBadge";
import { EntityRow } from "../components/EntityRow";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { ThinkStackLogo } from "../components/ThinkStackLogo";

const PORTFOLIO_ISSUE_PAGE_SIZE = 500;
const PORTFOLIO_REFETCH_INTERVAL_MS = 30_000;
const ACTIVE_NOW_CAP = 30;

/** ThinkStack brand hue ramp — used sparingly as the page's only color accent. */
const TS_GRADIENT = "linear-gradient(90deg, #e85d4a, #f5a623, #f7d038, #5cb85c)";

/**
 * Sprint windows come from the company API (`company.activityWindow` /
 * `activeNow` / `paused`). The table below is only a name-matching fallback
 * for companies that have no window configured server-side yet.
 */
const FALLBACK_SPRINT_WINDOWS: Array<{ match: string; label: string; window: string; startHour?: number; endHour?: number; alwaysOn?: boolean }> = [
  { match: "books", label: "Books", window: "00–04", startHour: 0, endHour: 4 },
  { match: "kiss", label: "KISS", window: "04–08", startHour: 4, endHour: 8 },
  { match: "dastardly", label: "Dastardly", window: "08–12", startHour: 8, endHour: 12 },
  { match: "capital", label: "Capital", window: "12–16", startHour: 12, endHour: 16 },
  { match: "media", label: "Media", window: "16–20", startHour: 16, endHour: 20 },
  { match: "recruitment", label: "Recruitment", window: "20–00", startHour: 20, endHour: 24 },
  { match: "tsmc", label: "TSMC", window: "always-on", alwaysOn: true },
];

type SprintWindowInfo = {
  label: string;
  window: string;
  activeNow: boolean;
  paused: boolean;
  fromServer: boolean;
  /** Local "HH:00 Dublin" the window next opens, shown while the company is dormant. */
  opensAtLabel: string | null;
};

/** "HH:00" for a window start hour (e.g. 12 -> "12:00"), or null when unknown. */
function formatWindowOpensAt(startHour: number | null | undefined): string | null {
  if (startHour == null || !Number.isFinite(startHour)) return null;
  return `${String(startHour % 24).padStart(2, "0")}:00`;
}

function dublinHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-IE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Dublin" }).format(now),
  );
}

function findFallbackSprintWindow(company: Pick<Company, "name" | "issuePrefix">) {
  const haystack = `${company.name} ${company.issuePrefix}`.toLowerCase();
  return FALLBACK_SPRINT_WINDOWS.find((entry) => haystack.includes(entry.match)) ?? null;
}

function isFallbackSprintWindowActive(entry: (typeof FALLBACK_SPRINT_WINDOWS)[number], hour: number): boolean {
  if (entry.alwaysOn) return true;
  return entry.startHour != null && entry.endHour != null && hour >= entry.startHour && hour < entry.endHour;
}

function formatWindowHours(startHour: number, endHour: number): string {
  const pad = (value: number) => String(value % 24).padStart(2, "0");
  return `${pad(startHour)}–${pad(endHour)}`;
}

function resolveSprintWindow(company: Company, hour: number): SprintWindowInfo {
  const fallback = findFallbackSprintWindow(company);
  const label = fallback?.label ?? company.name;
  const paused = company.paused === true;
  if (company.activityWindow) {
    return {
      label,
      window: formatWindowHours(company.activityWindow.startHour, company.activityWindow.endHour),
      activeNow: typeof company.activeNow === "boolean"
        ? company.activeNow
        : company.activityWindowState?.open !== false,
      paused,
      fromServer: true,
      opensAtLabel: formatWindowOpensAt(company.activityWindow.startHour),
    };
  }
  if (typeof company.activeNow === "boolean") {
    // Server data, but no window configured: always-on unless paused.
    return { label, window: "always-on", activeNow: company.activeNow, paused, fromServer: true, opensAtLabel: null };
  }
  if (fallback) {
    return {
      label,
      window: fallback.window,
      activeNow: !paused && isFallbackSprintWindowActive(fallback, hour),
      paused,
      fromServer: false,
      opensAtLabel: formatWindowOpensAt(fallback.startHour),
    };
  }
  return { label, window: "always-on", activeNow: !paused, paused, fromServer: false, opensAtLabel: null };
}

function isSameLocalDay(value: Date | string, now: Date): boolean {
  const date = new Date(value);
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
}

const OPEN_STATUS_ORDER = ["in_progress", "blocked", "in_review", "todo"] as const;
const OPEN_STATUS_LABELS: Record<(typeof OPEN_STATUS_ORDER)[number], string> = {
  in_progress: "in progress",
  blocked: "blocked",
  in_review: "in review",
  todo: "todo",
};

type CompanyPortfolioData = {
  company: Company;
  issues: Issue[] | undefined;
  agents: Agent[] | undefined;
  issuesLoading: boolean;
  issuesError: boolean;
  /** Issues with coordination noise stripped out. */
  realIssues: Issue[];
  openCounts: Record<(typeof OPEN_STATUS_ORDER)[number], number>;
  needsYou: Issue[];
  active: Issue[];
  noiseHiddenToday: number;
  primaryAgentCount: number;
  laneAgentCounts: Map<string, number>;
  agentNameById: Map<string, string>;
  sprintWindow: SprintWindowInfo;
  activeNow: boolean;
};

function issuePath(company: Company, issue: Issue): string {
  return `/${company.issuePrefix}/issues/${encodeURIComponent(issue.identifier ?? issue.id)}`;
}

function SectionHeading({ title, count, subtitle }: { title: string; count?: number; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span aria-hidden className="h-4 w-1 self-center rounded-full" style={{ background: TS_GRADIENT }} />
      <h2 className="text-lg font-semibold">{title}</h2>
      {count != null && <span className="text-sm text-muted-foreground">{count}</span>}
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

// Sort order for the sprint-windows popover: TSMC (always-on) at the top,
// then chronological by window start hour (00–04 down to 20–00).
function sprintWindowSortKey(sprint: SprintWindowInfo): number {
  if (sprint.window === "always-on") return -1;
  const startHour = Number.parseInt(sprint.window, 10);
  return Number.isNaN(startHour) ? 99 : startHour;
}

// Start hour of the sprint window that is live right now (4h-aligned blocks).
// Prefer the start hour of whichever rotating company is actually active; fall back
// to the wall-clock block so the order is stable even if no company reads as active.
function activeSprintStartHour(
  rows: Array<{ sprintWindow: SprintWindowInfo; activeNow: boolean }>,
  hour: number,
): number {
  const activeRotating = rows.find(
    (r) => r.activeNow && r.sprintWindow.window !== "always-on",
  );
  if (activeRotating) {
    const start = Number.parseInt(activeRotating.sprintWindow.window, 10);
    if (!Number.isNaN(start)) return start;
  }
  return Math.floor(hour / 4) * 4;
}

// Rotation order for the "Needs you" section: the company whose sprint is live now
// is the hero (0), TSMC (always-on, co-active) sits just under it, then the remaining
// windows in the order they next open, so a finished sprint rotates to the bottom and
// the next one moves up.
function sprintRotationKey(sprint: SprintWindowInfo, activeStartHour: number): number {
  if (sprint.window === "always-on") return 0.5;
  const startHour = Number.parseInt(sprint.window, 10);
  if (Number.isNaN(startHour)) return 99;
  return (startHour - activeStartHour + 24) % 24;
}

function SprintWindowsPopover({ rows }: { rows: Array<{ companyId: string; sprint: SprintWindowInfo }> }) {
  const orderedRows = [...rows].sort((a, b) => sprintWindowSortKey(a.sprint) - sprintWindowSortKey(b.sprint));
  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground">
        <Clock className="h-3.5 w-3.5" />
        Sprint windows
      </PopoverTrigger>
      <PopoverContent align="end" className="dark w-64 border-border bg-card p-3 text-card-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sprint windows · Dublin
        </p>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {orderedRows.map(({ companyId, sprint }) => (
              <tr key={companyId} className={cn(!sprint.activeNow && "text-muted-foreground")}>
                <td className="py-1 pr-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    {sprint.label}
                    {sprint.paused ? (
                      <span className="rounded-full bg-orange-500/15 px-1.5 text-[10px] font-medium text-orange-400">paused</span>
                    ) : (
                      sprint.activeNow && <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-label="Active now" />
                    )}
                  </span>
                </td>
                <td className="py-1 text-right font-mono">{sprint.window}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PopoverContent>
    </Popover>
  );
}

function CompanyCard({ data }: { data: CompanyPortfolioData }) {
  const { company, openCounts, primaryAgentCount, laneAgentCounts, issuesLoading, issuesError, activeNow, sprintWindow } = data;
  const laneTotal = [...laneAgentCounts.values()].reduce((sum, count) => sum + count, 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Thin brand-gradient health strip; dimmed outside the company's sprint window. */}
      <div className="h-0.5" style={{ background: TS_GRADIENT, opacity: activeNow ? 1 : 0.3 }} />
      <div className="flex h-full flex-col gap-2.5 p-3">
        <div className="flex items-center gap-2">
          <Link to={`/${company.issuePrefix}/dashboard`} className="truncate text-sm font-semibold hover:underline">
            {company.name}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{company.issuePrefix}</span>
          {sprintWindow.paused ? (
            <span className="ml-auto shrink-0 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
              paused
            </span>
          ) : activeNow ? (
            <span
              className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500"
              title={`Sprint window active now (${sprintWindow.window} Dublin)`}
            />
          ) : (
            // Dormant outside its sprint window: agents aren't scheduled now (no
            // queued pile-up); pending work sits as todo issues until it reopens.
            <span
              className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title={`Outside sprint window (${sprintWindow.window} Dublin) — agents are dormant${
                sprintWindow.opensAtLabel ? `, reopens at ${sprintWindow.opensAtLabel} Dublin` : ""
              }`}
            >
              {sprintWindow.opensAtLabel ? `dormant · opens ${sprintWindow.opensAtLabel}` : "dormant"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {OPEN_STATUS_ORDER.map((status) => (
            <div key={status} className="min-w-0">
              <div
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  status === "blocked" && openCounts[status] > 0 && "text-red-400",
                )}
              >
                {issuesLoading ? "·" : issuesError ? "—" : openCounts[status]}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">{OPEN_STATUS_LABELS[status]}</div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            {primaryAgentCount} agent{primaryAgentCount === 1 ? "" : "s"}
            {laneTotal > 0 ? ` · ${laneTotal} lane${laneTotal === 1 ? "" : "s"}` : ""}
          </span>
          {[...laneAgentCounts.keys()].map((lane) => (
            <AgentLaneBadge key={lane} lane={lane} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PortfolioIssueRow({ data, issue, showCompany }: { data: CompanyPortfolioData; issue: Issue; showCompany?: boolean }) {
  const assigneeName = issue.assigneeAgentId ? data.agentNameById.get(issue.assigneeAgentId) ?? null : null;
  return (
    <EntityRow
      leading={
        <>
          <StatusIcon status={issue.status} />
          <PriorityIcon priority={issue.priority} />
        </>
      }
      identifier={issue.identifier ?? issue.id.slice(0, 8)}
      title={issue.title}
      subtitle={
        showCompany
          ? `${data.company.name}${assigneeName ? ` · ${assigneeName}` : ""}`
          : assigneeName ?? undefined
      }
      trailing={<span className="text-xs text-muted-foreground">{timeAgo(issue.updatedAt)}</span>}
      to={issuePath(data.company, issue)}
    />
  );
}

export function Portfolio() {
  const { companies, loading: companiesLoading } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Portfolio" }]);
  }, [setBreadcrumbs]);

  const visibleCompanies = useMemo(
    () => companies.filter((company) => company.status !== "archived"),
    [companies],
  );

  const issueQueries = useQueries({
    queries: visibleCompanies.map((company) => ({
      queryKey: [...queryKeys.issues.list(company.id), "portfolio", PORTFOLIO_ISSUE_PAGE_SIZE],
      queryFn: () =>
        issuesApi.list(company.id, {
          includeRoutineExecutions: true,
          limit: PORTFOLIO_ISSUE_PAGE_SIZE,
          sortField: "updated" as const,
          sortDir: "desc" as const,
        }),
      refetchInterval: PORTFOLIO_REFETCH_INTERVAL_MS,
    })),
  });

  const agentQueries = useQueries({
    queries: visibleCompanies.map((company) => ({
      queryKey: queryKeys.agents.list(company.id),
      queryFn: () => agentsApi.list(company.id),
      refetchInterval: PORTFOLIO_REFETCH_INTERVAL_MS * 2,
    })),
  });

  const now = new Date();
  const hour = dublinHour(now);

  const companyData: CompanyPortfolioData[] = useMemo(() => {
    return visibleCompanies.map((company, index) => {
      const issues = issueQueries[index]?.data;
      const agents = agentQueries[index]?.data;
      const realIssues = (issues ?? []).filter((issue) => !isCoordinationNoiseIssue(issue));
      const openCounts = {
        in_progress: 0,
        blocked: 0,
        in_review: 0,
        todo: 0,
      };
      for (const issue of realIssues) {
        if (issue.status in openCounts) {
          openCounts[issue.status as keyof typeof openCounts] += 1;
        }
      }
      const noiseHiddenToday = (issues ?? []).filter(
        (issue) => isCoordinationNoiseIssue(issue) && isSameLocalDay(issue.updatedAt, now),
      ).length;

      const liveAgents = (agents ?? []).filter((agent) => agent.status !== "terminated");
      const laneAgentCounts = new Map<string, number>();
      let primaryAgentCount = 0;
      for (const agent of liveAgents) {
        const lane = getAgentFallbackLane(agent.name);
        if (lane) {
          laneAgentCounts.set(lane.lane, (laneAgentCounts.get(lane.lane) ?? 0) + 1);
        } else {
          primaryAgentCount += 1;
        }
      }
      const agentNameById = new Map((agents ?? []).map((agent) => [agent.id, agent.name]));

      const sprintWindow = resolveSprintWindow(company, hour);

      return {
        company,
        issues,
        agents,
        issuesLoading: issueQueries[index]?.isLoading ?? true,
        issuesError: issueQueries[index]?.isError ?? false,
        realIssues,
        openCounts,
        needsYou: realIssues.filter((issue) => issue.status === "blocked" || issue.status === "in_review"),
        active: realIssues.filter((issue) => issue.status === "in_progress"),
        noiseHiddenToday,
        primaryAgentCount,
        laneAgentCounts,
        agentNameById,
        sprintWindow,
        activeNow: sprintWindow.activeNow && !sprintWindow.paused,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCompanies, issueQueries, agentQueries, hour]);

  // Order the "Needs you" company groups to follow the sprint: the company whose
  // sprint window is live now is the hero (top), TSMC (always-on) just under it, then
  // the rest in the order their windows next open — so a finished sprint rotates to the
  // bottom and the next in line moves up.
  const sprintActiveStartHour = activeSprintStartHour(companyData, hour);
  const needsYouCompanies = companyData
    .filter((data) => data.needsYou.length > 0)
    .sort(
      (a, b) =>
        sprintRotationKey(a.sprintWindow, sprintActiveStartHour) -
        sprintRotationKey(b.sprintWindow, sprintActiveStartHour),
    );
  const needsYouTotal = needsYouCompanies.reduce((sum, data) => sum + data.needsYou.length, 0);

  const activeAcrossCompanies = useMemo(() => {
    const rows = companyData.flatMap((data) => data.active.map((issue) => ({ data, issue })));
    rows.sort((a, b) => new Date(b.issue.updatedAt).getTime() - new Date(a.issue.updatedAt).getTime());
    return rows;
  }, [companyData]);
  const activeShown = activeAcrossCompanies.slice(0, ACTIVE_NOW_CAP);
  const activeTotal = activeAcrossCompanies.length;

  const noiseLedger = companyData.filter((data) => data.noiseHiddenToday > 0);
  const anyLoading = companiesLoading || issueQueries.some((query) => query.isLoading);

  return (
    <div
      className="dark -m-4 min-h-[calc(100%+2rem)] bg-background p-4 text-foreground md:-m-6 md:min-h-[calc(100%+3rem)] md:p-6"
      style={{ "--background": "oklch(0.05 0 0)", "--card": "oklch(0.1 0 0)" } as CSSProperties}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {/* Header */}
        <header className="flex items-center gap-3">
          <ThinkStackLogo size={36} className="shrink-0" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Portfolio</h1>
            <div aria-hidden className="mt-1 h-0.5 w-24 rounded-full" style={{ background: TS_GRADIENT }} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {anyLoading && <span className="text-xs text-muted-foreground">Refreshing…</span>}
            <SprintWindowsPopover
              rows={companyData.map((data) => ({ companyId: data.company.id, sprint: data.sprintWindow }))}
            />
          </div>
        </header>

        {/* Company strip */}
        <section aria-label="Companies" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {companyData.map((data) => (
            <CompanyCard key={data.company.id} data={data} />
          ))}
          {!companiesLoading && companyData.length === 0 && (
            <p className="text-sm text-muted-foreground">No companies yet.</p>
          )}
        </section>

        {/* Needs you — blocked + awaiting review, the stuff only the operator can move */}
        <section aria-label="Needs you" className="flex flex-col gap-3">
          <SectionHeading title="Needs you" count={needsYouTotal} subtitle="blocked or awaiting your review" />
          {needsYouTotal === 0 ? (
            <p className="text-sm text-muted-foreground">
              {anyLoading ? "Loading…" : "Nothing is waiting on you. All clear."}
            </p>
          ) : (
            needsYouCompanies.map((data) => {
              const isSprintHero = data.activeNow && data.sprintWindow.window !== "always-on";
              return (
                <div key={data.company.id} className={cn(isSprintHero && "rounded-md ring-1 ring-green-500/40")}>
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-t-md px-4 py-2",
                      isSprintHero ? "bg-green-500/10" : "bg-muted/50",
                    )}
                  >
                    <span className="text-sm font-medium">{data.company.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{data.company.issuePrefix}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{data.needsYou.length}</span>
                    {isSprintHero && (
                      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                        sprint live
                      </span>
                    )}
                  </div>
                  <div className="rounded-b-md border border-border">
                    {data.needsYou.map((issue) => (
                      <PortfolioIssueRow key={issue.id} data={data} issue={issue} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Active now — in-progress across all companies */}
        <section aria-label="Active now" className="flex flex-col gap-3">
          <SectionHeading title="Active now" count={activeTotal} subtitle="in progress, most recent first" />
          {activeShown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{anyLoading ? "Loading…" : "Nothing in progress."}</p>
          ) : (
            <div className="rounded-md border border-border">
              {activeShown.map(({ data, issue }) => (
                <PortfolioIssueRow key={issue.id} data={data} issue={issue} showCompany />
              ))}
            </div>
          )}
          {activeTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              {activeTotal > activeShown.length && `Showing ${activeShown.length} of ${activeTotal}. `}
              View all:{" "}
              {companyData
                .filter((data) => data.active.length > 0)
                .map((data, index, list) => (
                  <span key={data.company.id}>
                    <Link to={`/${data.company.issuePrefix}/issues`} className="hover:text-foreground hover:underline">
                      {data.company.issuePrefix} ({data.active.length})
                    </Link>
                    {index < list.length - 1 && " · "}
                  </span>
                ))}
            </p>
          )}
        </section>

        {/* Noise ledger — what the noise filter ate today, per company */}
        <section aria-label="Coordination noise" className="flex flex-col gap-2">
          <SectionHeading title="Noise ledger" subtitle="coordination traffic hidden from the views above" />
          {noiseLedger.length === 0 ? (
            <p className="text-xs text-muted-foreground">No coordination-noise issues today.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {noiseLedger.map((data) => (
                <li key={data.company.id} className="text-xs text-muted-foreground">
                  <Link
                    to={`/${data.company.issuePrefix}/issues?noise=show`}
                    className="hover:text-foreground hover:underline"
                  >
                    {data.company.name}: {data.noiseHiddenToday} coordination-noise issue
                    {data.noiseHiddenToday === 1 ? "" : "s"} hidden today
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
