/**
 * Plain TS row shapes for the Supabase-backed data layer.
 *
 * These mirror the old Drizzle `$inferSelect` contracts exactly (camelCase
 * fields, `Date` timestamps) so services, controllers and the public HTTP
 * payloads do not change. The physical Postgres columns are snake_case — see
 * `supabase/migrations/0001_fleet_schema.sql` — and are translated at the
 * repository boundary by `db/mappers.ts`.
 */

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

/** One role in the candidate-maintained profile (users.experience). */
export interface ProfileExperience {
    title: string;
    company: string;
    period?: string;
    summary?: string;
}

/** One qualification in the candidate-maintained profile (users.education). */
export interface ProfileEducation {
    school: string;
    qualification?: string;
    period?: string;
}

/** What the resume read produces; every field optional so a partial read still lands. */
export interface ParsedProfile {
    headline?: string;
    location?: string;
    skills?: string[];
    experience?: ProfileExperience[];
    education?: ProfileEducation[];
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

export type UserRole = "recruiter" | "candidate";
export type OrgMemberRole = "admin" | "recruiter";
export type InterviewType = "behavioral" | "dsa" | "mixed";
export type InterviewStatus = "draft" | "active" | "closed";
export type DsaDifficulty = "easy" | "medium" | "hard" | "mixed";
export type InviteStatus = "pending" | "started" | "completed";
export type InviteRound = "behavioral" | "dsa" | "done";
export type RehearsalSessionType = "behavioral" | "dsa";
export type AuditAction =
    | "signup"
    | "login"
    | "onboard"
    | "account_delete"
    | "account_export"
    | "consent_update"
    | "interview_create"
    | "interview_invite"
    | "interview_start"
    | "interview_submit"
    | "org_create"
    | "org_update"
    | "org_member_invite"
    | "profile_update";

export interface UserRow {
    id: string;
    name: string;
    email: string;
    /** id of the matching Supabase Auth account. */
    authId: string | null;
    password: string | null;
    role: UserRole;
    organizationId: string | null;
    resumeName: string | null;
    resume: string | null;
    resumeUpdatedAt: Date | null;
    photo: string | null;
    audio: string | null;
    headline: string | null;
    location: string | null;
    skills: string[] | null;
    experience: ProfileExperience[] | null;
    education: ProfileEducation[] | null;
    resumeParsedAt: Date | null;
    consentGiven: boolean;
    consentDate: Date | null;
    consentVersion: string | null;
    onboardingCompleted: boolean;
    isInvitedPlaceholder: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrganizationRow {
    id: string;
    name: string;
    slug: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrganizationMemberRow {
    id: string;
    organizationId: string;
    userId: string;
    role: OrgMemberRole;
    joinedAt: Date;
}

export interface InterviewRow {
    id: string;
    organizationId: string;
    createdBy: string;
    title: string;
    targetRole: string;
    description: string;
    interviewType: InterviewType;
    questions: string[];
    dsaProblems: DsaProblem[];
    dsaDifficulty: DsaDifficulty;
    status: InterviewStatus;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface InviteRow {
    id: string;
    interviewId: string;
    candidateId: string;
    /** sha256 hex of the raw token. The raw token is returned once, never stored. */
    inviteToken: string;
    status: InviteStatus;
    currentRound: InviteRound;
    invitedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    results: ResultItem[];
    dsaResults: DsaResultItem[];
    createdAt: Date;
    updatedAt: Date;
}

export interface RehearsalRow {
    id: string;
    userId: string;
    targetRole: string;
    sessionType: RehearsalSessionType;
    results: ResultItem[];
    dsaResults: DsaResultItem[];
    createdAt: Date;
    updatedAt: Date;
}

export interface AuditRow {
    id: string;
    userId: string | null;
    action: AuditAction;
    details: string;
    metadata: Record<string, unknown> | null;
    /** sha256 hex of the client IP. Never the raw IP. */
    ipHash: string | null;
    createdAt: Date;
}
