import type { Request, Response } from "express";
import zod from "zod";
import { addUser, loginUser } from "./auth.service";
import { SignUpSchema, LoginSchema } from "./auth.validation";
import type { ISignUpSchema, ILoginSchema } from "./auth.validation";

//validate the request body and call service and return response

export const signup = async (req: Request, res: Response): Promise<void> => {

    const result = zod.safeParse(SignUpSchema, req.body);
    if (!result.success) {
        res.status(400).json({
            message: "Invalid input"
        })
        return;
    }
    const response = await addUser(result.data as ISignUpSchema);
    res.setHeader("Authorization", `Bearer ${response.data.token}`).status(response.status).json(response.data);
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const result = zod.safeParse(LoginSchema, req.body);
    if (!result.success) {
        res.status(400).json({
            message: "Invalid input"
        })
        return;
    }
    const response = await loginUser(result.data as ILoginSchema);
    res.setHeader("Authorization", `Bearer ${response.data.token}`).status(response.status).json(response.data);
};

