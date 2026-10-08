CREATE TYPE "public"."audit_action" AS ENUM('signup', 'login', 'onboard', 'account_delete', 'account_export', 'consent_update', 'interview_create', 'interview_invite', 'interview_start', 'interview_submit', 'org_create', 'org_update', 'org_member_invite', 'profile_update');--> statement-breakpoint
CREATE TYPE "public"."dsa_difficulty" AS ENUM('easy', 'medium', 'hard', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('draft', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('behavioral', 'dsa', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."invite_round" AS ENUM('behavioral', 'dsa', 'done');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'started', 'completed');--> statement-breakpoint
CREATE TYPE "public"."org_member_role" AS ENUM('admin', 'recruiter');--> statement-breakpoint
CREATE TYPE "public"."rehearsal_session_type" AS ENUM('behavioral', 'dsa');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('recruiter', 'candidate');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"metadata" jsonb,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"invite_token" varchar(64) NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"current_round" "invite_round" DEFAULT 'behavioral' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dsa_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"target_role" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"interview_type" "interview_type" DEFAULT 'behavioral' NOT NULL,
	"questions" text[] DEFAULT '{}' NOT NULL,
	"dsa_problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dsa_difficulty" "dsa_difficulty" DEFAULT 'medium' NOT NULL,
	"status" "interview_status" DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_member_role" DEFAULT 'recruiter' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehearsal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_role" varchar(200) DEFAULT 'Software Engineer' NOT NULL,
	"session_type" "rehearsal_session_type" DEFAULT 'behavioral' NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dsa_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"role" "user_role" DEFAULT 'candidate' NOT NULL,
	"organization_id" uuid,
	"resume_name" text,
	"resume" text,
	"photo" text,
	"audio" text,
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_date" timestamp with time zone,
	"consent_version" varchar(32),
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"is_invited_placeholder" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD CONSTRAINT "candidate_invites_interview_id_interview_sessions_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_invites" ADD CONSTRAINT "candidate_invites_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsal_sessions" ADD CONSTRAINT "rehearsal_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_invites_token_key" ON "candidate_invites" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "candidate_invites_interview_status_idx" ON "candidate_invites" USING btree ("interview_id","status");--> statement-breakpoint
CREATE INDEX "candidate_invites_candidate_idx" ON "candidate_invites" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_org_status_idx" ON "interview_sessions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "interview_sessions_created_by_idx" ON "interview_sessions" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_key" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "rehearsal_sessions_user_idx" ON "rehearsal_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_organization_idx" ON "users" USING btree ("organization_id");