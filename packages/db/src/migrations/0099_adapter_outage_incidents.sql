CREATE UNIQUE INDEX IF NOT EXISTS "issues_active_adapter_outage_incident_uq"
ON "issues" USING btree ("company_id", "origin_kind", "origin_id")
WHERE "issues"."origin_kind" = 'adapter_outage_incident'
  AND "issues"."origin_id" IS NOT NULL
  AND "issues"."hidden_at" IS NULL
  AND "issues"."status" NOT IN ('done', 'cancelled');
