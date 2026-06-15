import { and, eq, inArray, sql } from "drizzle-orm";
import { agents, companies, financeEvents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { badRequest, forbidden } from "../errors.js";

const PORTFOLIO_CAPABILITY = "portfolio_metrics:read";
const FAILURE_STATUSES = ["failed", "timed_out", "errored"] as const;

export const FINANCE_EVENT_KINDS = ["revenue", "refund", "fee", "cost"] as const;
export type FinanceEventKind = (typeof FINANCE_EVENT_KINDS)[number];

export interface PortfolioRunsQuery {
  actor: Express.Request["actor"];
  since: Date;
  until: Date;
  companyIds: string[];
}

export interface PortfolioRunsRow {
  company_id: string;
  agent_id: string;
  runs_total: number;
  runs_succeeded: number;
  runs_failed: number;
  seconds_on_task: number;
  distinct_issues: number;
  heartbeats_avg: number;
}

export interface PortfolioFinanceEventsQuery {
  actor: Express.Request["actor"];
  since: Date;
  until: Date;
  companyIds: string[];
  kinds?: string[];
  limit?: number;
}

export interface PortfolioFinanceEventRow {
  company_id: string;
  event_id: string;
  occurred_at: string;
  kind: string;
  channel: string;
  amount_cents: number;
  currency: string;
  sku: string | null;
  source_ref: string | null;
  agent_id: string | null;
}

export interface PortfolioFinanceEventInsert {
  actor: Express.Request["actor"];
  companyId: string;
  occurredAt: Date;
  kind: FinanceEventKind;
  channel: string;
  amountCents: number;
  currency?: string;
  sku?: string | null;
  sourceRef?: string | null;
  agentId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PortfolioFinanceEventWriteResult {
  row: PortfolioFinanceEventRow;
  created: boolean;
}

const FINANCE_WRITE_DIRECTION_BY_KIND: Record<FinanceEventKind, "debit" | "credit"> = {
  revenue: "credit",
  refund: "debit",
  fee: "debit",
  cost: "debit",
};

function parseCapabilities(raw: string | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function portfolioService(db: Db) {
  async function assertAgentAccess(actor: Express.Request["actor"], companyIds: string[]) {
    if (actor.type !== "agent" || !actor.agentId || !actor.companyId) {
      throw forbidden("Portfolio access denied");
    }

    const agent = await db
      .select({
        id: agents.id,
        companyId: agents.companyId,
        capabilities: agents.capabilities,
      })
      .from(agents)
      .where(eq(agents.id, actor.agentId))
      .then((rows) => rows[0] ?? null);

    if (!agent || agent.companyId !== actor.companyId) {
      throw forbidden("Portfolio access denied");
    }
    if (!parseCapabilities(agent.capabilities).has(PORTFOLIO_CAPABILITY)) {
      throw forbidden("Agent lacks portfolio_metrics:read");
    }

    const allowedCompanies = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          inArray(companies.id, companyIds),
          eq(companies.parentCompanyId, actor.companyId),
        ),
      );

    if (allowedCompanies.length !== companyIds.length) {
      throw forbidden("Portfolio company scope denied");
    }
  }

  return {
    async listRunsRollup(input: PortfolioRunsQuery) {
      if (input.actor.type === "agent") {
        await assertAgentAccess(input.actor, input.companyIds);
      }

      if (input.companyIds.length === 0) {
        return [];
      }

      const companyIdsParam = sql`${sql.join(
        input.companyIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}`;
      const failureStatusesParam = sql`${sql.join(
        FAILURE_STATUSES.map((status) => sql`${status}`),
        sql`, `,
      )}`;

      const result = await db.execute(sql`
        WITH aggregated AS (
          SELECT
            hr.company_id,
            hr.agent_id,
            COUNT(*)::int AS runs_total,
            COUNT(*) FILTER (WHERE hr.status = 'succeeded')::int AS runs_succeeded,
            COUNT(*) FILTER (WHERE hr.status IN (${failureStatusesParam}))::int AS runs_failed,
            COALESCE(
              SUM(
                CASE
                  WHEN hr.started_at IS NOT NULL AND hr.finished_at IS NOT NULL
                    THEN GREATEST(EXTRACT(EPOCH FROM (hr.finished_at - hr.started_at)), 0)
                  ELSE 0
                END
              ),
              0
            )::int AS seconds_on_task,
            COUNT(DISTINCT hr.context_snapshot ->> 'issueId')::int AS distinct_issues
          FROM heartbeat_runs hr
          WHERE
            hr.company_id IN (${companyIdsParam})
            AND hr.started_at >= ${input.since.toISOString()}::timestamptz
            AND hr.started_at < ${input.until.toISOString()}::timestamptz
          GROUP BY hr.company_id, hr.agent_id
        )
        SELECT
          company_id,
          agent_id,
          runs_total,
          runs_succeeded,
          runs_failed,
          seconds_on_task,
          distinct_issues,
          CASE
            WHEN distinct_issues > 0
              THEN ROUND((runs_total::numeric / distinct_issues::numeric), 2)::double precision
            ELSE 0::double precision
          END AS heartbeats_avg
        FROM aggregated
        ORDER BY company_id ASC, agent_id ASC
      `);

      const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
      return (rows as Array<Record<string, unknown>>).map((row) => ({
        company_id: String(row.company_id),
        agent_id: String(row.agent_id),
        runs_total: Number(row.runs_total ?? 0),
        runs_succeeded: Number(row.runs_succeeded ?? 0),
        runs_failed: Number(row.runs_failed ?? 0),
        seconds_on_task: Number(row.seconds_on_task ?? 0),
        distinct_issues: Number(row.distinct_issues ?? 0),
        heartbeats_avg: Number(row.heartbeats_avg ?? 0),
      })) satisfies PortfolioRunsRow[];
    },

    async listFinanceEvents(input: PortfolioFinanceEventsQuery): Promise<PortfolioFinanceEventRow[]> {
      if (input.actor.type === "agent") {
        await assertAgentAccess(input.actor, input.companyIds);
      }

      if (input.companyIds.length === 0) {
        return [];
      }

      const limit = Math.min(Math.max(input.limit ?? 5000, 1), 50_000);

      const companyIdsParam = sql`${sql.join(
        input.companyIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}`;

      const kindsFilter = input.kinds && input.kinds.length > 0
        ? sql`AND fe.event_kind IN (${sql.join(
            input.kinds.map((kind) => sql`${kind}`),
            sql`, `,
          )})`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          fe.company_id,
          fe.id AS event_id,
          fe.occurred_at,
          fe.event_kind AS kind,
          fe.biller AS channel,
          fe.amount_cents,
          fe.currency,
          fe.metadata_json ->> 'sku' AS sku,
          fe.external_invoice_id AS source_ref,
          fe.agent_id
        FROM finance_events fe
        WHERE
          fe.company_id IN (${companyIdsParam})
          AND fe.occurred_at >= ${input.since.toISOString()}::timestamptz
          AND fe.occurred_at < ${input.until.toISOString()}::timestamptz
          ${kindsFilter}
        ORDER BY fe.occurred_at DESC, fe.id ASC
        LIMIT ${limit}
      `);

      const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
      return (rows as Array<Record<string, unknown>>).map((row) => ({
        company_id: String(row.company_id),
        event_id: String(row.event_id),
        occurred_at: row.occurred_at instanceof Date
          ? row.occurred_at.toISOString()
          : String(row.occurred_at),
        kind: String(row.kind),
        channel: String(row.channel),
        amount_cents: Number(row.amount_cents ?? 0),
        currency: String(row.currency ?? "USD"),
        sku: row.sku == null ? null : String(row.sku),
        source_ref: row.source_ref == null ? null : String(row.source_ref),
        agent_id: row.agent_id == null ? null : String(row.agent_id),
      })) satisfies PortfolioFinanceEventRow[];
    },

    async insertFinanceEvent(input: PortfolioFinanceEventInsert): Promise<PortfolioFinanceEventWriteResult> {
      if (!FINANCE_EVENT_KINDS.includes(input.kind)) {
        throw badRequest(`Invalid kind: ${input.kind}`);
      }
      if (!input.channel || input.channel.trim().length === 0) {
        throw badRequest("channel is required");
      }
      if (!Number.isFinite(input.amountCents)) {
        throw badRequest("amount_cents must be a number");
      }
      if (!Number.isFinite(input.occurredAt.getTime())) {
        throw badRequest("occurred_at must be a valid timestamp");
      }

      await assertWriteAccess(input.actor, input.companyId);

      const channel = input.channel.trim();
      const currency = (input.currency ?? "USD").trim().toUpperCase() || "USD";
      const direction = FINANCE_WRITE_DIRECTION_BY_KIND[input.kind];
      const sourceRef = input.sourceRef == null || input.sourceRef.trim().length === 0
        ? null
        : input.sourceRef.trim();
      const metadataBase: Record<string, unknown> = input.metadata ? { ...input.metadata } : {};
      if (input.sku != null && input.sku.trim().length > 0 && metadataBase.sku == null) {
        metadataBase.sku = input.sku.trim();
      }
      const metadataJson = Object.keys(metadataBase).length > 0 ? metadataBase : null;

      if (sourceRef) {
        const existing = await db
          .select({
            id: financeEvents.id,
            companyId: financeEvents.companyId,
            occurredAt: financeEvents.occurredAt,
            eventKind: financeEvents.eventKind,
            biller: financeEvents.biller,
            amountCents: financeEvents.amountCents,
            currency: financeEvents.currency,
            externalInvoiceId: financeEvents.externalInvoiceId,
            agentId: financeEvents.agentId,
            metadataJson: financeEvents.metadataJson,
          })
          .from(financeEvents)
          .where(
            and(
              eq(financeEvents.companyId, input.companyId),
              eq(financeEvents.eventKind, input.kind),
              eq(financeEvents.biller, channel),
              eq(financeEvents.externalInvoiceId, sourceRef),
            ),
          )
          .limit(1);

        const found = existing[0];
        if (found) {
          return {
            created: false,
            row: {
              company_id: found.companyId,
              event_id: found.id,
              occurred_at: found.occurredAt.toISOString(),
              kind: found.eventKind,
              channel: found.biller,
              amount_cents: found.amountCents,
              currency: found.currency,
              sku: (found.metadataJson as Record<string, unknown> | null)?.sku == null
                ? null
                : String((found.metadataJson as Record<string, unknown>).sku),
              source_ref: found.externalInvoiceId,
              agent_id: found.agentId,
            },
          };
        }
      }

      const inserted = await db
        .insert(financeEvents)
        .values({
          companyId: input.companyId,
          agentId: input.agentId ?? null,
          eventKind: input.kind,
          direction,
          biller: channel,
          amountCents: Math.trunc(input.amountCents),
          currency,
          occurredAt: input.occurredAt,
          externalInvoiceId: sourceRef,
          description: input.description ?? null,
          metadataJson,
        })
        .returning({
          id: financeEvents.id,
          companyId: financeEvents.companyId,
          occurredAt: financeEvents.occurredAt,
          eventKind: financeEvents.eventKind,
          biller: financeEvents.biller,
          amountCents: financeEvents.amountCents,
          currency: financeEvents.currency,
          externalInvoiceId: financeEvents.externalInvoiceId,
          agentId: financeEvents.agentId,
          metadataJson: financeEvents.metadataJson,
        });

      const row = inserted[0];
      if (!row) {
        throw new Error("finance_events insert returned no row");
      }

      return {
        created: true,
        row: {
          company_id: row.companyId,
          event_id: row.id,
          occurred_at: row.occurredAt.toISOString(),
          kind: row.eventKind,
          channel: row.biller,
          amount_cents: row.amountCents,
          currency: row.currency,
          sku: (row.metadataJson as Record<string, unknown> | null)?.sku == null
            ? null
            : String((row.metadataJson as Record<string, unknown>).sku),
          source_ref: row.externalInvoiceId,
          agent_id: row.agentId,
        },
      };
    },
  };

  async function assertWriteAccess(actor: Express.Request["actor"], companyId: string) {
    if (actor.type === "agent") {
      if (!actor.agentId || !actor.companyId) {
        throw forbidden("Finance write denied");
      }
      if (actor.companyId !== companyId) {
        throw forbidden("Agent can only write finance events for its own company");
      }
      return;
    }
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) {
        return;
      }
      const allowed = new Set(actor.companyIds ?? []);
      if (!allowed.has(companyId)) {
        throw forbidden("Finance write denied");
      }
      return;
    }
    throw forbidden("Finance write denied");
  }
}
