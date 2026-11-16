import { db } from "../index";
import { read, toDb, unwrap } from "../mappers";
import { withId, type DsaResultItem, type RehearsalRow, type ResultItem } from "../shape";

export async function createRehearsalSession(input: {
    userId: string;
    targetRole: string;
    sessionType: "behavioral" | "dsa";
    results: ResultItem[];
    dsaResults: DsaResultItem[];
}) {
    const rows = unwrap(
        await db.from("rehearsal_sessions").insert(toDb("rehearsal_sessions", { ...input })).select(),
    );
    return withId(read.rehearsal(rows[0] as Record<string, unknown>));
}

export async function listRehearsalSessions(userId: string, skip: number, limit: number) {
    const all = unwrap(
        await db
            .from("rehearsal_sessions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
    );
    const rows = all.map((row) => read.rehearsal(row as Record<string, unknown>));
    return { rows: rows.slice(skip, skip + limit), total: rows.length };
}

export async function deleteRehearsalSessionsForUser(userId: string) {
    unwrap(await db.from("rehearsal_sessions").delete().eq("user_id", userId).select("id"));
}
