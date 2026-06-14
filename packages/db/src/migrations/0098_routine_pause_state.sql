ALTER TABLE "routines"
ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "routines"
ADD COLUMN "paused_at" timestamp with time zone;
