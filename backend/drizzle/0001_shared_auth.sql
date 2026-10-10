ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_id_key" ON "users" USING btree ("auth_id");