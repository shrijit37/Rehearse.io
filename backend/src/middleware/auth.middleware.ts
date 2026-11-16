import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { supabase } from "../db";
import { findUserById } from "../db/repositories/users";
import { resolveSessionUser, type SessionUser } from "../modules/auth/auth.service";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

/**
 * Cookies a Supabase session may arrive in. `sb-<ref>-auth-token` holds a JSON
 * session object; the others hold the raw access token. The legacy name is
 * accepted so an in-flight browser session is not stranded mid-migration.
 */
const SESSION_COOKIE_NAMES = ["sb-access-token", "supabase-auth-token", "better-auth.session_token"];

function tokenFromCookie(req: Request): string | null {
    const cookie = req.headers.cookie;
    if (!cookie) return null;
    for (const part of cookie.split(";")) {
        const [rawName, ...rest] = part.trim().split("=");
        const name = rawName ?? "";
        const value = rest.join("=");
        if (!value) continue;
        if (/^sb-.*-auth-token$/.test(name)) {
            try {
                const parsed = JSON.parse(decodeURIComponent(value)) as { access_token?: unknown };
                if (typeof parsed.access_token === "string") return parsed.access_token;
            } catch {
                /* not a Supabase JSON session cookie */
            }
        }
        if (SESSION_COOKIE_NAMES.includes(name)) return decodeURIComponent(value);
    }
    return null;
}

/**
 * Authenticates either an interview invite (Bearer JWT minted by the recruiter
 * flow, still the only credential a candidate has before signing up) or a
 * signed-in visitor whose Supabase Auth access token arrives as a Bearer or a
 * session cookie.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = await resolveUser(req);
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        (req as AuthenticatedRequest).user = { _id: user._id, role: user.role };
        next();
    } catch {
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
}

/** Returns the local user row behind whichever credential was presented. */
async function resolveUser(req: Request) {
    const bearer = req.headers.authorization;
    if (bearer) return await bearerUser(bearer);

    const token = tokenFromCookie(req);
    if (token) return await supabaseUser(token);
    return null;
}

/** Bearer is either a recruiter invite JWT or a Supabase access token. */
async function bearerUser(authorization: string) {
    const token = authorization.split(" ")[1];
    if (!token) return null;

    // Invite tokens are verified locally first — one less network hop, and
    // they are not valid Supabase tokens.
    try {
        const claims = jwt.verify(token, env.JWT_SECRET) as { _id: string; role: string };
        const user = await findUserById(claims._id);
        if (user && !user.isDeleted) return user;
    } catch {
        /* not an invite token — fall through to Supabase Auth */
    }
    return await supabaseUser(token);
}

/** Verifies a Supabase access token and maps it onto the local user row. */
async function supabaseUser(token: string) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;

    const authUser = data.user;
    const email = authUser.email;
    if (!email) return null;

    const sessionUser: SessionUser = {
        id: authUser.id,
        email,
        name:
            (authUser.user_metadata?.name as string | undefined) ??
            (authUser.user_metadata?.full_name as string | undefined) ??
            null,
    };
    return await resolveSessionUser(sessionUser);
}
