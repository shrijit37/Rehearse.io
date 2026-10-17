import { env } from "../../config/env";
import { LIVE_SCORING_MODEL, LIVE_SCORING_TIMEOUT_MS } from "./live.config";

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
            `https://generativelanguage.googleapis.com/v1beta/models/${LIVE_SCORING_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
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

        const body = (await response.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        const parsed = JSON.parse(text) as { score?: unknown; feedback?: unknown };
        const score = typeof parsed.score === "number" ? Math.round(parsed.score) : Number(parsed.score);
        if (!Number.isFinite(score) || score < 1 || score > 10) {
            console.warn("[live] scoring returned a score outside 1-10");
            return null;
        }
        if (typeof parsed.feedback !== "string" || parsed.feedback.trim().length === 0) return null;

        return { score, feedback: parsed.feedback.trim() };
    } catch (error: unknown) {
        console.warn("[live] scoring failed:", error instanceof Error ? error.message : "unknown error");
        return null;
    }
}
