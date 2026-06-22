ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "parent_company_id" uuid;--> statement-breakpoint
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1
  FROM pg_constraint
  WHERE conname = 'companies_parent_company_id_companies_id_fk'
 ) THEN
  ALTER TABLE "companies"
    ADD CONSTRAINT "companies_parent_company_id_companies_id_fk"
    FOREIGN KEY ("parent_company_id")
    REFERENCES "public"."companies"("id")
    ON DELETE set null
    ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_parent_company_id_idx" ON "companies" USING btree ("parent_company_id");--> statement-breakpoint

UPDATE "companies"
SET "parent_company_id" = 'e6361895-a6a4-438d-bb76-b17a0ad026cb'
WHERE "id" IN (
  'e7507bfa-ecfd-4dde-bd2a-7b19947ffdde',
  'baba1235-7f5b-4555-aed8-c06efa095125',
  '211e0f96-ecd2-4fe0-81f8-72059bc6ed46',
  '6d2c1656-dabd-4aa1-b45a-0f5aedea3092',
  'd71c9e82-1a4b-497f-9bbc-5b9dd028c367',
  'cefbbf68-0ca7-4383-967e-03bc1b037ae7'
)
AND COALESCE("parent_company_id", 'e6361895-a6a4-438d-bb76-b17a0ad026cb') <> 'e6361895-a6a4-438d-bb76-b17a0ad026cb';--> statement-breakpoint

UPDATE "agents"
SET "capabilities" = CASE
  WHEN "capabilities" IS NULL OR btrim("capabilities") = '' THEN 'portfolio_metrics:read'
  WHEN "capabilities" LIKE '%portfolio_metrics:read%' THEN "capabilities"
  ELSE "capabilities" || ', portfolio_metrics:read'
END
WHERE "id" = '4a9e1889-d079-4f07-820d-e77327e2ee4b';--> statement-breakpoint
