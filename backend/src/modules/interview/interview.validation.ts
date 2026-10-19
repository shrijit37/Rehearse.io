import z from "zod";
import { LIVE_MAX_QUESTIONS, LIVE_MAX_QUESTION_CHARS } from "../live/live.config";

// DSA problems come from the AI service and their example inputs/outputs may
// arrive as strings, arrays, or objects. Coerce anything non-string to a JSON
// string so one oddly-shaped field can't reject an entire interview.
const asString = z.preprocess(
    (v) => (typeof v === "string" ? v : v === undefined || v === null ? "" : JSON.stringify(v)),
    z.string()
);

const dsaExampleSchema = z.object({
    input: asString.default(""),
    output: asString.default(""),
    explanation: asString.optional().default(""),
});

const dsaProblemSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
    constraints: asString.optional().default(""),
    examples: z.array(dsaExampleSchema).optional().default([]),
    topics: z.array(asString).optional().default([]),
    expectedApproach: asString.optional().default(""),
    starterCode: z.object({
        python: z.string().optional(),
        javascript: z.string().optional(),
        java: z.string().optional(),
        cpp: z.string().optional(),
    }).optional(),
});

/**
 * The two interview fields a spoken session is built from, bounded by what one
 * live turn can carry: the relay refuses an advance past `LIVE_MAX_QUESTIONS`, so
 * a longer list would hold questions no session could ever reach, and it builds
 * the coach's instruction from the question the turn will be scored against, so a
 * question past `LIVE_MAX_QUESTION_CHARS` could not be spoken and scored as the
 * same text. Creation and update share these, so the two write paths cannot
 * disagree about them.
 */
const interviewTargetRoleSchema = z.string().min(1).max(200);
const interviewQuestionsSchema = z
    .array(z.string().max(LIVE_MAX_QUESTION_CHARS))
    .max(LIVE_MAX_QUESTIONS);

export const createInterviewSchema = z.object({
    title: z.string().min(1),
    targetRole: interviewTargetRoleSchema,
    description: z.string().optional().default(""),
    organizationId: z.string().min(1),
    expiresAt: z.string().min(1),
    interviewType: z.enum(["behavioral", "dsa", "mixed"]).optional().default("behavioral"),
    questions: interviewQuestionsSchema.optional().default([]),
    dsaProblems: z.array(dsaProblemSchema).optional().default([]),
    dsaDifficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional().default("medium"),
    status: z.enum(["draft", "active"]).optional().default("draft"),
});

/**
 * What a recruiter may change after creation, bounded exactly as creation is.
 *
 * Deliberately not `createInterviewSchema.partial()`: partial keeps the defaults,
 * so an update carrying only a status would also write an empty description and
 * `interviewType: "behavioral"` over what is stored. Nothing here has a default,
 * so the patch holds only the fields the caller actually sent, and it doubles as
 * the allow-list the update path writes through.
 */
export const updateInterviewSchema = z.object({
    title: z.string().min(1).optional(),
    targetRole: interviewTargetRoleSchema.optional(),
    description: z.string().optional(),
    expiresAt: z.string().min(1).optional(),
    interviewType: z.enum(["behavioral", "dsa", "mixed"]).optional(),
    questions: interviewQuestionsSchema.optional(),
    dsaProblems: z.array(dsaProblemSchema).optional(),
    dsaDifficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
    status: z.enum(["draft", "active"]).optional(),
});

export const generateInviteSchema = z.object({
    candidateEmail: z.string().email("Please provide a valid email address"),
});

export const submitAnswerSchema = z.object({
    inviteId: z.string().min(1),
    questionIndex: z.coerce.number().int().min(0),
});

export const evaluateDsaSchema = z.object({
    inviteId: z.string().min(1),
    problemIndex: z.coerce.number().int().min(0),
    language: z.string().min(1),
    code: z.string().min(1),
    timeSpentSeconds: z.number().optional().default(0),
});

export const generateDsaSchema = z.object({
    targetRole: z.string().max(200).optional().default("Software Engineer"),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional().default("medium"),
    count: z.coerce.number().int().min(1).max(3).optional().default(2),
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type GenerateInviteInput = z.infer<typeof generateInviteSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type EvaluateInterviewDsaInput = z.infer<typeof evaluateDsaSchema>;
export type GenerateDsaInput = z.infer<typeof generateDsaSchema>;