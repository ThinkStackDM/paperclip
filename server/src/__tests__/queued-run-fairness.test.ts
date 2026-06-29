import { describe, expect, it } from "vitest";
import { buildRoundRobinQueuedAgentOrder } from "../services/queued-run-fairness.ts";

describe("buildRoundRobinQueuedAgentOrder", () => {
  it("alternates companies round-robin while preserving per-company queue order", () => {
    const order = buildRoundRobinQueuedAgentOrder([
      { companyId: "company-a", agentId: "agent-a1" },
      { companyId: "company-a", agentId: "agent-a2" },
      { companyId: "company-b", agentId: "agent-b1" },
      { companyId: "company-c", agentId: "agent-c1" },
      { companyId: "company-b", agentId: "agent-b2" },
      { companyId: "company-a", agentId: "agent-a3" },
    ]);

    expect(order).toEqual([
      "agent-a1",
      "agent-b1",
      "agent-c1",
      "agent-a2",
      "agent-b2",
      "agent-a3",
    ]);
  });

  it("returns an empty order for an empty queue", () => {
    expect(buildRoundRobinQueuedAgentOrder([])).toEqual([]);
  });
});
