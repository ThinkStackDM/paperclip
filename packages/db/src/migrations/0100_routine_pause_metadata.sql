ALTER TABLE "routines"
ADD COLUMN "pause_reason" text,
ADD COLUMN "paused_at" timestamp with time zone;
