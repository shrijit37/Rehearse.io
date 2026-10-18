import type { ResultItem } from "../../db/schema";
import { findInviteById, findInterviewRowById, mutateInvite } from "../../db/repositories/interviews";
import { saveSession } from "../rehearsal/rehearsal.service";
import { scoreAnswer, type AnswerScore } from "./live.scoring";
import type { LiveTicketClaims } from "./live.service";

/** One completed answer: what the candidate said, and what it was worth. */
export interface LiveTurn {
    /** Which question of the session this answered — the socket outlives a question. */
    questionIndex: number;
    question: string;
    transcription: string;
    score: number | null;
    feedback: string;
}

/**
 * The relay's only outside dependencies, injected at the composition root
 * (`live.upgrade.ts`) so the transport can be exercised without a database, a
 * scoring call, or a Google key.
 */
export interface LiveDeps {
    score(question: string, transcription: string): Promise<AnswerScore | null>;
    /**
     * The text of question `index`. Practice questions belong to the client (it
     * is handed them by `GET /api/rehearsal/start` and already sends them with
     * the ticket), so the relay only asks the database for an interview's.
     */
    resolveQuestion(claims: LiveTicketClaims, index: number): Promise<string | null>;
    /** Practice accumulates and writes once; an interview writes per turn. */
    recordTurn(claims: LiveTicketClaims, turn: LiveTurn): Promise<void>;
    /**
     * Writes the run's turns and resolves with the HTTP status the write ended
     * with (201 when stored). It deliberately does not log: `saveSession` reports
     * a failure in its message, and that message carries the statement and its
     * bound parameters — which are the candidate's transcripts.
     */
    finishPracticeSession(claims: LiveTicketClaims, turns: LiveTurn[]): Promise<number>;
}

/** What a turn looks like when scoring could not run — kept explicit, never invented. */
export const UNSCORED_FEEDBACK = "This answer could not be scored. Your transcript was saved.";

/**
 * Writes one answered turn onto the invite.
 *
 * The row shape matches what the retired batch evaluator wrote — same fields,
 * same replace-on-re-answer behaviour — so the recruiter views need no change.
 * It does not touch round or status transitions, which belong to
 * `submitInterviewAnswer`.
 */
async function recordInterviewTurn(claims: LiveTicketClaims, turn: LiveTurn): Promise<void> {
    if (!claims.inviteId) return;
    // What the locked transaction needs is read first, because it must stay on
    // one pooled connection (`DATABASE_POOL_MAX` is 10, and a transaction that
    // grabs a second connection under the row lock can starve the pool). An
    // interview's questions are authored content, not what the racing writers
    // mutate, so they are safe to read unlocked.
    const current = await findInviteById(claims.inviteId);
    if (!current) {
        console.warn("[live] refusing to persist a turn: the session is no longer open");
        return;
    }
    const interview = await findInterviewRowById(current.interviewId);
    const questions = interview?.questions ?? [];

    const outcome = await mutateInvite(claims.inviteId, (locked) => {
        // Re-checked against the locked row: the unlockable part of the decision
        // is only what was read above.
        if (locked.candidateId !== claims._id || locked.status !== "started") {
            return { kind: "refuse" as const, status: 409, message: "This session is no longer open" };
        }

        const results: ResultItem[] = [...locked.results];
        const record: ResultItem = {
            question: questions[turn.questionIndex] ?? turn.question,
            transcription: turn.transcription,
            score: turn.score,
            feedback: turn.feedback,
        };
        const existing = results.findIndex((r) => r.question === record.question);
        if (existing >= 0) results[existing] = record;
        else results.push(record);

        return { kind: "write" as const, patch: { results } };
    });
    if (!outcome.invite) {
        // The fixed event only: an invite id maps back to a candidate.
        console.warn("[live] refusing to persist a turn: the session is no longer open");
    }
}

export const liveDeps: LiveDeps = {
    score: scoreAnswer,
    recordTurn: recordInterviewTurn,

    async resolveQuestion(claims, index) {
        if (!claims.inviteId) return null;
        const invite = await findInviteById(claims.inviteId);
        if (!invite) return null;
        const interview = await findInterviewRowById(invite.interviewId);
        return interview?.questions?.[index] ?? null;
    },

    /** Practice mode's only persistence, at the end of the session — as before. */
    async finishPracticeSession(claims, turns) {
        const results: ResultItem[] = turns.map((turn) => ({
            question: turn.question,
            transcription: turn.transcription,
            score: turn.score,
            feedback: turn.feedback,
        }));
        if (results.length === 0) return 201;
        const saved = await saveSession(claims._id, {
            targetRole: claims.targetRole,
            sessionType: "behavioral",
            results,
        });
        return saved.status;
    },
};
