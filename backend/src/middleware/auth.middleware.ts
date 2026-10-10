import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { findUserById } from "../db/repositories/users";
import { resolveSessionUser, type SessionUser } from "../modules/auth/auth.service";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

// Both the secure and the insecure cookie name; crossSubDomainCookies issues the __Secure- one.
const SESSION_COOKIE = /better-auth\.session_token/;

/**
 * Authenticates either an interview invite (Bearer JWT minted by the recruiter
 * flow, still the only credential a candidate has before signing up) or a
 * signed-in visitor, whose session cookie lives on the shared auth service.
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
    if (bearer) return await inviteUser(bearer);
    return await sessionUser(req);
}

/** Recruiter-issued invite token. */
async function inviteUser(authorization: string) {
    const token = authorization.split(" ")[1];
    if (!token) return null;
    const claims = jwt.verify(token, env.JWT_SECRET) as { _id: string; role: string };
    const user = await findUserById(claims._id);
    if (!user || user.isDeleted) return null;
    return user;
}

/** Asks the shared auth service whether the session cookie is still valid. */
async function sessionUser(req: Request) {
    const cookie = req.headers.cookie;
    if (!cookie || !SESSION_COOKIE.test(cookie)) return null;

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
        response = await fetch(`${env.AUTH_URL}/api/auth/get-session`, {
            headers: { cookie },
            cache: "no-store",
        });
    } catch (err) {
        console.error(`[auth] ${env.AUTH_URL}/api/auth/get-session unreachable:`, err);
        return null;
    }
    if (!response.ok) {
        console.error(`[auth] get-session returned ${response.status}`);
        return null;
    }

    const data = (await response.json().catch(() => null)) as { user?: SessionUser } | null;
    if (!data?.user) return null;
    return await resolveSessionUser(data.user);
}