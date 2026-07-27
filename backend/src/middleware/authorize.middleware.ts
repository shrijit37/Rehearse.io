import type { Request, Response, NextFunction } from "express";

/**
 * Role-based access control middleware.
 * Must be used AFTER the authenticateToken middleware.
 *
 * Usage: router.get("/some-route", authenticateToken, authorize("recruiter"), handler)
 * Usage: router.get("/some-route", authenticateToken, authorize("recruiter", "admin"), handler)
 */
export function authorize(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = (req as Request & { user?: { _id: string; role: string } }).user;
        if (!user) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            res.status(403).json({
                message: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${user.role || "none"}.`,
            });
            return;
        }

        next();
    };
}
