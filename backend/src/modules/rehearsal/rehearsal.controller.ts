import type { Request, Response } from "express";
import {
    startRehearsal,
    evaluateAnswer,
    saveSession,
    getHistory,
    startDsaPractice,
    evaluateDsaSubmission,
} from "./rehearsal.service";
import { startDsaSchema, evaluateDsaSchema, saveSessionSchema } from "./rehearsal.validation";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

export const handleStartRehearsal = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const targetRole = typeof req.query.targetRole === "string" ? req.query.targetRole : "Software Engineer";
    const result = await startRehearsal(userId, targetRole);
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleEvaluateAnswer = async (req: Request, res: Response): Promise<void> => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
        res.status(400).json({ message: "No audio file uploaded" });
        return;
    }
    const question = typeof req.body?.question === "string" ? req.body.question : "";
    if (!question) {
        res.status(400).json({ message: "No question provided for evaluation" });
        return;
    }
    const result = await evaluateAnswer({
        audioBuffer: file.buffer,
        mimetype: file.mimetype,
        filename: file.originalname,
        question,
    });
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleSaveSession = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = saveSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid or empty session results" });
        return;
    }
    const result = await saveSession(userId, parsed.data);
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleGetHistory = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 20;
    const result = await getHistory(userId, page, limit);
    res.status(result.status).json(result.data ?? { message: result.message, data: [], total: 0 });
};

export const handleStartDsaPractice = async (req: Request, res: Response): Promise<void> => {
    const parsed = startDsaSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await startDsaPractice(parsed.data);
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};

export const handleEvaluateDsaSubmission = async (req: Request, res: Response): Promise<void> => {
    const parsed = evaluateDsaSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await evaluateDsaSubmission(parsed.data);
    res.status(result.status).json({
        message: result.message,
        ...(result.data ? result.data : {}),
    });
};