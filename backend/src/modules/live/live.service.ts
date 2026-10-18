import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { isOnboarded } from "../../db/repositories/users";
import { findInviteById, findInterviewRowById } from "../../db/repositories/interviews";
import {
    LIVE_MAX_SESSIONS,
    LIVE_MODEL,
    LIVE_TICKET_TTL_SECONDS,
    LIVE_VOICE,
    LIVE_WS_PATH,
} from "./live.config";
import type { StartLiveSessionInput } from "./live.validation";

export interface ServiceResult<T = undefined> {
    status: number;
    message: string;
    data?: T;
}

/**
 * What a browser presents at the socket handshake. Deliberately small — and
 * deliberately plaintext-free: a JWT payload is base64, not encryption, so the
 * candidate can read every field. It carries the turn's question (they are about
 * to be asked it, and the relay persists what was actually asked) and nothing
 * else about the conversation: the coach's instruction and opener are rebuilt in
 * the relay from `targetRole` + `question` (see `live.config`), never handed to
 * the browser.
 */
export interface LiveTicketClaims {
    _id: string;
    purpose: "live";
    mode: "practice" | "interview";
    inviteId?: string;
    /** Single-use id: a ticket is a bearer value for 60 s, so it is spent at the handshake. */
    jti: string;
    /** The turn's question, so the relay can persist what was actually asked. */
    question: string;
    questionIndex: number;
    targetRole: string;
}

export interface LiveSessionHandle {
    ticket: string;
    model: string;
    voice: string;
    path: string;
}

/**
 * Live tickets are signed with their own secret — not `JWT_SECRET`, and not a
 * key derived from it: `authenticateToken` accepts anything signed with the
 * shared secret and trusts its `_id`, so a ticket signed with a derivation of
 * it would be one refactor away from also opening the REST API. A dedicated
 * secret makes the two capabilities disjoint by configuration.
 */
export function liveConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY && env.LIVE_TICKET_SECRET);
}

// ---------------------------------------------------------------------------
// Slot registry — the free-tier ceiling is the binding constraint, not rate.
// ---------------------------------------------------------------------------

const activeSessions = new Set<string>();

/** Returns the session id that must be passed back to `releaseLiveSlot`, or null when full. */
export function reserveLiveSlot(): string | null {
    if (activeSessions.size >= LIVE_MAX_SESSIONS) return null;
    const id = crypto.randomUUID();
    activeSessions.add(id);
    return id;
}

export function releaseLiveSlot(id: string): void {
    activeSessions.delete(id);
}

export function liveSessionCount(): number {
    return activeSessions.size;
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export function mintLiveTicket(claims: Omit<LiveTicketClaims, "purpose" | "jti">): string {
    const secret = env.LIVE_TICKET_SECRET;
    if (!secret || !env.GEMINI_API_KEY) {
        // Unreachable through `startLiveSession`, which refuses first; loud here
        // because a silent empty-secret signature would verify against itself.
        throw new Error("Live sessions are not configured (LIVE_TICKET_SECRET / GEMINI_API_KEY missing).");
    }
    return jwt.sign(
        { ...claims, purpose: "live", jti: crypto.randomUUID() },
        secret,
        { expiresIn: LIVE_TICKET_TTL_SECONDS },
    );
}

/**
 * Tickets spent since the process started, keyed by their id. A ticket is a
 * bearer value with a 60 s life, so replaying it would open a second upstream
 * session and a second slot for one answer; consuming it at the handshake makes
 * it a one-shot credential.
 */
const spentTickets = new Map<string, number>();

/** True the first time an id is seen, false afterwards. */
export function consumeLiveTicket(id: string): boolean {
    const now = Date.now();
    for (const [seen, at] of spentTickets) {
        if (now - at > LIVE_TICKET_TTL_SECONDS * 1000) spentTickets.delete(seen);
    }
    if (spentTickets.has(id)) return false;
    spentTickets.set(id, now);
    return true;
}

export function verifyLiveTicket(token: string): LiveTicketClaims | null {
    const secret = env.LIVE_TICKET_SECRET;
    if (!token || !secret) return null;
    try {
        const claims = jwt.verify(token, secret) as LiveTicketClaims;
        return claims.purpose === "live" ? claims : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Session context
// ---------------------------------------------------------------------------

/**
 * Resolves who is asking, whether they may, and what the model should be told.
 *
 * One route serves both flows, so the mode-specific rules live here rather than
 * in middleware: defence in depth on the question text as well, since the
 * invited flow must never take its questions from the caller.
 */
export async function startLiveSession(
    userId: string,
    input: StartLiveSessionInput,
): Promise<ServiceResult<LiveSessionHandle>> {
    if (!liveConfigured()) {
        return { status: 503, message: "Voice sessions are not configured on this server." };
    }

    let question: string;
    let targetRole = input.targetRole;

    if (input.mode === "practice") {
        if (!(await isOnboarded(userId))) {
            return { status: 403, message: "Please complete onboarding first." };
        }
        if (input.questions.length === 0) {
            return { status: 400, message: "No questions provided for this practice session." };
        }
        question = input.questions[input.questionIndex] ?? input.questions[0]!;
    } else {
        if (!input.inviteId) {
            return { status: 400, message: "An inviteId is required for an interview session." };
        }
        const invite = await findInviteById(input.inviteId);
        if (!invite || invite.candidateId !== userId) {
            return { status: 403, message: "This interview invite does not belong to you." };
        }
        // Every existing candidate path requires `started` (evaluateAnswer,
        // submitAnswer, evaluateDsa); accepting the invite is what moves it
        // there. Letting `pending` through would open a session for an
        // interview the candidate never began.
        if (invite.status === "pending") {
            return { status: 409, message: "Accept this interview invite before starting a session." };
        }
        if (invite.status === "completed") {
            return { status: 409, message: "This interview is already complete." };
        }
        const interview = await findInterviewRowById(invite.interviewId);
        if (!interview) {
            return { status: 404, message: "Interview not found." };
        }
        const questions = interview.questions ?? [];
        if (questions.length === 0) {
            return { status: 400, message: "This interview has no questions." };
        }
        // The index is bounded by the schema but only against the maximum list
        // size; falling back to question 0 here would ask — and later score —
        // the wrong question.
        if (input.questionIndex >= questions.length) {
            return { status: 400, message: "This interview has no question at that position." };
        }
        question = questions[input.questionIndex]!;
        targetRole = interview.targetRole;
    }

    // Fast path only: the authoritative reservation happens when the socket
    // opens, because a ticket can be minted and never used.
    if (liveSessionCount() >= LIVE_MAX_SESSIONS) {
        return { status: 503, message: "All coaches are busy right now. Try again in a moment." };
    }

    const ticket = mintLiveTicket({
        _id: userId,
        mode: input.mode,
        inviteId: input.inviteId,
        question,
        questionIndex: input.questionIndex,
        targetRole,
    });

    return {
        status: 200,
        message: "Live session ready",
        data: { ticket, model: LIVE_MODEL, voice: LIVE_VOICE, path: LIVE_WS_PATH },
    };
}
