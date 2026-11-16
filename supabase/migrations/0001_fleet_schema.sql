-- Rehearse.io fleet schema for Supabase (PostgREST / GoTrue gateway).
--
-- The old Drizzle/pg data layer is gone: the API talks to this project over the
-- public HTTP gateway with the service-role key. Raw Postgres is private to the
-- Coolify network, so apply this migration with the Supabase dashboard/CLI
-- (not from the app container).
--
-- Idempotent: safe to re-run. The fleet project already owns an `organizations`
-- table, so that one is extended in place rather than replaced.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (mirror drizzle pgEnum definitions)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('recruiter', 'candidate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('admin', 'recruiter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.interview_type AS ENUM ('behavioral', 'dsa', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.interview_status AS ENUM ('draft', 'active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.dsa_difficulty AS ENUM ('easy', 'medium', 'hard', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.invite_status AS ENUM ('pending', 'started', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.invite_round AS ENUM ('behavioral', 'dsa', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.rehearsal_session_type AS ENUM ('behavioral', 'dsa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'signup', 'login', 'onboard', 'account_delete', 'account_export',
    'consent_update', 'interview_create', 'interview_invite',
    'interview_start', 'interview_submit', 'org_create', 'org_update',
    'org_member_invite', 'profile_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  auth_id text,
  password text,
  role public.user_role NOT NULL DEFAULT 'candidate',
  organization_id uuid,
  resume_name text,
  resume text,
  resume_updated_at timestamptz,
  photo text,
  audio text,
  headline text,
  location text,
  skills jsonb,
  experience jsonb,
  education jsonb,
  resume_parsed_at timestamptz,
  consent_given boolean NOT NULL DEFAULT false,
  consent_date timestamptz,
  consent_version varchar(32),
  onboarding_completed boolean NOT NULL DEFAULT false,
  is_invited_placeholder boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON public.users (auth_id);
CREATE INDEX IF NOT EXISTS users_organization_idx ON public.users (organization_id);

-- Fleet-owned table: extend, do not recreate.
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  slug varchar(200) NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON public.organizations (slug);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'recruiter',
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_user_key
  ON public.organization_members (organization_id, user_id);
CREATE INDEX IF NOT EXISTS organization_members_user_idx
  ON public.organization_members (user_id);

CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,
  target_role varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  interview_type public.interview_type NOT NULL DEFAULT 'behavioral',
  questions text[] NOT NULL DEFAULT '{}',
  dsa_problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  dsa_difficulty public.dsa_difficulty NOT NULL DEFAULT 'medium',
  status public.interview_status NOT NULL DEFAULT 'draft',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interview_sessions_org_status_idx
  ON public.interview_sessions (organization_id, status);
CREATE INDEX IF NOT EXISTS interview_sessions_created_by_idx
  ON public.interview_sessions (created_by);

CREATE TABLE IF NOT EXISTS public.candidate_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  invite_token varchar(64) NOT NULL,
  status public.invite_status NOT NULL DEFAULT 'pending',
  current_round public.invite_round NOT NULL DEFAULT 'behavioral',
  invited_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  dsa_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_invites_token_key
  ON public.candidate_invites (invite_token);
CREATE INDEX IF NOT EXISTS candidate_invites_interview_status_idx
  ON public.candidate_invites (interview_id, status);
CREATE INDEX IF NOT EXISTS candidate_invites_candidate_idx
  ON public.candidate_invites (candidate_id);

CREATE TABLE IF NOT EXISTS public.rehearsal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_role varchar(200) NOT NULL DEFAULT 'Software Engineer',
  session_type public.rehearsal_session_type NOT NULL DEFAULT 'behavioral',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  dsa_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rehearsal_sessions_user_idx
  ON public.rehearsal_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  details text NOT NULL DEFAULT '',
  metadata jsonb,
  ip_hash varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
  ON public.audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action);

-- ---------------------------------------------------------------------------
-- Permissive RLS. The service-role client bypasses RLS; these policies let the
-- publishable (anon) key and signed-in users exercise the same tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'organizations', 'organization_members', 'interview_sessions',
    'candidate_invites', 'rehearsal_sessions', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS rehearse_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY rehearse_all ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
