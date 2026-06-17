// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AnchorHTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Company, Issue, IssueBlockedInboxAttention, IssueRelationIssueSummary } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Portfolio } from "./Portfolio";

const mockIssuesApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockAgentsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const companyState = vi.hoisted(() => ({
  companies: [] as unknown[],
  loading: false,
}));

vi.mock("../api/issues", () => ({
  issuesApi: mockIssuesApi,
}));

vi.mock("../api/agents", () => ({
  agentsApi: mockAgentsApi,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => companyState,
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createCompany(overrides: Partial<Company>): Company {
  return {
    id: "company-1",
    name: "Company",
    status: "active",
    issuePrefix: "PAP",
    ...overrides,
  } as Company;
}

function createIssue(overrides: Partial<Issue>): Issue {
  return {
    id: `issue-${Math.random().toString(36).slice(2)}`,
    identifier: "PAP-1",
    title: "Issue title",
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    originKind: "manual",
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as Issue;
}

function createAgent(overrides: Partial<Agent>): Agent {
  return {
    id: `agent-${Math.random().toString(36).slice(2)}`,
    name: "Agent",
    status: "active",
    ...overrides,
  } as Agent;
}

const books = createCompany({ id: "books", name: "ThinkStack Books", issuePrefix: "TSB" });
const kiss = createCompany({ id: "kiss", name: "ThinkStack KISS", issuePrefix: "TSK" });

const ASK_INTERACTION_ID = "ab08dd9e-d934-4c78-a281-77b53426b267";

function withAttention(issue: Issue, over: Partial<IssueBlockedInboxAttention>): Issue {
  return {
    ...issue,
    blockedInboxAttention: {
      kind: "blocked",
      state: "awaiting_decision",
      reason: "pending_board_decision",
      severity: "medium",
      stoppedSinceAt: null,
      owner: { type: "board", agentId: null, userId: null, label: "Board" },
      action: { label: "Decide", detail: null },
      sourceIssue: null,
      leafIssue: null,
      recoveryIssue: null,
      approvalId: null,
      interactionId: null,
      sampleIssueIdentifier: null,
      redaction: { externalDetailsRedacted: false, secretFieldsOmitted: true },
      ...over,
    },
  } as Issue;
}

function blockerSummary(id: string, identifier: string, title: string): IssueRelationIssueSummary {
  return { id, identifier, title, status: "todo", priority: "medium", assigneeAgentId: null, assigneeUserId: null };
}

const booksIssues = [
  createIssue({ identifier: "TSB-1", title: "Fix royalties export", status: "blocked", priority: "high" }),
  createIssue({
    identifier: "TSB-2",
    title: "Write chapter outline",
    status: "in_progress",
    updatedAt: new Date("2026-06-11T08:00:00Z"),
  }),
  // Coordination noise, updated "today" relative to the fake timers below.
  createIssue({ identifier: "TSB-3", title: "MC inbound ack-sweep", status: "todo" }),
];

const kissIssues = [
  createIssue({ identifier: "TSK-9", title: "Review landing page copy", status: "in_review" }),
  createIssue({
    identifier: "TSK-3",
    title: "Ship newsletter",
    status: "in_progress",
    updatedAt: new Date("2026-06-11T09:00:00Z"),
  }),
];

// The `attention=blocked` endpoint returns ONLY rows the server flags as needing a human, each
// already carrying its blockedInboxAttention — independent of the issue's raw status. This is
// what drives "Needs you". Note TSB-5 is a *todo* issue with a pending ask: invisible under the
// old status filter, surfaced here, and deep-linked straight to the interaction.
const booksAttention = [
  withAttention(booksIssues[0]!, { reason: "blocked_chain_stalled", severity: "high", state: "needs_attention" }),
  withAttention(
    createIssue({ identifier: "TSB-5", title: "Approve Q3 budget", status: "todo" }),
    { reason: "pending_board_decision", interactionId: ASK_INTERACTION_ID },
  ),
];

const kissAttention = [
  withAttention(kissIssues[0]!, { reason: "pending_user_decision", owner: { type: "user", agentId: null, userId: "u1", label: null } }),
];

async function flushQueries() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("Portfolio", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    companyState.companies = [books, kiss];
    companyState.loading = false;
    mockIssuesApi.list.mockImplementation((companyId: string, filters?: { attention?: string }) => {
      if (filters?.attention === "blocked") {
        return Promise.resolve(companyId === "books" ? booksAttention : kissAttention);
      }
      return Promise.resolve(companyId === "books" ? booksIssues : kissIssues);
    });
    mockAgentsApi.list.mockImplementation((companyId: string) =>
      Promise.resolve(
        companyId === "books"
          ? [createAgent({ name: "GLaD0S" }), createAgent({ name: "GLaD0S-Codex" })]
          : [createAgent({ name: "Wheatley" })],
      ),
    );
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    container.remove();
    vi.clearAllMocks();
  });

  async function renderPortfolio() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <Portfolio />
        </QueryClientProvider>,
      );
    });
    await flushQueries();
  }

  it("renders company cards with noise-filtered open counts and lane badges", async () => {
    await renderPortfolio();

    expect(container.textContent).toContain("ThinkStack Books");
    expect(container.textContent).toContain("ThinkStack KISS");
    // Books: 1 primary agent + 1 Codex lane clone.
    expect(container.textContent).toContain("1 agent · 1 lane");
    expect(container.textContent).toContain("Codex");
  });

  it("drives Needs you from the attention model — including a pending ask on a todo issue, deep-linked", async () => {
    await renderPortfolio();

    expect(container.textContent).toContain("Needs you");
    expect(container.textContent).toContain("Fix royalties export");
    expect(container.textContent).toContain("Review landing page copy");
    // The gap this closes: a todo issue carrying a pending ask is now surfaced (it was invisible
    // under the old status === blocked/in_review filter).
    expect(container.textContent).toContain("Approve Q3 budget");

    const anchors = Array.from(container.querySelectorAll("a"));
    const links = anchors.map((a) => a.getAttribute("href"));
    expect(links).toContain("/TSB/issues/TSB-1");
    expect(links).toContain("/TSK/issues/TSK-9");
    // The ask deep-links straight to the interaction, not the issue top.
    const askHref = `/TSB/issues/TSB-5#interaction-${ASK_INTERACTION_ID}`;
    expect(links).toContain(askHref);
    // A standalone actionable ask gets the same violet highlight as a chain leaf — so the thing to
    // action reads identically whether or not it sits in a chain.
    expect(anchors.find((a) => a.getAttribute("href") === askHref)?.className).toContain("ring-violet-500/40");
    // ...while a non-actionable blocked-context row does not.
    expect(anchors.find((a) => a.getAttribute("href") === "/TSB/issues/TSB-1")?.className).not.toContain("ring-violet-500/40");
  });

  it("folds a blocked chain into a nested tree and surfaces the buried ask", async () => {
    // A 2-deep chain: TSB-10 is a blocked-context parent whose actual decision lives on the deep
    // child TSB-11 (a pending ask). Before, both read as disconnected flat rows; now TSB-11 nests
    // under TSB-10 and is pulled out as the actionable, deep-linked leaf.
    const ask = withAttention(
      createIssue({ id: "tsb-11", identifier: "TSB-11", title: "Approve vendor budget", status: "todo" }),
      { reason: "pending_board_decision", interactionId: ASK_INTERACTION_ID },
    );
    const parent = withAttention(
      createIssue({
        id: "tsb-10",
        identifier: "TSB-10",
        title: "Launch storefront",
        status: "blocked",
        blockedBy: [blockerSummary("tsb-11", "TSB-11", "Approve vendor budget")],
      }),
      { reason: "blocked_chain_stalled", severity: "high", state: "needs_attention" },
    );
    mockIssuesApi.list.mockImplementation((companyId: string, filters?: { attention?: string }) => {
      if (filters?.attention === "blocked") {
        return Promise.resolve(companyId === "books" ? [parent, ask] : []);
      }
      return Promise.resolve(companyId === "books" ? booksIssues : kissIssues);
    });

    await renderPortfolio();

    // The chain announces what it surfaced, and both members render.
    expect(container.textContent).toContain("1 awaiting you · surfaced from a chain of 2");
    expect(container.textContent).toContain("Launch storefront");
    expect(container.textContent).toContain("Approve vendor budget");

    const anchors = Array.from(container.querySelectorAll("a"));
    const askLink = anchors.find((a) => a.getAttribute("href")?.includes("#interaction-"));
    const parentLink = anchors.find((a) => a.getAttribute("href") === "/TSB/issues/TSB-10");

    // The deep child is highlighted as the actionable leaf and deep-links straight to the ask.
    expect(askLink?.getAttribute("href")).toBe(`/TSB/issues/TSB-11#interaction-${ASK_INTERACTION_ID}`);
    expect(askLink?.className).toContain("ring-violet-500/40");
    // The parent stays as dimmed context (no digging required to reach the leaf).
    expect(parentLink?.className).toContain("opacity-60");
    // The leaf is nested beneath the parent under an indent guide, not a sibling flat row.
    expect(askLink?.closest("div.border-l")).not.toBeNull();
  });

  it("lists in-progress issues under Active now, most recent first", async () => {
    await renderPortfolio();

    const text = container.textContent ?? "";
    const newsletterIndex = text.indexOf("Ship newsletter");
    const chapterIndex = text.indexOf("Write chapter outline");
    expect(newsletterIndex).toBeGreaterThan(-1);
    expect(chapterIndex).toBeGreaterThan(-1);
    expect(newsletterIndex).toBeLessThan(chapterIndex);
  });

  it("links the noise ledger to the company issues page with the noise filter off", async () => {
    await renderPortfolio();

    expect(container.textContent).toContain("1 coordination-noise issue hidden today");
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/TSB/issues?noise=show");
  });
});
