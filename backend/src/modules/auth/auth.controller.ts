import type { Request, Response } from "express";
import zod from "zod";
import { addUser, loginUser } from "./auth.service";
import { SignUpSchema, LoginSchema } from "./auth.validation";
import type { ISignUpSchema, ILoginSchema } from "./auth.validation";
import { logAudit } from "../../middleware/auditLog";

//validate the request body and call service and return response

export const signup = async (req: Request, res: Response): Promise<void> => {
    const result = zod.safeParse(SignUpSchema, req.body);
    if (!result.success) {
        res.status(400).json({
            message: "Invalid input"
        });
        return;
    }
    const response = await addUser(result.data as ISignUpSchema);
    if (response.status === 201 && response.data.user) {
        const userId = typeof response.data.user._id === "string" ? response.data.user._id : undefined;
        const userObjectId = response.data.user._id as string | undefined; // safe string check
        const role = typeof response.data.user.role === "string" ? response.data.user.role : "candidate";
        await logAudit({
            userId: userObjectId,
            action: "signup",
            details: `User signed up as ${role}`,
            req,
        });
    }
    res.setHeader("Authorization", `Bearer ${response.data.token}`).status(response.status).json(response.data);
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const result = zod.safeParse(LoginSchema, req.body);
    if (!result.success) {
        res.status(400).json({
            message: "Invalid input"
        });
        return;
    }
    const response = await loginUser(result.data as ILoginSchema);
    if (response.status === 200 && response.data.user) {
        const userObjectId = response.data.user._id as string | undefined;
        await logAudit({
            userId: userObjectId,
            action: "login",
            details: "User logged in",
            req,
        });
    }
    res.setHeader("Authorization", `Bearer ${response.data.token}`).status(response.status).json(response.data);
};

