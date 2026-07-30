import type { Request, Response } from "express";
import { getUserValidation, type GetUserDetails } from "./user.validation";
import { getUserDetails } from "./user.service";
import z from "zod";
import { onboardValidation, updateProfileValidation } from "./user.validation";
import { onboardUser, updateUserProfile, getUserConsent, updateUserConsent, exportUserData, deleteUserAccount } from "./user.service";
import { logAudit } from "../../middleware/auditLog";

interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        role: string;
    };
}

export const getUser = async (req: Request, res: Response): Promise<void> => {
    // @ts-ignore
    const result = z.safeParse(getUserValidation, req.user);
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
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const result = onboardValidation.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            success: false,
            message: result.error.issues[0]?.message || "Invalid input",
        });
        return;
    }

    const response = await onboardUser(userId, result.data);

    if (response.status === 200 && response.user) {
        await logAudit({
            userId: userId,
            action: "onboard",
            details: "User completed onboarding",
            req,
        });
        res.status(200).json({
            success: true,
            message: response.message,
            user: response.user,
        });
    } else {
        res.status(response.status).json({
            success: false,
            message: response.message,
        });
    }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const result = updateProfileValidation.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            success: false,
            message: result.error.issues[0]?.message || "Invalid input",
        });
        return;
    }

    const response = await updateUserProfile(userId, result.data);

    if (response.status === 200 && response.user) {
        const fieldsUpdated = Object.keys(result.data).join(", ");
        await logAudit({
            userId: userId,
            action: "profile_update",
            details: `Updated profile fields: ${fieldsUpdated}`,
            req,
        });
        res.status(200).json({
            success: true,
            message: response.message,
            user: response.user,
        });
    } else {
        res.status(response.status).json({
            success: false,
            message: response.message,
        });
    }
};

export const getConsent = async (req: Request, res: Response): Promise<void> => {
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const response = await getUserConsent(userId);
    if (response.status === 200) {
        res.status(200).json(response.consent);
    } else {
        res.status(response.status).json({ message: response.message });
    }
};

export const updateConsent = async (req: Request, res: Response): Promise<void> => {
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const { consentGiven, consentVersion } = req.body;
    const response = await updateUserConsent(userId, consentGiven, consentVersion);
    if (response.status === 200 && response.consent) {
        await logAudit({
            userId: userId,
            action: "consent_update",
            details: consentGiven ? "Consent granted" : "Consent revoked",
            req,
        });
        res.status(200).json({
            message: consentGiven ? "Consent recorded" : "Consent revoked",
            consent: response.consent,
        });
    } else {
        res.status(response.status).json({ message: response.message });
    }
};

export const exportData = async (req: Request, res: Response): Promise<void> => {
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const response = await exportUserData(userId);
    if (response.status === 200 && response.data) {
        await logAudit({
            userId: userId,
            action: "account_export",
            details: "User exported their data",
            req,
        });
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="rehearse-data-export-${Date.now()}.json"`);
        res.status(200).json(response.data);
    } else {
        res.status(response.status).json({ message: response.message });
    }
};

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    const { password } = req.body;
    const response = await deleteUserAccount(userId, password);
    if (response.status === 200) {
        await logAudit({
            userId: userId,
            action: "account_delete",
            details: "User deleted their account and all associated data",
            req,
        });
        res.status(200).json({ message: response.message });
    } else {
        res.status(response.status).json({ message: response.message });
    }
};

