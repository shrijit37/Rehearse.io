import type { Request, Response, NextFunction } from "express";
import { isOnboarded } from "../db/repositories/users";

/**
 * Requires completed onboarding (resume uploaded).
 * Must be used after authenticateToken.
 */
export async function requireOnboarded(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const user = (req as Request & { user?: { _id: string } }).user;
    if (!user?._id) {
        res.status(401).json({ message: "Not authenticated" });
        return;
    }

    try {
        if (!(await isOnboarded(user._id))) {
            res.status(403).json({ message: "Please complete onboarding first." });
            return;
        }
        next();
    } catch {
        res.status(500).json({ message: "Failed to verify onboarding status" });
    }
}
