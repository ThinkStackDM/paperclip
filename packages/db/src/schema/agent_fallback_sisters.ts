import { index, integer, pgTable, timestamp, uniqueIndex, uuid, text } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const agentFallbackSisters = pgTable(
  "agent_fallback_sisters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    primaryAgentId: uuid("primary_agent_id").notNull().references(() => agents.id),
    sisterAgentId: uuid("sister_agent_id").notNull().references(() => agents.id),
    priority: integer("priority").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    companyPrimaryIdx: index("agent_fallback_sisters_company_primary_idx").on(
      table.companyId,
      table.primaryAgentId,
      table.priority,
    ),
    companySisterIdx: index("agent_fallback_sisters_company_sister_idx").on(
      table.companyId,
      table.sisterAgentId,
    ),
    uniquePairIdx: uniqueIndex("agent_fallback_sisters_company_primary_sister_idx").on(
      table.companyId,
      table.primaryAgentId,
      table.sisterAgentId,
    ),
  }),
);
