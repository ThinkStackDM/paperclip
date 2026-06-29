import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const companyId = "22222222-2222-4222-8222-222222222222";
const primaryAgentId = "11111111-1111-4111-8111-111111111111";
const sisterAgentId = "33333333-3333-4333-8333-333333333333";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  decide: vi.fn(),
  hasPermission: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  setPrincipalPermission: vi.fn(),
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

function createDbStub(options: {
  selectRows?: Array<Array<Record<string, unknown>>>;
  returningRows?: Array<Record<string, unknown>>;
} = {}) {
  const selectRows = [...(options.selectRows ?? [])];
  const returningRows = [...(options.returningRows ?? [])];
  const insertChain = {
    values: vi.fn(() => insertChain),
    onConflictDoUpdate: vi.fn(() => insertChain),
    returning: vi.fn(async () => {
      const row = returningRows.shift();
      return row ? [row] : [];
    }),
  };
  const insertValues = insertChain.values;
  const onConflictDoUpdate = insertChain.onConflictDoUpdate;
  const returning = insertChain.returning;

  return {
    db: {
      select: vi.fn(() => createSelectQuery(selectRows.shift() ?? [])),
      insert: vi.fn(() => insertChain),
    },
    insertValues,
    onConflictDoUpdate,
  };
}

async function createApp(
  db: Record<string, unknown>,
  actor: Record<string, unknown> = {
    type: "board",
    userId: "local-board",
    companyIds: [companyId],
    source: "local_implicit",
    isInstanceAdmin: false,
  },
) {
  const [{ agentRoutes }, { errorHandler }] = await Promise.all([
    vi.importActual<typeof import("../routes/agents.js")>("../routes/agents.js"),
    vi.importActual<typeof import("../middleware/index.js")>("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", agentRoutes(db as any));
  app.use(errorHandler);
  return app;
}

describe("agent fallback sister routes", () => {
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

    mockAgentService.getById.mockResolvedValue({
      id: primaryAgentId,
      companyId,
      role: "cto",
      permissions: { canCreateAgents: true },
    });
    mockAccessService.decide.mockResolvedValue({
      allowed: true,
      action: "agents:manage_fallback",
      reason: "allow_explicit_grant",
      explanation: "Allowed by test grant.",
    });
    mockAccessService.hasPermission.mockResolvedValue(true);
    mockInstanceSettingsService.getGeneral.mockResolvedValue({ censorUsernameInLogs: false });
  });

  it("lists active fallback sister relationships", async () => {
    const db = createDbStub({
      selectRows: [[{
        id: "44444444-4444-4444-8444-444444444444",
        companyId,
        primaryAgentId,
        sisterAgentId,
        priority: 0,
        createdBy: "seed-fallback-sisters.py",
        createdAt: new Date("2026-06-29T20:00:00.000Z"),
        revokedAt: null,
      }]],
    });

    const res = await request(await createApp(db.db)).get(
      `/api/companies/${companyId}/agent-fallback-sisters`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject([{
      companyId,
      primaryAgentId,
      sisterAgentId,
      priority: 0,
      createdBy: "seed-fallback-sisters.py",
      revokedAt: null,
    }]);
    expect(mockAccessService.decide).toHaveBeenCalledWith(expect.objectContaining({
      action: "agents:manage_fallback",
      resource: { type: "company", companyId },
    }));
  });

  it("creates or reactivates a fallback sister relationship idempotently", async () => {
    const createdRow = {
      id: "55555555-5555-4555-8555-555555555555",
      companyId,
      primaryAgentId,
      sisterAgentId,
      priority: 2,
      createdBy: "seed-fallback-sisters.py",
      createdAt: new Date("2026-06-29T20:05:00.000Z"),
      revokedAt: null,
    };
    const db = createDbStub({
      selectRows: [[
        { id: primaryAgentId },
        { id: sisterAgentId },
      ]],
      returningRows: [createdRow],
    });

    const res = await request(await createApp(db.db))
      .post(`/api/companies/${companyId}/agent-fallback-sisters`)
      .send({
        primaryAgentId,
        sisterAgentId,
        priority: 2,
        createdBy: "seed-fallback-sisters.py",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      companyId,
      primaryAgentId,
      sisterAgentId,
      priority: 2,
      createdBy: "seed-fallback-sisters.py",
      revokedAt: null,
    });
    expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      companyId,
      primaryAgentId,
      sisterAgentId,
      priority: 2,
      createdBy: "seed-fallback-sisters.py",
      revokedAt: null,
    }));
    expect(db.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("allows cto lanes to seed the registry without an explicit fallback grant", async () => {
    const createdRow = {
      id: "66666666-6666-4666-8666-666666666666",
      companyId,
      primaryAgentId,
      sisterAgentId,
      priority: 0,
      createdBy: "agent:test-agent",
      createdAt: new Date("2026-06-29T20:10:00.000Z"),
      revokedAt: null,
    };
    const db = createDbStub({
      selectRows: [[
        { id: primaryAgentId },
        { id: sisterAgentId },
      ]],
      returningRows: [createdRow],
    });
    mockAccessService.decide.mockResolvedValue({
      allowed: false,
      action: "agents:manage_fallback",
      reason: "deny_missing_grant",
      explanation: "Missing explicit fallback grant.",
    });
    mockAgentService.getById.mockResolvedValue({
      id: "test-agent",
      companyId,
      role: "cto",
      permissions: { canCreateAgents: false },
    });

    const res = await request(await createApp(db.db, {
      type: "agent",
      agentId: "test-agent",
      companyId,
      source: "agent_jwt",
      runId: "run-1",
    }))
      .post(`/api/companies/${companyId}/agent-fallback-sisters`)
      .send({
        primaryAgentId,
        sisterAgentId,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      companyId,
      primaryAgentId,
      sisterAgentId,
      createdBy: "agent:test-agent",
    });
  });

  it("rejects callers without fallback registry authority", async () => {
    const db = createDbStub();
    mockAccessService.decide.mockResolvedValue({
      allowed: false,
      action: "agents:manage_fallback",
      reason: "deny_missing_grant",
      explanation: "Missing explicit fallback grant.",
    });

    const res = await request(await createApp(db.db, {
      type: "board",
      userId: "user-1",
      companyIds: [companyId],
      source: "session",
      isInstanceAdmin: false,
      memberships: [{ companyId, membershipRole: "operator", status: "active" }],
    })).get(`/api/companies/${companyId}/agent-fallback-sisters`);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Missing explicit fallback grant." });
  });
});
