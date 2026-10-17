import z from "zod";
import { env } from "../../config/env";
import { LIVE_SCORING_MODEL, LIVE_SCORING_TIMEOUT_MS } from "./live.config";

/**
 * The two shapes the scoring call has to survive: the provider's envelope, and
 * the verdict the model was asked for inside it. Both cross the network boundary,
 * so both are parsed rather than asserted — a shape change should degrade to
 * "unscored", never to a crash or an invented grade.
 */
const scoringEnvelopeSchema = z.object({
    candidates: z
        .array(
            z.object({
                content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional(),
            }),
        )
        .optional(),
});

const scoringVerdictSchema = z.object({
    score: z.union([z.number(), z.string()]),
    feedback: z.string(),
});

export interface AnswerScore {
    score: number;
    feedback: string;
}

/**
 * Scores one spoken answer from its transcript.
 *
 * This replaces the batch path's `ai-service /api/evaluate-audio`, which
 * re-transcribed the audio with Groq before scoring it. Live already delivered
 * the transcript, so the only missing half was the rubric — and one provider for
 * both halves is why this is Gemini rather than a second vendor. `VOICE.md`
 * records that choice.
 *
 * Returns null when the call fails or answers with something that is not a
 * usable score, so a bad rubric response cannot invent a grade.
 */
export async function scoreAnswer(question: string, transcription: string): Promise<AnswerScore | null> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const prompt = [
        "You are an interview coach scoring one spoken answer.",
        "Score 1-10 on structure, specificity and evidence. Reward concrete detail;",
        "penalise filler, vagueness and answers that never reach an outcome.",
        'Answer as JSON only: {"score": <integer 1-10>, "feedback": "<at most two sentences, addressed to the candidate>"}',
        "",
        `Question: ${JSON.stringify(question)}`,
        `Answer: ${JSON.stringify(transcription)}`,
    ].join("\n");

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${LIVE_SCORING_MODEL}:generateContent`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    // A header, not `?key=`: this REST endpoint accepts the key
                    // either way, and a header keeps it out of the URL, which is
                    // the thing that ends up in logs and error text. (The Live
                    // *socket* has no such option — measured — which is why that
                    // one is documented as the reason the socket is proxied.)
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
                }),
                signal: AbortSignal.timeout(LIVE_SCORING_TIMEOUT_MS),
            },
        );
        if (!response.ok) {
            console.warn(`[live] scoring returned ${response.status}`);
            return null;
        }

        // Validated, not asserted: this body crosses the network boundary.
        const envelope = scoringEnvelopeSchema.safeParse(await response.json());
        if (!envelope.success) return null;
        const text = envelope.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const verdict = scoringVerdictSchema.safeParse(JSON.parse(text));
        if (!verdict.success) {
            console.warn("[live] scoring answered with an unusable verdict");
            return null;
        }

        const score = Math.round(Number(verdict.data.score));
        if (!Number.isFinite(score) || score < 1 || score > 10) {
            console.warn("[live] scoring returned a score outside 1-10");
            return null;
        }
        if (verdict.data.feedback.trim().length === 0) return null;

        return { score, feedback: verdict.data.feedback.trim() };
    } catch (error: unknown) {
        // The error *name* only: a fetch failure's message can carry the request
        // URL and driver detail, and none of that belongs in a log line.
        console.warn(`[live] scoring failed (${error instanceof Error ? error.name : typeof error})`);
        return null;
    }
}
