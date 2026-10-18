import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { candidateInvites, interviewSessions } from "../schema";
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
    const rows = await db.insert(interviewSessions).values(input).returning();
    return withId(rows[0]);
}

export async function findInterviewRowById(id: string): Promise<InterviewRow | null> {
    const rows = await db.select().from(interviewSessions).where(eq(interviewSessions.id, id)).limit(1);
    return rows[0] ?? null;
}

export async function updateInterviewSession(
    id: string,
    patch: Partial<Omit<InterviewRow, "id" | "createdAt">>,
) {
    const rows = await db
        .update(interviewSessions)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(interviewSessions.id, id))
        .returning();
    return rows[0] ? withId(rows[0]) : null;
}

/** Paginated list, optionally scoped to one organization. */
export async function listInterviewSessions(filter: {
    createdBy: string;
    organizationId?: string;
    skip: number;
    limit: number;
}): Promise<{ rows: InterviewRow[]; total: number }> {
    const where =
        filter.organizationId !== undefined
            ? and(
                  eq(interviewSessions.createdBy, filter.createdBy),
                  eq(interviewSessions.organizationId, filter.organizationId),
              )
            : eq(interviewSessions.createdBy, filter.createdBy);

    const all = await db
        .select()
        .from(interviewSessions)
        .where(where)
        .orderBy(desc(interviewSessions.createdAt));
    return { rows: all.slice(filter.skip, filter.skip + filter.limit), total: all.length };
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
    const rows = await db
        .insert(candidateInvites)
        .values({
            interviewId: input.interviewId,
            candidateId: input.candidateId,
            inviteToken: hashInviteToken(input.rawToken),
        })
        .returning();
    return withId(rows[0]);
}

export async function findInviteById(id: string): Promise<InviteRow | null> {
    const rows = await db.select().from(candidateInvites).where(eq(candidateInvites.id, id)).limit(1);
    return rows[0] ?? null;
}

/** Replaces `CandidateInvite.findByRawToken`. */
export async function findInviteByRawToken(rawToken: string): Promise<InviteRow | null> {
    const rows = await db
        .select()
        .from(candidateInvites)
        .where(eq(candidateInvites.inviteToken, hashInviteToken(rawToken)))
        .limit(1);
    return rows[0] ?? null;
}

export async function findExistingInvite(interviewId: string, candidateId: string) {
    const rows = await db
        .select()
        .from(candidateInvites)
        .where(
            and(
                eq(candidateInvites.interviewId, interviewId),
                eq(candidateInvites.candidateId, candidateId),
            ),
        )
        .limit(1);
    return rows[0] ?? null;
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
    const rows = await db
        .update(candidateInvites)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(candidateInvites.id, id))
        .returning();
    return rows[0] ? withId(rows[0]) : null;
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
 * One locked read-modify-write of an invite.
 *
 * Two writers rebuild `results` from the row they read, seconds apart: the live
 * relay records a scored answer while the candidate's "Next" posts to
 * `/api/interviews/candidate/submit`. Without a lock the later write overwrites
 * the other's fresh array with its own stale snapshot, silently dropping an
 * answer or a round transition. The row is selected `FOR UPDATE` inside a
 * transaction and the decision is made from that locked row, so the writers
 * serialize instead of racing.
 *
 * `decide` sees the row as it is inside the lock and returns the patch to write,
 * or a refusal carrying the HTTP status the caller should answer with.
 */
export async function mutateInvite<T = undefined>(
    id: string,
    decide: (invite: InviteRow) => InviteDecision<T> | Promise<InviteDecision<T>>,
): Promise<InviteMutationOutcome<T>> {
    return db.transaction(async (tx) => {
        const rows = await tx
            .select()
            .from(candidateInvites)
            .where(eq(candidateInvites.id, id))
            .for("update");
        const invite = rows[0];
        if (!invite) {
            return { invite: null, refused: { status: 404, message: "Invite not found" } };
        }

        const decision = await decide(invite);
        if (decision.kind === "refuse") {
            return { invite: null, refused: { status: decision.status, message: decision.message } };
        }

        const updated = await tx
            .update(candidateInvites)
            .set({ ...decision.patch, updatedAt: new Date() })
            .where(eq(candidateInvites.id, id))
            .returning();
        return { invite: withId(updated[0]), data: decision.data };
    });
}

export async function listInvitesForInterview(interviewId: string) {
    const rows = await db
        .select()
        .from(candidateInvites)
        .where(eq(candidateInvites.interviewId, interviewId))
        .orderBy(desc(candidateInvites.createdAt));
    const userMap = await findUsersByIds(rows.map((r) => r.candidateId));
    return rows.map((row) => ({
        ...withId(row),
        candidate: userMap.get(row.candidateId) ?? null,
    }));
}

export async function listInvitesForCandidate(candidateId: string, skip: number, limit: number) {
    const all = await db
        .select()
        .from(candidateInvites)
        .where(eq(candidateInvites.candidateId, candidateId))
        .orderBy(desc(candidateInvites.createdAt));
    return { rows: all.slice(skip, skip + limit), total: all.length };
}

export async function deleteInvitesForCandidate(candidateId: string) {
    await db.delete(candidateInvites).where(eq(candidateInvites.candidateId, candidateId));
}

export async function listInvitesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return db.select().from(candidateInvites).where(inArray(candidateInvites.id, ids));
}
