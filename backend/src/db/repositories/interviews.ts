import crypto from "crypto";
import { db } from "../index";
import { read, toDb, unwrap } from "../mappers";
import { withId, type DsaResultItem, type InviteRow, type InterviewRow, type ResultItem, type WithId } from "../shape";
import { findUsersByIds } from "./users";

/** Hashes an invite token for storage/lookup. Raw tokens are never persisted. */
export function hashInviteToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// ---------------------------------------------------------------------------
// Interview sessions
// ---------------------------------------------------------------------------

export interface CreateInterviewInput {
    organizationId: string;
    createdBy: string;
    title: string;
    targetRole: string;
    description: string;
    interviewType: "behavioral" | "dsa" | "mixed";
    questions: string[];
    dsaProblems: InterviewRow["dsaProblems"];
    dsaDifficulty: "easy" | "medium" | "hard" | "mixed";
    expiresAt: Date;
    status: "draft" | "active" | "closed";
}

export async function createInterviewSession(input: CreateInterviewInput) {
    const rows = unwrap(
        await db.from("interview_sessions").insert(toDb("interview_sessions", { ...input })).select(),
    );
    return withId(read.interview(rows[0] as Record<string, unknown>));
}

export async function findInterviewRowById(id: string): Promise<InterviewRow | null> {
    const rows = unwrap(await db.from("interview_sessions").select("*").eq("id", id).limit(1));
    return rows[0] ? read.interview(rows[0] as Record<string, unknown>) : null;
}

export async function updateInterviewSession(
    id: string,
    patch: Partial<Omit<InterviewRow, "id" | "createdAt">>,
) {
    const rows = unwrap(
        await db
            .from("interview_sessions")
            .update(toDb("interview_sessions", { ...patch, updatedAt: new Date() }))
            .eq("id", id)
            .select(),
    );
    return rows[0] ? withId(read.interview(rows[0] as Record<string, unknown>)) : null;
}

/** Paginated list, optionally scoped to one organization. */
export async function listInterviewSessions(filter: {
    createdBy: string;
    organizationId?: string;
    skip: number;
    limit: number;
}): Promise<{ rows: InterviewRow[]; total: number }> {
    let query = db.from("interview_sessions").select("*").eq("created_by", filter.createdBy);
    if (filter.organizationId !== undefined) {
        query = query.eq("organization_id", filter.organizationId);
    }
    const all = unwrap(await query.order("created_at", { ascending: false }));
    const rows = all.map((row) => read.interview(row as Record<string, unknown>));
    return { rows: rows.slice(filter.skip, filter.skip + filter.limit), total: rows.length };
}

// ---------------------------------------------------------------------------
// Candidate invites
// ---------------------------------------------------------------------------

export async function createInvite(input: {
    interviewId: string;
    candidateId: string;
    /** Raw token; hashed here before it ever reaches the database. */
    rawToken: string;
}) {
    const rows = unwrap(
        await db
            .from("candidate_invites")
            .insert(
                toDb("candidate_invites", {
                    interviewId: input.interviewId,
                    candidateId: input.candidateId,
                    inviteToken: hashInviteToken(input.rawToken),
                }),
            )
            .select(),
    );
    return withId(read.invite(rows[0] as Record<string, unknown>));
}

export async function findInviteById(id: string): Promise<InviteRow | null> {
    const rows = unwrap(await db.from("candidate_invites").select("*").eq("id", id).limit(1));
    return rows[0] ? read.invite(rows[0] as Record<string, unknown>) : null;
}

/** Replaces `CandidateInvite.findByRawToken`. */
export async function findInviteByRawToken(rawToken: string): Promise<InviteRow | null> {
    const rows = unwrap(
        await db
            .from("candidate_invites")
            .select("*")
            .eq("invite_token", hashInviteToken(rawToken))
            .limit(1),
    );
    return rows[0] ? read.invite(rows[0] as Record<string, unknown>) : null;
}

