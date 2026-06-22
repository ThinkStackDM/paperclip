DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'plugin_entities_external_idx' AND c.relkind = 'i')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plugin_entities_external_idx') THEN
    EXECUTE 'DROP INDEX "plugin_entities_external_idx"';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "plugin_entities" ADD COLUMN IF NOT EXISTS "company_id" uuid;--> statement-breakpoint
ALTER TABLE "plugin_job_runs" ADD COLUMN IF NOT EXISTS "company_id" uuid;--> statement-breakpoint
ALTER TABLE "plugin_logs" ADD COLUMN IF NOT EXISTS "company_id" uuid;--> statement-breakpoint
ALTER TABLE "plugin_webhook_deliveries" ADD COLUMN IF NOT EXISTS "company_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plugin_entities_company_id_companies_id_fk') THEN
    ALTER TABLE "plugin_entities" ADD CONSTRAINT "plugin_entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plugin_job_runs_company_id_companies_id_fk') THEN
    ALTER TABLE "plugin_job_runs" ADD CONSTRAINT "plugin_job_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plugin_logs_company_id_companies_id_fk') THEN
    ALTER TABLE "plugin_logs" ADD CONSTRAINT "plugin_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plugin_webhook_deliveries_company_id_companies_id_fk') THEN
    ALTER TABLE "plugin_webhook_deliveries" ADD CONSTRAINT "plugin_webhook_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_entities_company_idx" ON "plugin_entities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_job_runs_company_idx" ON "plugin_job_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_logs_company_idx" ON "plugin_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_webhook_deliveries_company_idx" ON "plugin_webhook_deliveries" USING btree ("company_id");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plugin_entities_external_idx') THEN
    ALTER TABLE "plugin_entities" ADD CONSTRAINT "plugin_entities_external_idx" UNIQUE NULLS NOT DISTINCT("company_id","plugin_id","entity_type","external_id");
  END IF;
END $$;
