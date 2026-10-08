import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { candidateInvites, interviewSessions } from "../schema";
import { withId, type DsaResultItem, type InviteRow, type InterviewRow, type ResultItem } from "../shape";
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