export async function findExistingInvite(interviewId: string, candidateId: string) {
    const rows = unwrap(
        await db
            .from("candidate_invites")
            .select("*")
            .eq("interview_id", interviewId)
            .eq("candidate_id", candidateId)
            .limit(1),
    );
    return rows[0] ? read.invite(rows[0] as Record<string, unknown>) : null;
}

export type InvitePatch = Partial<{
    status: "pending" | "started" | "completed";
    currentRound: "behavioral" | "dsa" | "done";
    startedAt: Date | null;
    completedAt: Date | null;
    results: ResultItem[];
    dsaResults: DsaResultItem[];
}>;

export async function updateInvite(id: string, patch: InvitePatch) {
    const rows = unwrap(
        await db
            .from("candidate_invites")
            .update(toDb("candidate_invites", { ...patch, updatedAt: new Date() }))
            .eq("id", id)
            .select(),
    );
    return rows[0] ? withId(read.invite(rows[0] as Record<string, unknown>)) : null;
}

export type InviteDecision<T = undefined> =
    | { kind: "write"; patch: InvitePatch; data?: T }
    | { kind: "refuse"; status: number; message: string };

export interface InviteMutationOutcome<T> {
    /** The persisted row, when the write applied. */
    invite: WithId<InviteRow> | null;
    /** What the decision computed alongside the patch, when the write applied. */
    data?: T;
    /** The refusal to answer with, when it did not. */
    refused?: { status: number; message: string };
}

/**
 * One read-modify-write of an invite.
 *
 * The old implementation held `SELECT ... FOR UPDATE` inside a Postgres
 * transaction to serialize two concurrent writers (the live relay and the
 * candidate submit endpoint). supabase-js talks HTTP and cannot hold a row
 * lock across requests, so this is now a non-atomic read-then-write. The
 * decision callback still sees the current row and the write still carries the
 * full rebuilt array; the residual risk is a lost update under a genuine race,
 * which is documented here rather than hidden.
 */
export async function mutateInvite<T = undefined>(
    id: string,
    decide: (invite: InviteRow) => InviteDecision<T> | Promise<InviteDecision<T>>,
): Promise<InviteMutationOutcome<T>> {
    const rows = unwrap(await db.from("candidate_invites").select("*").eq("id", id).limit(1));
    const invite = rows[0] ? read.invite(rows[0] as Record<string, unknown>) : null;
    if (!invite) {
        return { invite: null, refused: { status: 404, message: "Invite not found" } };
    }

    const decision = await decide(invite);
    if (decision.kind === "refuse") {
        return { invite: null, refused: { status: decision.status, message: decision.message } };
    }

    const updated = unwrap(
        await db
            .from("candidate_invites")
            .update(toDb("candidate_invites", { ...decision.patch, updatedAt: new Date() }))
            .eq("id", id)
            .select(),
    );
    return { invite: withId(read.invite(updated[0] as Record<string, unknown>)), data: decision.data };
}

export async function listInvitesForInterview(interviewId: string) {
    const rows = unwrap(
        await db
            .from("candidate_invites")
            .select("*")
            .eq("interview_id", interviewId)
            .order("created_at", { ascending: false }),
    );
    const invites = rows.map((row) => read.invite(row as Record<string, unknown>));
    const userMap = await findUsersByIds(invites.map((r) => r.candidateId));
    return invites.map((row) => ({
        ...withId(row),
        candidate: userMap.get(row.candidateId) ?? null,
    }));
}

export async function listInvitesForCandidate(candidateId: string, skip: number, limit: number) {
    const all = unwrap(
        await db
            .from("candidate_invites")
            .select("*")
            .eq("candidate_id", candidateId)
            .order("created_at", { ascending: false }),
    );
    const rows = all.map((row) => read.invite(row as Record<string, unknown>));
    return { rows: rows.slice(skip, skip + limit), total: rows.length };
}

export async function deleteInvitesForCandidate(candidateId: string) {
    unwrap(await db.from("candidate_invites").delete().eq("candidate_id", candidateId).select("id"));
}

export async function listInvitesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = unwrap(await db.from("candidate_invites").select("*").in("id", ids));
    return rows.map((row) => read.invite(row as Record<string, unknown>));
}
