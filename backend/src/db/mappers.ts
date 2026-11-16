/**
 * Translation between the camelCase row shapes used by services and the
 * snake_case physical columns in Supabase/Postgres.
 *
 * Drizzle used to do this implicitly. supabase-js speaks the database column
 * names directly, so the boundary is explicit here. `fromDb` also restores
 * `Date` objects for timestamp columns to preserve the old `$inferSelect`
 * contract; `toDb` serialises `Date` values back to ISO strings.
 */
import type {
    AuditRow,
    InterviewRow,
    InviteRow,
    OrganizationMemberRow,
    OrganizationRow,
    RehearsalRow,
    UserRow,
} from "./schema";

/** camelCase service field -> physical Postgres column, per table. */
export const TABLE_FIELDS = {
    users: {
        id: "id",
        name: "name",
        email: "email",
        authId: "auth_id",
        password: "password",
        role: "role",
        organizationId: "organization_id",
        resumeName: "resume_name",
        resume: "resume",
        resumeUpdatedAt: "resume_updated_at",
        photo: "photo",
        audio: "audio",
        headline: "headline",
        location: "location",
        skills: "skills",
        experience: "experience",
        education: "education",
        resumeParsedAt: "resume_parsed_at",
        consentGiven: "consent_given",
        consentDate: "consent_date",
        consentVersion: "consent_version",
        onboardingCompleted: "onboarding_completed",
        isInvitedPlaceholder: "is_invited_placeholder",
        isDeleted: "is_deleted",
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
    organizations: {
        id: "id",
        name: "name",
        slug: "slug",
        createdBy: "created_by",
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
    organization_members: {
        id: "id",
        organizationId: "organization_id",
        userId: "user_id",
        role: "role",
        joinedAt: "joined_at",
    },
    interview_sessions: {
        id: "id",
        organizationId: "organization_id",
        createdBy: "created_by",
        title: "title",
        targetRole: "target_role",
        description: "description",
        interviewType: "interview_type",
        questions: "questions",
        dsaProblems: "dsa_problems",
        dsaDifficulty: "dsa_difficulty",
        status: "status",
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
    candidate_invites: {
        id: "id",
        interviewId: "interview_id",
        candidateId: "candidate_id",
        inviteToken: "invite_token",
        status: "status",
        currentRound: "current_round",
        invitedAt: "invited_at",
        startedAt: "started_at",
        completedAt: "completed_at",
        results: "results",
        dsaResults: "dsa_results",
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
    rehearsal_sessions: {
        id: "id",
        userId: "user_id",
        targetRole: "target_role",
        sessionType: "session_type",
        results: "results",
        dsaResults: "dsa_results",
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
    audit_logs: {
        id: "id",
        userId: "user_id",
        action: "action",
        details: "details",
        metadata: "metadata",
        ipHash: "ip_hash",
        createdAt: "created_at",
    },
} as const;

export type TableName = keyof typeof TABLE_FIELDS;

const DATE_FIELDS = new Set<string>([
    "resumeUpdatedAt",
    "resumeParsedAt",
    "consentDate",
    "deletedAt",
    "createdAt",
    "updatedAt",
    "joinedAt",
    "expiresAt",
    "invitedAt",
    "startedAt",
    "completedAt",
]);

type DbRow = Record<string, unknown>;

/** supabase-js returns errors in the result instead of throwing; restore the old behaviour. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
    if (result.error) throw new Error(result.error.message);
    return result.data as T;
}

function asDate(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    return value instanceof Date ? value : new Date(String(value));
}

/** Convert a PostgREST row (snake_case, ISO timestamps) to the service shape. */
export function fromDb<T>(table: TableName, row: DbRow): T {
    const fields = TABLE_FIELDS[table];
    const out: DbRow = {};
    for (const camel of Object.keys(fields) as Array<keyof typeof fields>) {
        const column = fields[camel];
        const value = row[column];
        if (value === undefined) continue;
        out[camel] = DATE_FIELDS.has(camel) ? asDate(value) : value;
    }
    return out as T;
}

/** Convert a service-shaped patch/insert to physical Postgres columns. */
export function toDb(table: TableName, value: Record<string, unknown>): DbRow {
    const fields = TABLE_FIELDS[table];
    const out: DbRow = {};
    for (const camel of Object.keys(fields) as Array<keyof typeof fields>) {
        const raw = value[camel];
        if (raw === undefined) continue;
        out[fields[camel]] = raw instanceof Date ? raw.toISOString() : raw;
    }
    return out;
}

/** Typed read helpers, one per table. */
export const read = {
    user: (row: DbRow) => fromDb<UserRow>("users", row),
    organization: (row: DbRow) => fromDb<OrganizationRow>("organizations", row),
    member: (row: DbRow) => fromDb<OrganizationMemberRow>("organization_members", row),
    interview: (row: DbRow) => fromDb<InterviewRow>("interview_sessions", row),
    invite: (row: DbRow) => fromDb<InviteRow>("candidate_invites", row),
    rehearsal: (row: DbRow) => fromDb<RehearsalRow>("rehearsal_sessions", row),
    audit: (row: DbRow) => fromDb<AuditRow>("audit_logs", row),
};
