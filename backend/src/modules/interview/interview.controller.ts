import type { Request, Response } from "express";
import {
    createInterview,
    listInterviews,
    getInterview,
    updateInterview,
    generateInvite,
    acceptInvite,
    evaluateCandidateAnswer,
    submitInterviewAnswer,
    getMyInterviews,
    generateDsaForInterview,
    evaluateInterviewDsa,
} from "./interview.service";
import { logAudit } from "../../middleware/auditLog";
import {
    createInterviewSchema,
    generateInviteSchema,
    submitAnswerSchema,
    evaluateDsaSchema,
    generateDsaSchema,
} from "./interview.validation";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

function getUserId(req: Request): string | null {
    return (req as AuthenticatedRequest).user?._id || null;
}

function paramId(req: Request): string {
    return typeof req.params.id === "string" ? req.params.id : "";
}

export const handleCreateInterview = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = createInterviewSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await createInterview(userId, parsed.data);
    if (result.status === 201) {
        await logAudit({ userId, action: "interview_create", details: `Created interview: ${parsed.data.title}`, req });
    }
    res.status(result.status).json({
        message: result.message,
        ...(result.interview ? { interview: result.interview } : {}),
    });
};

export const handleListInterviews = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 20;
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const result = await listInterviews(userId, organizationId, page, limit);
    res.status(result.status).json(
        result.status === 200
            ? { message: result.message, data: result.data, page, limit, total: result.total }
            : { message: result.message },
    );
};

export const handleGetInterview = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const result = await getInterview(userId, paramId(req));
    res.status(result.status).json({
        message: result.message,
        ...(result.interview ? { interview: result.interview } : {}),
        ...(result.candidates !== undefined ? { candidates: result.candidates } : {}),
    });
};

export const handleUpdateInterview = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const result = await updateInterview(userId, paramId(req), req.body);
    res.status(result.status).json({
        message: result.message,
        ...(result.interview ? { interview: result.interview } : {}),
    });
};

export const handleGenerateInvite = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = generateInviteSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Please provide a valid email address" });
        return;
    }
    const result = await generateInvite(userId, paramId(req), parsed.data);
    if (result.status === 201) {
        await logAudit({ userId, action: "interview_invite", details: `Invited ${parsed.data.candidateEmail}`, req });
    }
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleAcceptInvite = async (req: Request, res: Response): Promise<void> => {
    const result = await acceptInvite(req.params.token as string);
    res.status(result.status).json({
        message: result.message,
        ...(result.invite ? { invite: result.invite } : {}),
        ...(result.interview ? { interview: result.interview } : {}),
        ...(result.token ? { token: result.token } : {}),
        ...(result.user ? { user: result.user } : {}),
    });
};

export const handleEvaluateCandidateAnswer = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
        res.status(400).json({ message: "No audio file uploaded" });
        return;
    }
    const question = typeof req.body?.question === "string" ? req.body.question : "";
    const inviteId = typeof req.body?.inviteId === "string" ? req.body.inviteId : "";
    if (!question) {
        res.status(400).json({ message: "No question provided for evaluation" });
        return;
    }
    if (!inviteId) {
        res.status(400).json({ message: "inviteId is required" });
        return;
    }

    const result = await evaluateCandidateAnswer(userId, {
        audioBuffer: file.buffer,
        mimetype: file.mimetype,
        filename: file.originalname,
        question,
        inviteId,
    });
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleSubmitInterviewAnswer = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = submitAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "inviteId and questionIndex are required" });
        return;
    }
    const result = await submitInterviewAnswer(userId, parsed.data);
    if (result.status === 200) {
        await logAudit({ userId, action: "interview_submit", details: "Candidate submitted an answer", req });
    }
    res.status(result.status).json(result.data ?? { message: result.message });
};

export const handleGetMyInterviews = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 20;
    const result = await getMyInterviews(userId, page, limit);
    res.json(result.status === 200
        ? { message: result.message, data: result.data, page, limit, total: result.total }
        : { message: result.message });
};

export const handleGenerateDsaForInterview = async (req: Request, res: Response): Promise<void> => {
    const parsed = generateDsaSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await generateDsaForInterview(parsed.data);
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleEvaluateInterviewDsa = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = evaluateDsaSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await evaluateInterviewDsa(userId, parsed.data);
    res.status(result.status).json(result.data ?? { message: result.message });
};