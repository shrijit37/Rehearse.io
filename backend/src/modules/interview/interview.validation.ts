import z from "zod";

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

export const createInterviewSchema = z.object({
    title: z.string().min(1),
    targetRole: z.string().min(1),
    description: z.string().optional().default(""),
    organizationId: z.string().min(1),
    expiresAt: z.string().min(1),
    interviewType: z.enum(["behavioral", "dsa", "mixed"]).optional().default("behavioral"),
    questions: z.array(z.string()).optional().default([]),
    dsaProblems: z.array(dsaProblemSchema).optional().default([]),
    dsaDifficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional().default("medium"),
    status: z.enum(["draft", "active"]).optional().default("draft"),
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
export type GenerateInviteInput = z.infer<typeof generateInviteSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type EvaluateInterviewDsaInput = z.infer<typeof evaluateDsaSchema>;
export type GenerateDsaInput = z.infer<typeof generateDsaSchema>;