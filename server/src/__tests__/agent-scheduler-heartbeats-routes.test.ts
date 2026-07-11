import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  decide: vi.fn(),
  hasPermission: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockInstanceSettingsService = vi.hoisted(() => ({
  getGeneral: vi.fn(),
}));

function registerModuleMocks() {
  vi.doMock("../routes/authz.js", async () => vi.importActual("../routes/authz.js"));

  vi.doMock("../services/agents.js", () => ({
    agentService: () => mockAgentService,
  }));

  vi.doMock("../services/instance-settings.js", () => ({
    instanceSettingsService: () => mockInstanceSettingsService,
  }));

  vi.doMock("../services/index.js", () => ({
    agentService: () => mockAgentService,
    agentInstructionsService: () => ({}),
    accessService: () => mockAccessService,
    approvalService: () => ({}),
    companySkillService: () => ({ listRuntimeSkillEntries: vi.fn() }),
    budgetService: () => ({}),
    heartbeatService: () => ({ wakeup: vi.fn() }),
    issueApprovalService: () => ({}),
    issueService: () => ({}),
    logActivity: vi.fn(),
    secretService: () => ({}),
    syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
    workspaceOperationService: () => ({}),
  }));

  vi.doMock("../adapters/index.js", () => ({
    detectAdapterModel: vi.fn(),
    findActiveServerAdapter: vi.fn(),
    findServerAdapter: vi.fn(),
    listAdapterModels: vi.fn(),
    listAdapterModelProfiles: vi.fn(),
    refreshAdapterModels: vi.fn(),
    requireServerAdapter: vi.fn(),
  }));
}

function createSelectQuery(rows: Array<Record<string, unknown>>) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: Array<Record<string, unknown>>) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return query;
}

function createDbStub(rows: Array<Record<string, unknown>>) {
  return {
    select: vi.fn(() => createSelectQuery(rows)),
  };
}

async function createApp(rows: Array<Record<string, unknown>>) {
  const [{ agentRoutes }, { errorHandler }] = await Promise.all([
    vi.importActual<typeof import("../routes/agents.js")>("../routes/agents.js"),
    vi.importActual<typeof import("../middleware/index.js")>("../middleware/index.js"),
  ]);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "instance-admin",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api", agentRoutes(createDbStub(rows) as any));
  app.use(errorHandler);
  return app;
}

describe("scheduler heartbeat route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../services/agents.js");
    vi.doUnmock("../services/index.js");
    vi.doUnmock("../services/instance-settings.js");
    vi.doUnmock("../adapters/index.js");
    vi.doUnmock("../routes/agents.js");
    vi.doUnmock("../routes/authz.js");
    vi.doUnmock("../middleware/index.js");
    registerModuleMocks();
    vi.clearAllMocks();

    mockInstanceSettingsService.getGeneral.mockResolvedValue({ censorUsernameInLogs: false });
  });

  it("labels dormant wake-on-demand lanes separately and excludes them from actionable stale counts", async () => {
    const rows = [
      {
        id: "active-agent",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "Scheduler Active",
        role: "engineer",
        title: "Scheduler Active",
        status: "idle",
        adapterType: "codex_local",
        runtimeConfig: { heartbeat: { enabled: true, intervalSec: 300, wakeOnDemand: true } },
        lastHeartbeatAt: new Date("2026-07-02T00:00:00.000Z"),
      },
      {
        id: "dormant-agent",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "Dormant Sister",
        role: "engineer",
        title: "Dormant Sister",
        status: "idle",
        adapterType: "codex_local",
        runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true } },
        lastHeartbeatAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "inactive-agent",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "Bench Manager",
        role: "engineer",
        title: "Bench Manager",
        status: "idle",
        adapterType: "codex_local",
        runtimeConfig: { heartbeat: { enabled: true, wakeOnDemand: true } },
        lastHeartbeatAt: new Date("2026-07-01T12:00:00.000Z"),
      },
      {
        id: "paused-agent",
        companyId: "company-1",
        companyName: "TSMC",
        companyIssuePrefix: "TSMC",
        agentName: "Paused Lane",
        role: "engineer",
        title: "Paused Lane",
        status: "paused",
        adapterType: "codex_local",
        runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true } },
        lastHeartbeatAt: new Date("2026-07-01T12:00:00.000Z"),
      },
    ];

    const res = await request(await createApp(rows)).get("/api/instance/scheduler-heartbeats");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    const byId = Object.fromEntries(
      res.body.map((agent: { id: string }) => [agent.id, agent]),
    ) as Record<string, Record<string, unknown>>;

    expect(byId["active-agent"]).toMatchObject({
      id: "active-agent",
      schedulerActive: true,
      staleHeartbeatEligible: true,
      staleHeartbeatCategory: "scheduler_active",
    });
    expect(byId["dormant-agent"]).toMatchObject({
      id: "dormant-agent",
      schedulerActive: false,
      wakeOnDemand: true,
      staleHeartbeatEligible: false,
      staleHeartbeatCategory: "wake_on_demand_dormant",
    });
    expect(byId["inactive-agent"]).toMatchObject({
      id: "inactive-agent",
      schedulerActive: false,
      heartbeatEnabled: true,
      staleHeartbeatEligible: false,
      staleHeartbeatCategory: "scheduler_inactive",
    });
  });
});
