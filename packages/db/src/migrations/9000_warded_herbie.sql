ALTER TABLE "companies" ADD COLUMN "stranded_recovery_owner_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "companies"
ADD CONSTRAINT "companies_stranded_recovery_owner_agent_id_agents_id_fk"
FOREIGN KEY ("stranded_recovery_owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
