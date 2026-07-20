import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { InterviewSession } from "./interviewSession.model";
import { CandidateInvite } from "./candidateInvite.model";
import { Organization } from "../organization/organization.model";
import { User } from "../user/user.model";
import { env } from "../../config/env";
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

const isValidId = (id: string) => mongoose.Types.ObjectId.isValid(id);

export const createInterview = async (userId: string, input: CreateInterviewInput): Promise<InterviewResult> => {
    try {
        if (!isValidId(input.organizationId)) {
            return { status: 400, message: "Valid organizationId is required" };
        }
        const org = await Organization.findById(input.organizationId);
        if (!org) return { status: 404, message: "Organization not found" };

        const isMember = org.members.some(
            (m) => m.user.toString() === userId && ["admin", "recruiter"].includes(m.role),
        );
        if (!isMember) return { status: 403, message: "Not authorized in this organization" };

        const interview = await InterviewSession.create({
            organization: input.organizationId,
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

        const populated = await InterviewSession.findById(interview._id).populate("organization", "name slug");
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
        const filter: Record<string, unknown> = { createdBy: userId };
        if (organizationId) {
            if (!isValidId(organizationId)) return { status: 400, message: "Invalid organizationId format" };
            filter.organization = organizationId;
        }

        const [interviews, total] = await Promise.all([
            InterviewSession.find(filter)
                .populate("organization", "name slug")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            InterviewSession.countDocuments(filter),
        ]);

        return { status: 200, message: "Interviews fetched", data: interviews, page, limit, total };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getInterview = async (userId: string, id: string): Promise<InterviewResult> => {
    try {
        if (!isValidId(id)) return { status: 400, message: "Invalid interview ID format" };

        const interview = await InterviewSession.findById(id)
            .populate("organization", "name slug")
            .populate("createdBy", "name email");
        if (!interview) return { status: 404, message: "Interview not found" };

        if (interview.createdBy._id.toString() !== userId) {
            return { status: 403, message: "Access denied. You can only view interviews you created." };
        }

        const invites = await CandidateInvite.find({ interview: interview._id })
            .populate("candidate", "name email")
            .sort({ createdAt: -1 });

        return { status: 200, message: "Interview fetched", interview, candidates: invites };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const updateInterview = async (userId: string, id: string, body: Record<string, unknown>): Promise<InterviewResult> => {
    try {
        if (!isValidId(id)) return { status: 400, message: "Invalid interview ID format" };
        const interview = await InterviewSession.findById(id);
        if (!interview) return { status: 404, message: "Interview not found" };
        if (interview.createdBy.toString() !== userId) {
            return { status: 403, message: "Only the creator can update this interview" };
        }

        const allowedFields = [
            "title", "targetRole", "questions", "description", "status", "expiresAt",
            "interviewType", "dsaProblems", "dsaDifficulty",
        ];
        for (const field of allowedFields) {
            if (body[field] !== undefined) (interview as any)[field] = body[field];
        }
        await interview.save();

        return { status: 200, message: "Interview updated", interview };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const generateInvite = async (userId: string, id: string, input: GenerateInviteInput): Promise<InterviewResult> => {
    try {
        if (!isValidId(id)) return { status: 400, message: "Invalid interview ID format" };
        const interview = await InterviewSession.findById(id);
        if (!interview) return { status: 404, message: "Interview not found" };
        if (interview.createdBy.toString() !== userId) {
            return { status: 403, message: "Only the creator can invite candidates" };
        }
        if (interview.status !== "active") {
            return { status: 400, message: "Interview must be active to invite candidates" };
        }
        if (new Date() > new Date(interview.expiresAt)) {
            return { status: 400, message: "Interview has expired and can no longer accept invites" };
        }

        const normalizedEmail = input.candidateEmail.toLowerCase().trim();
        let candidate = await User.findOne({ email: normalizedEmail });

        if (!candidate) {
            const randomPassword = crypto.randomBytes(32).toString("hex");
            candidate = await User.create({
                name: normalizedEmail.split("@")[0],
                email: normalizedEmail,
                password: await bcrypt.hash(randomPassword, 12),
                role: "candidate",
                isInvitedPlaceholder: true,
            });
        }

        const existingInvite = await CandidateInvite.findOne({
            interview: interview._id,
            candidate: candidate._id,
        });
        if (existingInvite) {
            return { status: 400, message: "Candidate already invited" };
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        await CandidateInvite.create({
            interview: interview._id,
            candidate: candidate._id,
            inviteToken: rawToken,
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
        const invite = await (CandidateInvite.findByRawToken(rawToken) as any)
            .populate("interview", "title targetRole description questions dsaProblems interviewType expiresAt status")
            .populate("candidate", "name email role");

        if (!invite) return { status: 404, message: "Invalid invite link" };
        const interview = invite.interview as any;
        if (!interview) return { status: 404, message: "Interview not found" };
        if (interview.status !== "active") {
            return { status: 400, message: "This interview is no longer active" };
        }
        if (new Date() > new Date(interview.expiresAt)) {
            return { status: 400, message: "This interview has expired" };
        }

        // Re-acceptance is allowed while started/completed so page reloads resume
        // the session rather than failing with "already used".
        if (invite.status === "pending") {
            invite.status = "started";
            invite.startedAt = invite.startedAt || new Date();
            await invite.save();
        }

        const candidate = invite.candidate as any;
        const authToken = jwt.sign({ _id: candidate._id, role: "candidate" }, JWT_SECRET, { expiresIn: "2d" });

        return {
            status: 200,
            message: "Invite accepted",
            invite,
            interview,
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
        const invite = await CandidateInvite.findById(params.inviteId);
        if (!invite) return { status: 404, message: "Invite not found" };
        if (invite.candidate.toString() !== userId) return { status: 403, message: "Not authorized for this invite" };
        if (invite.status !== "started") return { status: 400, message: "Invite is not active" };

        const interview = await InterviewSession.findById(invite.interview);
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

        const results = invite.results as any[];
        const existingIndex = results.findIndex((r) => interview.questions.indexOf(r.question) === questionIndex);
        const record = {
            question: interview.questions[questionIndex],
            transcription: ai.transcription,
            score: ai.score,
            feedback: ai.feedback,
        };
        if (existingIndex >= 0) {
            results[existingIndex] = record;
        } else {
            results.push(record);
        }
        invite.results = results;
        await invite.save();

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
        const invite = await CandidateInvite.findById(input.inviteId);
        if (!invite) return { status: 404, message: "Invite not found" };
        if (invite.candidate.toString() !== userId) return { status: 403, message: "Not authorized" };
        if (invite.status !== "started") return { status: 400, message: "Invite is not in started status" };

        const interview = await InterviewSession.findById(invite.interview);
        if (!interview || !interview.questions[input.questionIndex]) {
            return { status: 400, message: "Invalid question index" };
        }

        const results = invite.results as any[];
        const existingIndex = results.findIndex((r) => interview.questions.indexOf(r.question) === input.questionIndex);
        if (existingIndex === -1) {
            results.push({ question: interview.questions[input.questionIndex], transcription: "", score: null, feedback: "" });
        }
        invite.results = results;

        const hasDsa = (interview.dsaProblems?.length || 0) > 0;
        const behavioralDone = results.length >= (interview.questions.length || 0);

        let nextRound: string | null = null;
        let completed = false;
        if (behavioralDone) {
            if ((interview.interviewType === "mixed" || interview.interviewType === "dsa") && hasDsa) {
                invite.currentRound = "dsa";
                nextRound = "dsa";
            } else {
                invite.status = "completed";
                invite.currentRound = "done";
                invite.completedAt = new Date();
                completed = true;
            }
        }
        await invite.save();

        return {
            status: 200,
            message: "Answer submitted",
            data: { invite, ...(nextRound ? { nextRound } : {}), ...(completed ? { completed: true } : {}) },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getMyInterviews = async (userId: string, page: number, limit: number): Promise<InterviewResult> => {
    try {
        const skip = (page - 1) * limit;
        const filter = { candidate: userId };

        const [invites, total] = await Promise.all([
            CandidateInvite.find(filter)
                .populate({
                    path: "interview",
                    select: "title targetRole description status expiresAt interviewType",
                    populate: { path: "organization", select: "name" },
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            CandidateInvite.countDocuments(filter),
        ]);

        return { status: 200, message: "Interviews fetched", data: invites, page, limit, total };
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
        const invite = await CandidateInvite.findById(input.inviteId);
        if (!invite) return { status: 404, message: "Invite not found" };
        if (invite.candidate.toString() !== userId) return { status: 403, message: "Not authorized for this invite" };
        if (invite.status !== "started" && invite.status !== "pending") {
            return { status: 400, message: "Invite is not active" };
        }

        const interview = await InterviewSession.findById(invite.interview);
        if (!interview) return { status: 404, message: "Interview not found" };

        const problem = (interview.dsaProblems || [])[input.problemIndex];
        if (!problem) return { status: 400, message: "Invalid problem index" };

        if (invite.status === "pending") {
            invite.status = "started";
            invite.startedAt = invite.startedAt || new Date();
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

        const dsaResults = (invite.dsaResults || []) as any[];
        const existingIndex = dsaResults.findIndex((r) => r.problemIndex === input.problemIndex);
        const record = {
            problemId: problem._id ? String(problem._id) : "",
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
        invite.dsaResults = dsaResults;

        const allDsaDone = dsaResults.length >= (interview.dsaProblems?.length || 0);
        if (allDsaDone) {
            invite.status = "completed";
            invite.currentRound = "done";
            invite.completedAt = invite.completedAt || new Date();
        }
        await invite.save();

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