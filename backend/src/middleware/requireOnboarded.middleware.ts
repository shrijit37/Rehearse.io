import type { Request, Response, NextFunction } from "express";
import { User } from "../modules/user/user.model";

/**
 * Middleware to require completed onboarding (resume uploaded).
 * Must be used after authenticateToken.
 *
 * The JWT middleware only attaches { _id, role }, so we load the user from
 * the DB here to check onboardingCompleted.
 */
export async function requireOnboarded(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = (req as Request & { user?: { _id: string } }).user;
    if (!user?._id) {
        res.status(401).json({ message: "Not authenticated" });
        return;
    }

    try {
        const dbUser = await User.findById(user._id).select("onboardingCompleted");
        if (!dbUser || !dbUser.onboardingCompleted) {
            res.status(403).json({ message: "Please complete onboarding first." });
            return;
        }
        next();
    } catch (err) {
        res.status(500).json({ message: "Failed to verify onboarding status" });
    }
}
