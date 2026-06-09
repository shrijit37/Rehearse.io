import crypto from "crypto";
import AuditLog from "../db/AuditLog.js";

/**
 * Hashes an IP address for audit logging (never store raw IPs).
 */
function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Logs an auditable action. Call directly in controllers:
 *   await logAudit({ userId, action, details, req })
 */
export async function logAudit({ userId = null, action, details = "", req = null, metadata = {} }) {
  try {
    let ipHash = null;
    if (req) {
      const rawIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
      ipHash = hashIp(rawIp.split(",")[0].trim());
    }

    await AuditLog.create({
      user: userId,
      action,
      details,
      metadata,
      ipHash,
    });
  } catch (err) {
    // Audit logging should never crash the request
    console.error("Audit log error:", err.message);
  }
}
