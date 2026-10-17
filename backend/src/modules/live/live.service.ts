import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { isOnboarded } from "../../db/repositories/users";
import { findInviteById, findInterviewRowById } from "../../db/repositories/interviews";
import {
    LIVE_MAX_INSTRUCTION_CHARS,
    LIVE_MAX_KICKOFF_CHARS,
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

/** What a browser presents at the socket handshake. Deliberately small. */
export interface LiveTicketClaims {
    _id: string;
    purpose: "live";
    mode: "practice" | "interview";
    inviteId?: string;
    /** The turn's question, so the relay can persist what was actually asked. */
    question: string;
    questionIndex: number;
    targetRole: string;
    instruction: string;
    kickoff: string;
}

export interface LiveSessionHandle {
    ticket: string;
    model: string;
    voice: string;
    path: string;
}

/**
 * Tickets are signed with a key derived from JWT_SECRET, not JWT_SECRET itself:
 * `authenticateToken` accepts anything signed with the shared secret and trusts
 * its `_id`, so a ticket signed directly would also open the REST API for its
 * lifetime. Deriving a separate key keeps the two capabilities disjoint.
 */
const ticketSecret = crypto.createHmac("sha256", env.JWT_SECRET).update("live-ticket").digest("hex");

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

export function mintLiveTicket(claims: Omit<LiveTicketClaims, "purpose">): string {
    return jwt.sign({ ...claims, purpose: "live" }, ticketSecret, { expiresIn: LIVE_TICKET_TTL_SECONDS });
}

export function verifyLiveTicket(token: string): LiveTicketClaims | null {
    if (!token) return null;
    try {
        const claims = jwt.verify(token, ticketSecret) as LiveTicketClaims;
        return claims.purpose === "live" ? claims : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Session context
// ---------------------------------------------------------------------------

/** The spoken-question turn that makes the model open the conversation. */
function buildInstruction(targetRole: string, question: string): string {
    return (
        `You are a warm, concise spoken interview coach running a ${targetRole} mock interview. ` +
        `Speak in natural sentences only: no markdown, no lists, no emoji. ` +
        `Ask one question at a time and stay quiet while the candidate answers. ` +
        `After each answer give at most two sentences of specific feedback, then ask the next question. ` +
        `The question for this turn is: "${question}"`
    ).slice(0, LIVE_MAX_INSTRUCTION_CHARS);
}

/** The spoken opener — what the candidate hears first, so it stays short. */
const KICKOFF = "Greet the candidate in one short sentence, then ask the question.".slice(
    0,
    LIVE_MAX_KICKOFF_CHARS,
);

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
    if (!env.GEMINI_API_KEY) {
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
        instruction: buildInstruction(targetRole, question),
        kickoff: KICKOFF,
    });

    return {
        status: 200,
        message: "Live session ready",
        data: { ticket, model: LIVE_MODEL, voice: LIVE_VOICE, path: LIVE_WS_PATH },
    };
}
