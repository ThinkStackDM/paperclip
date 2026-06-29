export interface QueuedRunFairnessRow {
  companyId: string;
  agentId: string;
}

export function buildRoundRobinQueuedAgentOrder(rows: QueuedRunFairnessRow[]): string[] {
  const companyQueues = new Map<string, string[]>();
  const companyOrder: string[] = [];

  for (const row of rows) {
    const existingQueue = companyQueues.get(row.companyId);
    if (existingQueue) {
      existingQueue.push(row.agentId);
    } else {
      companyQueues.set(row.companyId, [row.agentId]);
      companyOrder.push(row.companyId);
    }
  }

  const orderedAgentIds: string[] = [];
  while (true) {
    let appended = false;
    for (const companyId of companyOrder) {
      const agentId = companyQueues.get(companyId)?.shift();
      if (!agentId) continue;
      orderedAgentIds.push(agentId);
      appended = true;
    }
    if (!appended) break;
  }

  return orderedAgentIds;
}
