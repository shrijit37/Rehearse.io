import type { Request, Response } from "express";
import { startLiveSession } from "./live.service";
import { startLiveSessionSchema } from "./live.validation";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

/**
 * Mints the short-lived ticket the browser presents at the socket handshake.
 * The socket itself never sees a session cookie.
 */
export const handleStartLiveSession = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const parsed = startLiveSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid live session request" });
        return;
    }

    const result = await startLiveSession(userId, parsed.data);
    res.status(result.status).json({
        status: result.status === 200 ? "success" : "error",
        message: result.message,
        ...(result.data ? { data: result.data } : {}),
    });
};
