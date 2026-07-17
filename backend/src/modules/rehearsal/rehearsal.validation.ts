import z from "zod";

export const startDsaSchema = z.object({
    targetRole: z.string().max(200).optional().default("Software Engineer"),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional().default("medium"),
    count: z.coerce.number().int().min(1).max(3).optional().default(2),
});

export const evaluateDsaSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    difficulty: z.string().optional().default("medium"),
    constraints: z.string().optional().default(""),
    examples: z.array(z.any()).optional().default([]),
    topics: z.array(z.string()).optional().default([]),
    expectedApproach: z.string().optional().default(""),
    language: z.string().min(1),
    code: z.string().min(1),
    timeSpentSeconds: z.number().optional().default(0),
});

const resultItemSchema = z.object({
    question: z.string(),
    transcription: z.string(),
    score: z.number(),
    feedback: z.string(),
});

const dsaResultItemSchema = z.object({
    problemTitle: z.string(),
    problemIndex: z.number().optional().default(0),
    language: z.string().optional().default("python"),
    code: z.string().optional().default(""),
    score: z.number().nullable().optional().default(null),
    correctness: z.number().nullable().optional().default(null),
    codeQuality: z.number().nullable().optional().default(null),
    timeComplexity: z.string().optional().default(""),
    spaceComplexity: z.string().optional().default(""),
    feedback: z.string().optional().default(""),
    strengths: z.array(z.string()).optional().default([]),
    improvements: z.array(z.string()).optional().default([]),
    timeSpentSeconds: z.number().optional().default(0),
});

export const saveSessionSchema = z.object({
    results: z.array(resultItemSchema).optional(),
    dsaResults: z.array(dsaResultItemSchema).optional(),
    targetRole: z.string().optional().default("Software Engineer"),
    sessionType: z.enum(["behavioral", "dsa"]).optional().default("behavioral"),
}).refine(
    (data) => (data.results?.length || 0) > 0 || (data.dsaResults?.length || 0) > 0,
    { message: "Invalid or empty session results" },
);