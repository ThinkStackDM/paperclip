// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstanceSettings } from "./InstanceSettings";

const mockHeartbeatsApi = vi.hoisted(() => ({
  listInstanceSchedulerAgents: vi.fn(),
}));

const mockAgentsApi = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());

vi.mock("../api/heartbeats", () => ({
  heartbeatsApi: mockHeartbeatsApi,
}));

vi.mock("../api/agents", () => ({
  agentsApi: mockAgentsApi,
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setBreadcrumbs: mockSetBreadcrumbs,
  }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, className, title }: { to: string; children: React.ReactNode; className?: string; title?: string }) => (
    <a href={to} className={className} title={title}>
      {children}
    </a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function renderPage(container: HTMLDivElement) {
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <InstanceSettings />
      </QueryClientProvider>,
    );
  });

  await flushReact();
  await flushReact();
  return root;
}

describe("InstanceSettings", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.setSystemTime(new Date("2026-07-05T01:38:00.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    mockHeartbeatsApi.listInstanceSchedulerAgents.mockResolvedValue([
      {
        id: "active-stale",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "SchedulerActive",
        agentUrlKey: "scheduleractive",
        role: "engineer",
        title: "Scheduler Active",
        status: "idle",
        adapterType: "codex_local",
        intervalSec: 300,
        heartbeatEnabled: true,
        wakeOnDemand: true,
        schedulerActive: true,
        staleHeartbeatEligible: true,
        staleHeartbeatCategory: "scheduler_active",
        lastHeartbeatAt: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "dormant",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "DormantLane",
        agentUrlKey: "dormantlane",
        role: "engineer",
        title: "Dormant Lane",
        status: "idle",
        adapterType: "codex_local",
        intervalSec: 0,
        heartbeatEnabled: false,
        wakeOnDemand: true,
        schedulerActive: false,
        staleHeartbeatEligible: false,
        staleHeartbeatCategory: "wake_on_demand_dormant",
        lastHeartbeatAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "inactive",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "ManualOnly",
        agentUrlKey: "manualonly",
        role: "engineer",
        title: "Manual Only",
        status: "idle",
        adapterType: "codex_local",
        intervalSec: 0,
        heartbeatEnabled: true,
        wakeOnDemand: false,
        schedulerActive: false,
        staleHeartbeatEligible: false,
        staleHeartbeatCategory: "scheduler_inactive",
        lastHeartbeatAt: "2026-07-04T12:00:00.000Z",
      },
    ]);
    mockAgentsApi.get.mockResolvedValue({ runtimeConfig: {} });
    mockAgentsApi.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("reports actionable stale lanes separately from dormant wake-on-demand lanes", async () => {
    const root = await renderPage(container);

    expect(container.textContent).toContain("Stale heartbeat reporting counts scheduler-active lanes only.");
    expect(container.textContent).toContain("1 actionable stale >48h");
    expect(container.textContent).toContain("1 dormant wake-on-demand >48h");
    expect(container.textContent).toContain("SchedulerActive");
    expect(container.textContent).toContain("DormantLane");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Dormant");
    expect(container.textContent).toContain("Inactive");

    await act(async () => {
      root.unmount();
    });
  });
});
