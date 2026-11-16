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

export interface ScenarioResult {
    questions: string[];
}

/**
 * The structured profile the AI service reads out of a resume. Every field is
 * optional: a read that finds nothing is a valid answer, and the caller decides
 * whether it is worth storing.
 */
export interface ParsedResumeProfile {
    headline?: string;
    location?: string;
    skills?: string[];
    experience?: Array<{ title: string; company: string; period?: string; summary?: string }>;
    education?: Array<{ school: string; qualification?: string; period?: string }>;
}

/** Text from a model reply, present and non-empty, or undefined. */
function readText(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/** An array of non-empty strings from a model reply; undefined when absent. */
function readStringList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out = value
        .map(readText)
        .filter((entry): entry is string => entry !== undefined);
    return out.length > 0 ? out : undefined;
}

/** One list of record-like rows from a model reply, keeping only rows with content. */
function readRows<T extends object>(
    value: unknown,
    build: (row: Record<string, unknown>) => T | null,
): T[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out = value
        .map((row) =>
            row && typeof row === "object" && !Array.isArray(row)
                ? build(row as Record<string, unknown>)
                : null,
        )
        .filter((row): row is T => row !== null);
    return out.length > 0 ? out : undefined;
}

export async function parseResume(resumeText: string): Promise<ParsedResumeProfile> {
    const data = await aiJson("/api/parse-resume", { resume_text: resumeText.slice(0, 10000) });
    return {
        headline: readText(data?.headline),
        location: readText(data?.location),
        skills: readStringList(data?.skills),
        experience: readRows(data?.experience, (row) => {
            const title = readText(row.title) ?? "";
            const company = readText(row.company) ?? "";
            if (!title && !company) return null;
            const period = readText(row.period);
            const summary = readText(row.summary);
            return { title, company, ...(period ? { period } : {}), ...(summary ? { summary } : {}) };
        }),
        education: readRows(data?.education, (row) => {
            const school = readText(row.school) ?? "";
            const qualification = readText(row.qualification);
            if (!school && !qualification) return null;
            const period = readText(row.period);
            return { school, ...(qualification ? { qualification } : {}), ...(period ? { period } : {}) };
        }),
    };
}

export async function generateScenario(resumeText: string, targetRole: string): Promise<ScenarioResult> {
    const data = await aiJson("/api/generate-scenario", {
        resume_text: resumeText.slice(0, 10000),
        target_role: targetRole.slice(0, 200),
    });
    return { questions: Array.isArray(data?.questions) ? data.questions : [] };
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
