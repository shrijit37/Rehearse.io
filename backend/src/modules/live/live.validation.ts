import z from "zod";

const MAX_QUESTIONS = 8;
const MAX_QUESTION_CHARS = 600;

/**
 * Practice questions are client-held today — `GET /api/rehearsal/start` never
 * persists them, so the client sends the list it is working through. That is
 * the same trust model as the batch flow, where the client already posts the
 * question text back with its answer. The invited-interview flow does not: it
 * sends an inviteId and the questions come from the database.
 */
export const startLiveSessionSchema = z
    .object({
        mode: z.enum(["practice", "interview"]),
        targetRole: z.string().trim().max(200).optional().default("Software Engineer"),
        questions: z
            .array(z.string().trim().min(1).max(MAX_QUESTION_CHARS))
            .max(MAX_QUESTIONS)
            .optional()
            .default([]),
        questionIndex: z.coerce.number().int().min(0).max(MAX_QUESTIONS - 1).optional().default(0),
        inviteId: z.string().min(1).optional(),
    })
    .refine(
        // The bound above is the maximum list size, not this list's size: an
        // index past the end would otherwise be served question 0, and the
        // candidate would be scored against a question never asked.
        (data) => data.mode !== "practice" || data.questionIndex < data.questions.length,
        { message: "questionIndex is out of range for the questions provided", path: ["questionIndex"] },
    );

export type StartLiveSessionInput = z.infer<typeof startLiveSessionSchema>;
