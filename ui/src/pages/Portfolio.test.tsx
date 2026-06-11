// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AnchorHTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Company, Issue } from "@paperclipai/shared";
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
    mockIssuesApi.list.mockImplementation((companyId: string) =>
      Promise.resolve(companyId === "books" ? booksIssues : kissIssues),
    );
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

  it("surfaces blocked and in-review issues in Needs you with cross-company links", async () => {
    await renderPortfolio();

    expect(container.textContent).toContain("Needs you");
    expect(container.textContent).toContain("Fix royalties export");
    expect(container.textContent).toContain("Review landing page copy");

    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/TSB/issues/TSB-1");
    expect(links).toContain("/TSK/issues/TSK-9");
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
