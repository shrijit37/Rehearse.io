/**
 * Postgres schema (Drizzle). Replaces the Mongoose models.
 *
 * IDs are UUIDs (platform standard). The HTTP layer exposes every row's `id`
 * as `_id` and reassembles Mongoose-style `populate()` objects, so the
 * frontend contract is unchanged by this migration.
 */
import {
    boolean,
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["recruiter", "candidate"]);
export const orgMemberRole = pgEnum("org_member_role", ["admin", "recruiter"]);
export const interviewType = pgEnum("interview_type", ["behavioral", "dsa", "mixed"]);
export const interviewStatus = pgEnum("interview_status", ["draft", "active", "closed"]);
export const dsaDifficulty = pgEnum("dsa_difficulty", ["easy", "medium", "hard", "mixed"]);
export const inviteStatus = pgEnum("invite_status", ["pending", "started", "completed"]);
export const inviteRound = pgEnum("invite_round", ["behavioral", "dsa", "done"]);
export const rehearsalSessionType = pgEnum("rehearsal_session_type", ["behavioral", "dsa"]);
export const auditAction = pgEnum("audit_action", [
    "signup",
    "login",
    "onboard",
    "account_delete",
    "account_export",
    "consent_update",
    "interview_create",
    "interview_invite",
    "interview_start",
    "interview_submit",
    "org_create",
    "org_update",
    "org_member_invite",
    "profile_update",
]);

/** Shape stored in candidate_invites.results / rehearsal_sessions.results. */
export interface ResultItem {
    question: string;
    transcription: string;
    score: number | null;
    feedback: string;
}

/** Shape stored in *.dsa_results. */
export interface DsaResultItem {
    problemId: string;
    problemTitle: string;
    problemIndex: number;
    language: string;
    code: string;
    score: number | null;
    correctness: number | null;
    codeQuality: number | null;
    timeComplexity: string;
    spaceComplexity: string;
    feedback: string;
    strengths: string[];
    improvements: string[];
    timeSpentSeconds: number;
}

/** Shape stored in interview_sessions.dsa_problems. */
export interface DsaProblem {
    /** Client-supplied or generated identifier. Optional on input. */
    id?: string;
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    constraints: string;
    examples: Array<{ input: string; output: string; explanation: string }>;
    topics: string[];
    expectedApproach: string;
    starterCode?: {
        python?: string;
        javascript?: string;
        java?: string;
        cpp?: string;
    };
}

export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: varchar("name", { length: 100 }).notNull(),
        email: varchar("email", { length: 255 }).notNull(),
        /** id of the matching account on the shared auth service. */
        authId: text("auth_id"),
        /** Always null now that sign-in lives on the shared auth service. */
        password: text("password"),
        role: userRole("role").notNull().default("candidate"),
        organizationId: uuid("organization_id"),
        resumeName: text("resume_name"),
        /** base64 PII, encrypted at rest when ENCRYPTION_KEY is set. */
        resume: text("resume"),
        photo: text("photo"),
        audio: text("audio"),
        consentGiven: boolean("consent_given").notNull().default(false),
        consentDate: timestamp("consent_date", { withTimezone: true }),
        consentVersion: varchar("consent_version", { length: 32 }),
        onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
        /** Auto-created from a candidate invite, not yet claimed via signup. */
        isInvitedPlaceholder: boolean("is_invited_placeholder").notNull().default(false),
        isDeleted: boolean("is_deleted").notNull().default(false),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("users_email_key").on(table.email),
        uniqueIndex("users_auth_id_key").on(table.authId),
        index("users_organization_idx").on(table.organizationId),
    ],
);

export const organizations = pgTable(
    "organizations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: varchar("name", { length: 200 }).notNull(),
        slug: varchar("slug", { length: 200 }).notNull(),
        createdBy: uuid("created_by")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [uniqueIndex("organizations_slug_key").on(table.slug)],
);

/**
 * Was an embedded `members` array on the organization document. Normalized so
 * membership lookups are indexed and the user FK is enforced.
 */
export const organizationMembers = pgTable(
    "organization_members",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        role: orgMemberRole("role").notNull().default("recruiter"),
        joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("organization_members_org_user_key").on(table.organizationId, table.userId),
        index("organization_members_user_idx").on(table.userId),
    ],
);

export const interviewSessions = pgTable(
    "interview_sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        createdBy: uuid("created_by")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        title: varchar("title", { length: 300 }).notNull(),
        targetRole: varchar("target_role", { length: 200 }).notNull(),
        description: text("description").notNull().default(""),
        interviewType: interviewType("interview_type").notNull().default("behavioral"),
        questions: text("questions").array().notNull().default([]),
        dsaProblems: jsonb("dsa_problems").$type<DsaProblem[]>().notNull().default([]),
        dsaDifficulty: dsaDifficulty("dsa_difficulty").notNull().default("medium"),
        status: interviewStatus("status").notNull().default("draft"),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("interview_sessions_org_status_idx").on(table.organizationId, table.status),
        index("interview_sessions_created_by_idx").on(table.createdBy),
    ],
);

export const candidateInvites = pgTable(
    "candidate_invites",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        interviewId: uuid("interview_id")
            .notNull()
            .references(() => interviewSessions.id, { onDelete: "cascade" }),
        candidateId: uuid("candidate_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        /** sha256 hex of the raw token. The raw token is returned once, never stored. */
        inviteToken: varchar("invite_token", { length: 64 }).notNull(),
        status: inviteStatus("status").notNull().default("pending"),
        currentRound: inviteRound("current_round").notNull().default("behavioral"),
        invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
        startedAt: timestamp("started_at", { withTimezone: true }),
        completedAt: timestamp("completed_at", { withTimezone: true }),
        results: jsonb("results").$type<ResultItem[]>().notNull().default([]),
        dsaResults: jsonb("dsa_results").$type<DsaResultItem[]>().notNull().default([]),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("candidate_invites_token_key").on(table.inviteToken),
        index("candidate_invites_interview_status_idx").on(table.interviewId, table.status),
        index("candidate_invites_candidate_idx").on(table.candidateId),
    ],
);

export const rehearsalSessions = pgTable(
    "rehearsal_sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        targetRole: varchar("target_role", { length: 200 }).notNull().default("Software Engineer"),
        sessionType: rehearsalSessionType("session_type").notNull().default("behavioral"),
        results: jsonb("results").$type<ResultItem[]>().notNull().default([]),
        dsaResults: jsonb("dsa_results").$type<DsaResultItem[]>().notNull().default([]),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index("rehearsal_sessions_user_idx").on(table.userId)],
);

export const auditLogs = pgTable(
    "audit_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
        action: auditAction("action").notNull(),
        details: text("details").notNull().default(""),
        metadata: jsonb("metadata").$type<Record<string, unknown>>(),
        /** sha256 hex of the client IP. Never the raw IP. */
        ipHash: varchar("ip_hash", { length: 64 }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("audit_logs_user_created_idx").on(table.userId, table.createdAt),
        index("audit_logs_action_idx").on(table.action),
    ],
);
