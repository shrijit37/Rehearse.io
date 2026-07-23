import crypto from "crypto";
import { env } from "../config/env";

const PREFIX = "enc:v1:";

function loadKey(): Buffer | null {
    const raw = env.ENCRYPTION_KEY;
    if (!raw) return null;
    let key: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        key = Buffer.from(raw, "hex");
    } else {
        key = Buffer.from(raw, "base64");
    }
    if (key.length !== 32) {
        console.error(
            "ENCRYPTION_KEY must decode to 32 bytes (use `openssl rand -hex 32`). PII encryption disabled."
        );
        return null;
    }
    return key;
}

const KEY = loadKey();

if (!KEY && env.APP_ENV === "production") {
    console.error(
        "WARNING: ENCRYPTION_KEY is not set in production. PII (resume/photo/audio) will be stored UNENCRYPTED."
    );
}

/**
 * Encrypt a plaintext string. Returns the original value unchanged when no key
 * is configured or the input is falsy / already encrypted.
 */
export function encryptField(plain: string | undefined | null): string | undefined | null {
    if (!plain || typeof plain !== "string") return plain;
    const key = KEY;
    if (!key) return plain;
    if (plain.startsWith(PREFIX)) return plain; // already encrypted
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plain, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value produced by encryptField. Returns the value unchanged when it
 * is not encrypted (plaintext / legacy data) or no key is configured.
 */
export function decryptField(value: string | undefined | null): string {
    if (!value || typeof value !== "string") return value || "";
    if (!value.startsWith(PREFIX)) return value; // plaintext / legacy
    const key = KEY;
    if (!key) {
        console.error("Cannot decrypt PII: ENCRYPTION_KEY is not configured.");
        return "";
    }
    try {
        const parts = value.slice(PREFIX.length).split(":");
        if (parts.length < 3) return "";
        const ivHex = parts[0] || "";
        const tagHex = parts[1] || "";
        const dataHex = parts[2] || "";
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(tagHex, "hex");
        const data = Buffer.from(dataHex, "hex");
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(data),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("Failed to decrypt PII field:", message);
        return "";
    }
}
