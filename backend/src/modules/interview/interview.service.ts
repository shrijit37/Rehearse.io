import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { findOrganizationRowById, findMembership } from "../../db/repositories/organizations";
import { createUser, findUserByEmail, findUsersByIds } from "../../db/repositories/users";
import {
    createInterviewSession,
    createInvite,
    findExistingInvite,
    findInterviewRowById,
    findInviteById,
    findInviteByRawToken,
    listInterviewSessions,
    listInvitesForCandidate,
    listInvitesForInterview,
    updateInterviewSession,
    updateInvite,
} from "../../db/repositories/interviews";
import { withId } from "../../db/shape";
import type { DsaResultItem, ResultItem } from "../../db/schema";
import {
    evaluateAudio,
    evaluateDsa as aiEvaluateDsa,
    generateDsaProblems,
} from "../../utils/aiClient";
import type {
    CreateInterviewInput,
    GenerateInviteInput,
    SubmitAnswerInput,
    EvaluateInterviewDsaInput,
    GenerateDsaInput,
} from "./interview.validation";

const JWT_SECRET = env.JWT_SECRET;

export interface InterviewResult {
    status: number;
    message: string;
    interview?: unknown;
    candidates?: unknown;
    invite?: unknown;
    token?: string;
    user?: unknown;
    data?: unknown;
    page?: number;
    limit?: number;
    total?: number;
}

/** Batch-loads interview rows for population. */
async function findInterviews(
    ids: string[],
): Promise<Map<string, Awaited<ReturnType<typeof findInterviewRowById>> & {}>> {
    const out = new Map<string, Awaited<ReturnType<typeof findInterviewRowById>> & {}>();
    await Promise.all(
        [...new Set(ids)].map(async (id) => {
            const row = await findInterviewRowById(id);
            if (row) out.set(id, row);
        }),
    );
    return out;
}

/** Batch-loads organizations, returning only the fields the UI renders. */
async function findOrganizations(
    ids: string[],
): Promise<Map<string, { _id: string; id: string; name: string; slug: string }>> {
    const out = new Map<string, { _id: string; id: string; name: string; slug: string }>();
    await Promise.all(
        [...new Set(ids)].map(async (id) => {
            const row = await findOrganizationRowById(id);
            if (row) out.set(id, { _id: row.id, id: row.id, name: row.name, slug: row.slug });
        }),
    );
    return out;
}

