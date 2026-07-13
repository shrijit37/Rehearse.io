import type { Request, Response } from "express";
import { getUserValidation, type GetUserDetails } from "./user.validation";
import { getUserDetails } from "./user.service";
import z from "zod";


export const getUser = async (req: Request, res: Response): Promise<void> => {
    const result = z.safeParse(getUserValidation, req.query);
    console.log(req.query);
    if (!result.success) {
        res.status(400).json({
            success: false,
            message: "Invalid request",
        })
        return;
    }


    const response: GetUserDetails = await getUserDetails(result.data);
    res.status(response.status).json({
        success: Boolean(response.status === 200),
        data: response.data,
        message: response.message,
    });
    return;
};
export const onboard = async (req: Request, res: Response): Promise<void> => {
    return;
};
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    return;
};
