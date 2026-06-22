ALTER TABLE "companies"
ADD COLUMN "emergency_stop_state" jsonb DEFAULT '{}'::jsonb NOT NULL;