/** True when the id looks like a UUID. Replaces ObjectId.isValid(). */
const isValidId = (id: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const createInterview = async (userId: string, input: CreateInterviewInput): Promise<InterviewResult> => {
    try {
        if (!isValidId(input.organizationId)) {
            return { status: 400, message: "Valid organizationId is required" };
        }
        const org = await findOrganizationRowById(input.organizationId);
        if (!org) return { status: 404, message: "Organization not found" };

        const membership = await findMembership(input.organizationId, userId);
        if (!membership || !["admin", "recruiter"].includes(membership.role)) {
            return { status: 403, message: "Not authorized in this organization" };
        }

        const interview = await createInterviewSession({
            organizationId: input.organizationId,
            createdBy: userId,
            title: input.title.trim(),
            targetRole: input.targetRole.trim(),
            description: input.description || "",
            interviewType: input.interviewType,
            questions: input.questions.map((q) => q.trim()).filter(Boolean),
            dsaProblems: input.dsaProblems,
            dsaDifficulty: input.dsaDifficulty,
            expiresAt: new Date(input.expiresAt),
            status: input.status,
        });

        const populated = {
            ...interview,
            organization: { _id: org.id, id: org.id, name: org.name, slug: org.slug },
        };
        return { status: 201, message: "Interview session created", interview: populated };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const listInterviews = async (
    userId: string,
    organizationId: string | undefined,
    page: number,
    limit: number,
): Promise<InterviewResult> => {
    try {
        const skip = (page - 1) * limit;
        if (organizationId && !isValidId(organizationId)) {
            return { status: 400, message: "Invalid organizationId format" };
        }

        const { rows, total } = await listInterviewSessions({
            createdBy: userId,
            organizationId,
            skip,
            limit,
        });

        // Resolve organization references for the listed rows.
        const orgMap = await findOrganizations(rows.map((r) => r.organizationId));
        const data = rows.map((row) => ({
            ...withId(row),
            organization: orgMap.get(row.organizationId) ?? null,
        }));

        return { status: 200, message: "Interviews fetched", data, page, limit, total };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getInterview = async (userId: string, id: string): Promise<InterviewResult> => {
    try {
        if (!isValidId(id)) return { status: 400, message: "Invalid interview ID format" };

        const row = await findInterviewRowById(id);
        if (!row) return { status: 404, message: "Interview not found" };

        if (row.createdBy !== userId) {
            return { status: 403, message: "Access denied. You can only view interviews you created." };
        }

        const orgMap = await findOrganizations([row.organizationId]);
        const creatorMap = await findUsersByIds([row.createdBy]);
        const interview = {
            ...withId(row),
            organization: orgMap.get(row.organizationId) ?? null,
            createdBy: creatorMap.get(row.createdBy) ?? null,
        };

        const invites = await listInvitesForInterview(row.id);

        return { status: 200, message: "Interview fetched", interview, candidates: invites };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const updateInterview = async (userId: string, id: string, body: Record<string, unknown>): Promise<InterviewResult> => {
    try {
        if (!isValidId(id)) return { status: 400, message: "Invalid interview ID format" };
        const existing = await findInterviewRowById(id);
        if (!existing) return { status: 404, message: "Interview not found" };
        if (existing.createdBy !== userId) {
            return { status: 403, message: "Only the creator can update this interview" };
        }

        const patch: Record<string, unknown> = {};
        for (const field of [
            "title", "targetRole", "questions", "description", "status", "expiresAt",
            "interviewType", "dsaProblems", "dsaDifficulty",
        ]) {
            if (body[field] !== undefined) patch[field] = body[field];
        }
        const updated = await updateInterviewSession(id, patch);

        return { status: 200, message: "Interview updated", interview: updated };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const generateInvite = async (userId: string, id: string, input: GenerateInviteInput): Promise<InterviewResult> => {
    try {
        if (!isValidId(id)) return { status: 400, message: "Invalid interview ID format" };
        const interview = await findInterviewRowById(id);
        if (!interview) return { status: 404, message: "Interview not found" };
        if (interview.createdBy !== userId) {
            return { status: 403, message: "Only the creator can invite candidates" };
        }
        if (interview.status !== "active") {
            return { status: 400, message: "Interview must be active to invite candidates" };
        }
        if (new Date() > new Date(interview.expiresAt)) {
            return { status: 400, message: "Interview has expired and can no longer accept invites" };
        }

        const normalizedEmail = input.candidateEmail.toLowerCase().trim();
        let candidate = await findUserByEmail(normalizedEmail);

        if (!candidate) {
            candidate = await createUser({
                name: normalizedEmail.split("@")[0] ?? normalizedEmail,
                email: normalizedEmail,
                role: "candidate",
                isInvitedPlaceholder: true,
            });
        }

        if (!candidate) {
            return { status: 500, message: "Failed to create candidate account" };
        }

        const existingInvite = await findExistingInvite(interview.id, candidate.id);
        if (existingInvite) {
            return { status: 400, message: "Candidate already invited" };
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        // createInvite hashes the raw token before it touches the database.
        await createInvite({
            interviewId: interview.id,
            candidateId: candidate.id,
            rawToken,
        });

        return {
            status: 201,
            message: "Invite generated",
            data: { inviteToken: rawToken, candidateEmail: normalizedEmail },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const acceptInvite = async (rawToken: string): Promise<InterviewResult> => {
    try {
        const inviteRow = await findInviteByRawToken(rawToken);
        if (!inviteRow) return { status: 404, message: "Invalid invite link" };

        const interview = await findInterviewRowById(inviteRow.interviewId);
        if (!interview) return { status: 404, message: "Interview not found" };

        if (interview.status !== "active") {
            return { status: 400, message: "This interview is no longer active" };
        }
        if (new Date() > new Date(interview.expiresAt)) {
            return { status: 400, message: "This interview has expired" };
        }

        const userMap = await findUsersByIds([inviteRow.candidateId]);
        const candidate = userMap.get(inviteRow.candidateId) ?? null;

        // Re-acceptance is allowed while started/completed so page reloads resume
        // the session rather than failing with "already used".
        let invite = { ...withId(inviteRow), candidate };
        if (inviteRow.status === "pending") {
            const started = await updateInvite(inviteRow.id, {
                status: "started",
                startedAt: inviteRow.startedAt || new Date(),
            });
            if (started) invite = { ...started, candidate };
        }

        const authToken = jwt.sign(
            { _id: invite.candidateId, role: "candidate" },
            JWT_SECRET,
            { expiresIn: "2d" },
        );

        return {
            status: 200,
            message: "Invite accepted",
            invite,
            // The old code populated the interview here; the candidate page
            // keys off `interview._id`, so keep the id/_id mirror.
            interview: withId(interview),
            token: authToken,
            user: candidate,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Failed to accept invite: ${message}` };
    }
};

export const evaluateCandidateAnswer = async (
    userId: string,
    params: { audioBuffer: Buffer; mimetype: string; filename: string; question: string; inviteId: string },
): Promise<InterviewResult> => {
    try {
        if (!isValidId(params.inviteId)) return { status: 400, message: "Invalid inviteId" };
        const invite = await findInviteById(params.inviteId);
        if (!invite) return { status: 404, message: "Invite not found" };
        if (invite.candidateId !== userId) return { status: 403, message: "Not authorized for this invite" };
        if (invite.status !== "started") return { status: 400, message: "Invite is not active" };

        const interview = await findInterviewRowById(invite.interviewId);
        if (!interview) return { status: 404, message: "Interview not found" };

        const questionIndex = interview.questions.indexOf(params.question);
        if (questionIndex === -1) {
            return { status: 400, message: "Question not found in this interview" };
        }

        const ai = await evaluateAudio({
            audioBuffer: params.audioBuffer,
            mimetype: params.mimetype,
            filename: params.filename,
            question: params.question,
        });

        const results: ResultItem[] = [...invite.results];
        const existingIndex = results.findIndex(
            (r) => interview.questions.indexOf(r.question) === questionIndex,
        );
        const record: ResultItem = {
            question: interview.questions[questionIndex]!,
            transcription: ai.transcription,
            score: ai.score,
            feedback: ai.feedback,
        };
        if (existingIndex >= 0) {
            results[existingIndex] = record;
        } else {
            results.push(record);
        }
        await updateInvite(invite.id, { results });

        return {
            status: 200,
            message: "Answer evaluated",
            data: { score: ai.score, feedback: ai.feedback, transcription: ai.transcription || "No transcription available" },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 502, message: "AI service failed to evaluate your answer. Please try again.", data: { error: message } };
    }
};

export const submitInterviewAnswer = async (userId: string, input: SubmitAnswerInput): Promise<InterviewResult> => {
    try {
        if (!isValidId(input.inviteId)) return { status: 400, message: "Invalid inviteId format" };
        const invite = await findInviteById(input.inviteId);
        if (!invite) return { status: 404, message: "Invite not found" };
        if (invite.candidateId !== userId) return { status: 403, message: "Not authorized" };
        if (invite.status !== "started") return { status: 400, message: "Invite is not in started status" };

        const interview = await findInterviewRowById(invite.interviewId);
        if (!interview || !interview.questions[input.questionIndex]) {
            return { status: 400, message: "Invalid question index" };
        }

        const results: ResultItem[] = [...invite.results];
        const existingIndex = results.findIndex(
            (r) => interview.questions.indexOf(r.question) === input.questionIndex,
        );
        if (existingIndex === -1) {
            results.push({
                question: interview.questions[input.questionIndex]!,
                transcription: "",
                score: null,
                feedback: "",
            });
        }

        const hasDsa = (interview.dsaProblems?.length || 0) > 0;
        const behavioralDone = results.length >= (interview.questions.length || 0);

        const patch: Parameters<typeof updateInvite>[1] = { results };
        let nextRound: string | null = null;
        let completed = false;
        if (behavioralDone) {
            if ((interview.interviewType === "mixed" || interview.interviewType === "dsa") && hasDsa) {
                patch.currentRound = "dsa";
                nextRound = "dsa";
            } else {
                patch.status = "completed";
                patch.currentRound = "done";
                patch.completedAt = new Date();
                completed = true;
            }
        }
        const saved = await updateInvite(invite.id, patch);

        return {
            status: 200,
            message: "Answer submitted",
            data: {
                invite: saved ?? invite,
                ...(nextRound ? { nextRound } : {}),
                ...(completed ? { completed: true } : {}),
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getMyInterviews = async (userId: string, page: number, limit: number): Promise<InterviewResult> => {
    try {
        const skip = (page - 1) * limit;
        const { rows, total } = await listInvitesForCandidate(userId, skip, limit);

        // Populate interview + nested organization, as the old nested
        // .populate({ path: "interview", populate: { path: "organization" } }) did.
        const interviews = await findInterviews(rows.map((r) => r.interviewId));
        const orgMap = await findOrganizations(
            [...interviews.values()].map((i) => i.organizationId),
        );

        const data = rows.map((row) => {
            const invite = withId(row);
            const interview = interviews.get(row.interviewId);
            if (!interview) return { ...invite, interview: null };
            return {
                ...invite,
                interview: {
                    _id: interview.id,
                    id: interview.id,
                    title: interview.title,
                    targetRole: interview.targetRole,
                    description: interview.description,
                    status: interview.status,
                    expiresAt: interview.expiresAt,
                    interviewType: interview.interviewType,
                    organization: orgMap.get(interview.organizationId) ?? null,
                },
            };
        });

        return { status: 200, message: "Interviews fetched", data, page, limit, total };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const generateDsaForInterview = async (input: GenerateDsaInput): Promise<InterviewResult> => {
    try {
        const problems = await generateDsaProblems({
            targetRole: input.targetRole,
            difficulty: input.difficulty,
            count: input.count,
        });
        return { status: 200, message: "DSA problems generated", data: { problems } };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 502, message: "AI service failed to generate problems. Please try again later.", data: { error: message } };
    }
};

export const evaluateInterviewDsa = async (userId: string, input: EvaluateInterviewDsaInput): Promise<InterviewResult> => {
    try {
        if (!isValidId(input.inviteId)) return { status: 400, message: "Invalid inviteId format" };
        const invite = await findInviteById(input.inviteId);
        if (!invite) return { status: 404, message: "Invite not found" };
        if (invite.candidateId !== userId) return { status: 403, message: "Not authorized for this invite" };
        if (invite.status !== "started" && invite.status !== "pending") {
            return { status: 400, message: "Invite is not active" };
        }

        const interview = await findInterviewRowById(invite.interviewId);
        if (!interview) return { status: 404, message: "Interview not found" };

        const problem = (interview.dsaProblems || [])[input.problemIndex];
        if (!problem) return { status: 400, message: "Invalid problem index" };

        const patch: Parameters<typeof updateInvite>[1] = {};
        if (invite.status === "pending") {
            patch.status = "started";
            patch.startedAt = invite.startedAt || new Date();
        }

        const ai = await aiEvaluateDsa({
            title: problem.title,
            description: problem.description,
            difficulty: problem.difficulty || "medium",
            constraints: problem.constraints || "",
            examples: (problem.examples || []) as Array<{ input: string; output: string; explanation?: string }>,
            topics: problem.topics || [],
            expectedApproach: problem.expectedApproach || "",
            language: input.language,
            code: input.code,
        });

        const dsaResults: DsaResultItem[] = [...invite.dsaResults];
        const existingIndex = dsaResults.findIndex((r) => r.problemIndex === input.problemIndex);
        const record: DsaResultItem = {
            problemId: problem.id ?? "",
            problemTitle: problem.title,
            problemIndex: input.problemIndex,
            language: input.language,
            code: input.code,
            score: ai.score,
            correctness: ai.correctness,
            codeQuality: ai.codeQuality,
            timeComplexity: ai.timeComplexity,
            spaceComplexity: ai.spaceComplexity,
            feedback: ai.feedback,
            strengths: ai.strengths,
            improvements: ai.improvements,
            timeSpentSeconds: input.timeSpentSeconds || 0,
        };
        if (existingIndex >= 0) {
            dsaResults[existingIndex] = record;
        } else {
            dsaResults.push(record);
        }
        patch.dsaResults = dsaResults;

        const allDsaDone = dsaResults.length >= (interview.dsaProblems?.length || 0);
        if (allDsaDone) {
            patch.status = "completed";
            patch.currentRound = "done";
            patch.completedAt = invite.completedAt || new Date();
        }
        await updateInvite(invite.id, patch);

        return {
            status: 200,
            message: "DSA submission evaluated",
            data: { ...ai, completed: allDsaDone },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 502, message: "AI service failed to evaluate your code. Please try again.", data: { error: message } };
    }
};