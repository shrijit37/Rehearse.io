import crypto from "crypto";
import type { Request } from "express";
import { writeAuditLog, type AuditAction } from "../db/repositories/audit";

/** Hashes the client IP so audit rows never store a raw address. */
function hashIp(ip: string): string | null {
    if (!ip) return null;
    return crypto.createHash("sha256").update(ip).digest("hex");
}

interface LogAuditParams {
    userId?: string | null;
    action: AuditAction;
    details?: string;
    req?: Request | null;
    metadata?: Record<string, unknown>;
}

export async function logAudit({
    userId = null,
    action,
    details = "",
    req = null,
    metadata = {},
}: LogAuditParams): Promise<void> {
    try {
        let ipHash: string | null = null;
        if (req) {
            const xForwardedFor = req.headers["x-forwarded-for"];
            let rawIp = "";
            if (typeof xForwardedFor === "string") {
                rawIp = xForwardedFor;
            } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
                rawIp = xForwardedFor[0] || "";
            } else if (req.socket && req.socket.remoteAddress) {
                rawIp = req.socket.remoteAddress;
            }
            const firstIp = rawIp.split(",")[0] || "";
            ipHash = hashIp(firstIp.trim());
        }

        await writeAuditLog({ userId, action, details, metadata, ipHash });
    } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("Audit log error:", message);
    }
}
