import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { findUserById } from "../db/repositories/users";

export async function authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        if (!req.headers.authorization) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const secret = env.JWT_SECRET;
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const decodedToken = jwt.verify(token, secret);
        const claims = decodedToken as { _id: string; role: string };

        const user = await findUserById(claims._id);
        if (!user || user.isDeleted) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        (req as Request & { user?: { _id: string; role: string } }).user = {
            _id: claims._id,
            role: user.role,
        };

        next();
    } catch {
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
}
