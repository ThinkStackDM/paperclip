ALTER TABLE "companies"
ADD COLUMN "activity_window" jsonb;--> statement-breakpoint
ALTER TABLE "companies"
ADD COLUMN "activity_window_state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "companies"
ADD COLUMN "run_pause_state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings"
ADD COLUMN "run_controls" jsonb DEFAULT '{}'::jsonb NOT NULL;
