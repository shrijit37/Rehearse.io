import { db } from "../index";
import { auditLogs } from "../schema";

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

export async function writeAuditLog(entry: {
    userId: string | null;
    action: AuditAction;
    details?: string;
    metadata?: Record<string, unknown>;
    /** sha256 hex of the client IP. Never the raw IP. */
    ipHash?: string | null;
}) {
    await db.insert(auditLogs).values({
        userId: entry.userId,
        action: entry.action,
        details: entry.details ?? "",
        metadata: entry.metadata ?? {},
        ipHash: entry.ipHash ?? null,
    });
}
