import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { User } from "../modules/user/user.model";

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!req.headers.authorization) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const secret = env.JWT_SECRET;
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const decodedToken = jwt.verify(token, secret);
        const user = decodedToken as { _id: string, role: string };
        //check if user valid

        const isValid = await User.findById(user._id);
        if (!isValid || isValid.isDeleted) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        // @ts-ignore
        req.user = {
            _id: user._id,
            role: user.role
        }

        next();

    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
        return;
    }
}
