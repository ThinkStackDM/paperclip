CREATE TABLE IF NOT EXISTS "agent_fallback_sisters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "primary_agent_id" uuid NOT NULL,
  "sister_agent_id" uuid NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_fallback_sisters_company_id_companies_id_fk') THEN
    ALTER TABLE "agent_fallback_sisters" ADD CONSTRAINT "agent_fallback_sisters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_fallback_sisters_primary_agent_id_agents_id_fk') THEN
    ALTER TABLE "agent_fallback_sisters" ADD CONSTRAINT "agent_fallback_sisters_primary_agent_id_agents_id_fk" FOREIGN KEY ("primary_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_fallback_sisters_sister_agent_id_agents_id_fk') THEN
    ALTER TABLE "agent_fallback_sisters" ADD CONSTRAINT "agent_fallback_sisters_sister_agent_id_agents_id_fk" FOREIGN KEY ("sister_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_fallback_sisters_company_primary_idx" ON "agent_fallback_sisters" USING btree ("company_id","primary_agent_id","priority");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_fallback_sisters_company_sister_idx" ON "agent_fallback_sisters" USING btree ("company_id","sister_agent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_fallback_sisters_company_primary_sister_idx" ON "agent_fallback_sisters" USING btree ("company_id","primary_agent_id","sister_agent_id");
