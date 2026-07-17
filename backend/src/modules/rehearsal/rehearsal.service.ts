import { RehearsalSession } from "./rehearsalSession.model";
import { User } from "../user/user.model";
import { decryptField } from "../../utils/encryption";
import { extractTextFromBase64Pdf } from "../../utils/pdfParser";
import {
    generateScenario,
    evaluateAudio,
    generateDsaProblems,
    evaluateDsa as aiEvaluateDsa,
} from "../../utils/aiClient";
import type { startDsaSchema, evaluateDsaSchema, saveSessionSchema } from "./rehearsal.validation";
import type { z } from "zod";

type StartDsaInput = z.infer<typeof startDsaSchema>;
type EvaluateDsaInput = z.infer<typeof evaluateDsaSchema>;
type SaveSessionInput = z.infer<typeof saveSessionSchema>;

export interface ServiceResult {
    status: number;
    message: string;
    data?: unknown;
}

export const startRehearsal = async (userId: string, targetRole: string): Promise<ServiceResult> => {
    try {
        const user = await User.findById(userId).select("resume");
        if (!user) return { status: 404, message: "User not found" };

        const resumePlain = decryptField(user.resume);
        let resumeText = "";
        try {
            resumeText = await extractTextFromBase64Pdf(resumePlain);
        } catch (parseErr) {
            const message = parseErr instanceof Error ? parseErr.message : "unknown error";
            return {
                status: 500,
                message: "Failed to parse resume PDF. Please ensure you uploaded a valid PDF document.",
                data: { error: message },
            };
        }

        const aiResponse = await generateScenario(resumeText, targetRole || "Software Engineer");
        return {
            status: 200,
            message: "Interview scenario questions generated successfully",
            data: { questions: aiResponse.questions },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return {
            status: 502,
            message: "AI service failed to generate questions. Please try again later.",
            data: { error: message },
        };
    }
};

export const evaluateAnswer = async (params: {
    audioBuffer: Buffer;
    mimetype: string;
    filename: string;
    question: string;
}): Promise<ServiceResult> => {
    try {
        const result = await evaluateAudio(params);
        return {
            status: 200,
            message: "Answer evaluated",
            data: result,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return {
            status: 502,
            message: "AI service failed to evaluate your answer. Please try again.",
            data: { error: message },
        };
    }
};

export const saveSession = async (userId: string, input: SaveSessionInput): Promise<ServiceResult> => {
    try {
        const session = await RehearsalSession.create({
            user: userId,
            targetRole: input.targetRole,
            sessionType: input.sessionType,
            results: input.results || [],
            dsaResults: input.dsaResults || [],
        });
        return {
            status: 201,
            message: "Rehearsal session saved successfully",
            data: { session },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getHistory = async (userId: string, page: number, limit: number): Promise<ServiceResult> => {
    try {
        const skip = (page - 1) * limit;
        const filter = { user: userId };

        const [history, total] = await Promise.all([
            RehearsalSession.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            RehearsalSession.countDocuments(filter),
        ]);

        return { status: 200, message: "History fetched", data: { data: history, page, limit, total } };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const startDsaPractice = async (input: StartDsaInput): Promise<ServiceResult> => {
    try {
        const problems = await generateDsaProblems({
            targetRole: input.targetRole,
            difficulty: input.difficulty,
            count: input.count,
        });
        return {
            status: 200,
            message: "DSA problems generated",
            data: { problems },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return {
            status: 502,
            message: "AI service failed to generate problems. Please try again later.",
            data: { error: message },
        };
    }
};

export const evaluateDsaSubmission = async (input: EvaluateDsaInput): Promise<ServiceResult> => {
    try {
        const result = await aiEvaluateDsa({
            title: input.title,
            description: input.description,
            difficulty: input.difficulty,
            constraints: input.constraints,
            examples: input.examples as Array<{ input: string; output: string; explanation?: string }>,
            topics: input.topics,
            expectedApproach: input.expectedApproach,
            language: input.language,
            code: input.code,
        });
        return {
            status: 200,
            message: "DSA submission evaluated",
            data: result,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return {
            status: 502,
            message: "AI service failed to evaluate your code. Please try again.",
            data: { error: message },
        };
    }
};