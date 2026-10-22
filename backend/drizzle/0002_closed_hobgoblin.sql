ALTER TABLE "users" ADD COLUMN "resume_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "skills" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "experience" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "education" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "resume_parsed_at" timestamp with time zone;