import { desc, eq } from "drizzle-orm";
import { db } from "../index";
import { rehearsalSessions } from "../schema";
import { withId, type DsaResultItem, type RehearsalRow, type ResultItem } from "../shape";

export async function createRehearsalSession(input: {
    userId: string;
    targetRole: string;
    sessionType: "behavioral" | "dsa";
    results: ResultItem[];
    dsaResults: DsaResultItem[];
}) {
    const rows = await db.insert(rehearsalSessions).values(input).returning();
    return withId(rows[0]);
}

export async function listRehearsalSessions(userId: string, skip: number, limit: number) {
    const all = await db
        .select()
        .from(rehearsalSessions)
        .where(eq(rehearsalSessions.userId, userId))
        .orderBy(desc(rehearsalSessions.createdAt));
    return { rows: all.slice(skip, skip + limit), total: all.length };
}

export async function deleteRehearsalSessionsForUser(userId: string) {
    await db.delete(rehearsalSessions).where(eq(rehearsalSessions.userId, userId));
}
