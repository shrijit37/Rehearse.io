import type { Request, Response } from "express";
import { onboardValidation, parseResumeRequest, updateProfileValidation } from "./user.validation";
import {
    getUserProfile,
    onboardUser,
    updateUserProfile,
    getProfileMedia,
    parseResumeIntoProfile,
    getUserConsent,
    updateUserConsent,
    exportUserData,
    deleteUserAccount,
    type ProfileMediaKind,
} from "./user.service";
import { logAudit } from "../../middleware/auditLog";

interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        role: string;
    };
}

/** The signed-in account's row id, or null after a 401 has been sent. */
function sessionUserId(req: Request, res: Response): string | null {
    const userId = (req as AuthenticatedRequest).user?._id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return null;
    }
    return userId;
}

/**
 * The candidate's own record: what is held, and what a practice round reads.
 * The sealed blobs are deliberately absent — each has its own endpoint below.
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
    const userId = sessionUserId(req, res);
    if (!userId) return;

    const response = await getUserProfile(userId);
    if (response.status === 200 && response.data) {
        res.status(200).json({ success: true, data: response.data, message: response.message });
        return;
    }
    res.status(response.status).json({ success: false, message: response.message });
};

/**
 * One stored artifact of the signed-in account. Sent as its own file rather than
 * inline in the profile payload, so a 4 MB headshot does not ride on every read
 * of the profile.
 */
export const getMedia = async (req: Request, res: Response): Promise<void> => {
    const userId = sessionUserId(req, res);
    if (!userId) return;

    const kind = req.params.kind;
    if (kind !== "resume" && kind !== "photo" && kind !== "voice") {
        res.status(400).json({ success: false, message: "Unknown file kind" });
        return;
    }

    const response = await getProfileMedia(userId, kind);
    if (response.status === 200 && response.file) {
        res.setHeader("Content-Type", response.file.contentType);
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${response.file.filename.replace(/["\\]/g, "")}"`,
        );
        // PII, owner-only, never cached by a shared proxy.
        res.setHeader("Cache-Control", "private, no-store");
        res.send(response.file.body);
        return;
    }
    res.status(response.status).json({ success: false, message: response.message });
};

/** Reads the resume into the structured profile. Writes nothing until the
 * candidate applies the sections the preview offered. */
export const parseResume = async (req: Request, res: Response): Promise<void> => {
    const userId = sessionUserId(req, res);
    if (!userId) return;

    const result = parseResumeRequest.safeParse(req.body ?? {});
    if (!result.success) {
        res.status(400).json({
            success: false,
            message: result.error.issues[0]?.message || "Invalid input",
        });
        return;
    }

    const response = await parseResumeIntoProfile(userId, result.data);
    if (response.status === 200) {
        if (response.changed?.length) {
            await logAudit({
                userId,
                action: "profile_update",
                details: `Applied the resume read: ${response.changed.join(", ")}`,
                req,
            });
        }
        res.status(200).json({
            success: true,
            message: response.message,
            changed: response.changed ?? [],
            preview: response.preview ?? [],
            data: response.data,
        });
        return;
    }
    res.status(response.status).json({ success: false, message: response.message });
};

export const onboard = async (req: Request, res: Response): Promise<void> => {
    const userId = sessionUserId(req, res);
    if (!userId) return;

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
    const userId = sessionUserId(req, res);
    if (!userId) return;

    const result = updateProfileValidation.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            success: false,
            message: result.error.issues[0]?.message || "Invalid input",
        });
        return;
    }

    const response = await updateUserProfile(userId, result.data);

    if (response.status === 200 && response.data) {
        // Field names only: never the values, which are the candidate's own data.
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
            data: response.data,
        });
    } else {
        res.status(response.status).json({
            success: false,
            message: response.message,
        });
    }
};

export const getConsent = async (req: Request, res: Response): Promise<void> => {
    const userId = sessionUserId(req, res);
    if (!userId) return;

    const response = await getUserConsent(userId);
    if (response.status === 200) {
        res.status(200).json(response.consent);
    } else {
        res.status(response.status).json({ message: response.message });
    }
};

export const updateConsent = async (req: Request, res: Response): Promise<void> => {
    const userId = sessionUserId(req, res);
    if (!userId) return;

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
    const userId = sessionUserId(req, res);
    if (!userId) return;

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
    const userId = sessionUserId(req, res);
    if (!userId) return;

    const response = await deleteUserAccount(userId);
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
