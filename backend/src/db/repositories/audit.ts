import { db } from "../index";
import { toDb, unwrap } from "../mappers";
import type { AuditAction } from "../schema";

export type { AuditAction };

export async function writeAuditLog(entry: {
    userId: string | null;
    action: AuditAction;
    details?: string;
    metadata?: Record<string, unknown>;
    /** sha256 hex of the client IP. Never the raw IP. */
    ipHash?: string | null;
}) {
    unwrap(
        await db
            .from("audit_logs")
            .insert(
                toDb("audit_logs", {
                    userId: entry.userId,
                    action: entry.action,
                    details: entry.details ?? "",
                    metadata: entry.metadata ?? {},
                    ipHash: entry.ipHash ?? null,
                }),
            )
            .select("id"),
    );
}
