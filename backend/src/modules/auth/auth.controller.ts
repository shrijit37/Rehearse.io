import type { Request, Response } from "express";
import zod from "zod";
import { claimProfile, toPublicUser } from "./auth.service";
import { ClaimSchema } from "./auth.validation";
import type { IClaimSchema } from "./auth.validation";
import { findUserById } from "../../db/repositories/users";
import { logAudit } from "../../middleware/auditLog";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

/** Current app-side profile for an already authenticated visitor. */
export const session = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const user = await findUserById(userId);
    if (!user || user.isDeleted) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    res.status(200).json({ user: toPublicUser(user) });
};

/** Records role + consent for a visitor who just signed in on the shared service. */
export const claim = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const result = zod.safeParse(ClaimSchema, req.body ?? {});
    if (!result.success) {
        res.status(400).json({ message: "Invalid input" });
        return;
    }

    try {
        const user = await claimProfile(userId, result.data as IClaimSchema);
        await logAudit({
            userId,
            action: "signup",
            details: `User signed up as ${user.role}`,
            req,
        });
        res.status(200).json({ message: "Profile saved", user: toPublicUser(user) });
    } catch (error: unknown) {
        res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
};