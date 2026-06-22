ALTER TABLE "budget_policies"
ADD CONSTRAINT "budget_policies_metric_check"
CHECK ("metric" in ('billed_cents', 'runs', 'total_tokens'));--> statement-breakpoint
ALTER TABLE "budget_incidents"
ADD CONSTRAINT "budget_incidents_metric_check"
CHECK ("metric" in ('billed_cents', 'runs', 'total_tokens'));--> statement-breakpoint
CREATE INDEX "heartbeat_runs_company_agent_created_idx" ON "heartbeat_runs" USING btree ("company_id","agent_id","created_at");
