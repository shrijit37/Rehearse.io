import { env } from "../config/env";

const AI_SERVICE_URL = env.AI_SERVICE_URL;
const AI_SERVICE_API_KEY = env.AI_SERVICE_API_KEY;

function authHeaders(): Record<string, string> {
    return AI_SERVICE_API_KEY ? { Authorization: `Bearer ${AI_SERVICE_API_KEY}` } : {};
}

async function handleError(res: Response, context: string): Promise<never> {
    let detail = "";
    try {
        const body: any = await res.json();
        detail = body?.detail || body?.message || "";
    } catch {
        /* ignore parse errors */
    }
    const message = detail || `AI service request failed (${res.status})`;
    throw new Error(`${context}: ${message}`);
}

/** POST JSON to the AI service. */
async function aiJson(path: string, payload: Record<string, unknown>): Promise<any> {
    let res: Response;
    try {
        res = await fetch(`${AI_SERVICE_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "network error";
        throw new Error(`AI service unreachable (${AI_SERVICE_URL}): ${message}`);
    }
    if (!res.ok) await handleError(res, `AI ${path}`);
    return res.json();
}

/** POST multipart FormData to the AI service. */
async function aiForm(path: string, form: FormData): Promise<Response> {
    let res: Response;
    try {
        res = await fetch(`${AI_SERVICE_URL}${path}`, {
            method: "POST",
            headers: authHeaders(), // fetch sets the multipart boundary automatically
            body: form,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "network error";
        throw new Error(`AI service unreachable (${AI_SERVICE_URL}): ${message}`);
    }
    if (!res.ok) await handleError(res, `AI ${path}`);
    return res;
}

export interface ScenarioResult {
    questions: string[];
}

export async function generateScenario(resumeText: string, targetRole: string): Promise<ScenarioResult> {
    const data = await aiJson("/api/generate-scenario", {
        resume_text: resumeText.slice(0, 10000),
        target_role: targetRole.slice(0, 200),
    });
    return { questions: Array.isArray(data?.questions) ? data.questions : [] };
}

export interface EvaluateAudioResult {
    score: number;
    feedback: string;
    transcription: string;
}

export async function evaluateAudio(params: {
    audioBuffer: Buffer;
    mimetype: string;
    filename: string;
    question: string;
}): Promise<EvaluateAudioResult> {
    const form = new FormData();
    form.append("audio", new Blob([params.audioBuffer], { type: params.mimetype || "audio/webm" }), params.filename || "answer.webm");
    form.append("question", params.question.slice(0, 500));

    const res = await aiForm("/api/evaluate-audio", form);
    const data: any = await res.json();
    return {
        score: typeof data?.score === "number" ? data.score : 0,
        feedback: typeof data?.feedback === "string" ? data.feedback : "",
        transcription: typeof data?.transcription === "string" ? data.transcription : "",
    };
}

export interface DsaGeneratedProblem {
    title: string;
    description: string;
    difficulty: string;
    constraints?: string;
    examples?: Array<{ input: string; output: string; explanation?: string }>;
    topics?: string[];
    expectedApproach?: string;
    starterCode?: {
        python?: string;
        javascript?: string;
        java?: string;
        cpp?: string;
    };
}

export async function generateDsaProblems(params: {
    targetRole: string;
    difficulty: string;
    count: number;
}): Promise<DsaGeneratedProblem[]> {
    const data = await aiJson("/api/generate-dsa-problems", {
        target_role: params.targetRole,
        difficulty: params.difficulty,
        count: params.count,
    });
    return Array.isArray(data?.problems) ? data.problems : [];
}

export interface DsaEvaluationResult {
    score: number;
    correctness: number;
    codeQuality: number;
    timeComplexity: string;
    spaceComplexity: string;
    feedback: string;
    strengths: string[];
    improvements: string[];
}

export async function evaluateDsa(payload: {
    title: string;
    description: string;
    difficulty: string;
    constraints: string;
    examples: Array<{ input: string; output: string; explanation?: string }>;
    language: string;
    code: string;
    expectedApproach: string;
    topics: string[];
}): Promise<DsaEvaluationResult> {
    const data = await aiJson("/api/evaluate-dsa", {
        title: payload.title.slice(0, 300),
        description: payload.description.slice(0, 8000),
        difficulty: payload.difficulty.slice(0, 20),
        constraints: (payload.constraints || "").slice(0, 2000),
        examples: (payload.examples || []).slice(0, 5),
        language: payload.language.slice(0, 40),
        code: (payload.code || "").slice(0, 20000),
        expected_approach: (payload.expectedApproach || "").slice(0, 2000),
        topics: (payload.topics || []).slice(0, 10),
    });
    return {
        score: typeof data?.score === "number" ? data.score : 0,
        correctness: typeof data?.correctness === "number" ? data.correctness : 0,
        codeQuality: typeof data?.codeQuality === "number" ? data.codeQuality : 0,
        timeComplexity: typeof data?.timeComplexity === "string" ? data.timeComplexity : "Unknown",
        spaceComplexity: typeof data?.spaceComplexity === "string" ? data.spaceComplexity : "Unknown",
        feedback: typeof data?.feedback === "string" ? data.feedback : "",
        strengths: Array.isArray(data?.strengths) ? data.strengths : [],
        improvements: Array.isArray(data?.improvements) ? data.improvements : [],
    };
}

export interface TtsResult {
    arrayBuffer: ArrayBuffer;
    contentType: string;
}

export async function tts(text: string, voice: string): Promise<TtsResult> {
    const form = new FormData();
    form.append("text", text);
    form.append("voice", voice || "Fritz-PlayAI");

    const res = await aiForm("/api/tts", form);
    const arrayBuffer = await res.arrayBuffer();
    return {
        arrayBuffer,
        contentType: res.headers.get("content-type") || "audio/mpeg",
    };
}
