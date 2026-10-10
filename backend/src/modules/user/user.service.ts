import type { OnboardValidation, UpdateProfileValidation } from "./user.validation";
import { encryptField } from "../../utils/encryption";
import {
    validateAudioFormat,
    validateBase64Field,
    validatePdfFormat,
    validatePhotoFormat,
} from "../../utils/fileValidation";
import type { GetUserDetails, GetUserValidation } from "./user.validation";
import {
    findUserById,
    updateUser,
} from "../../db/repositories/users";
import { listRehearsalSessions, deleteRehearsalSessionsForUser } from "../../db/repositories/rehearsals";
import { deleteInvitesForCandidate, listInvitesForCandidate, findInterviewRowById } from "../../db/repositories/interviews";
import { withId } from "../../db/shape";
import { findOrganizationRowById } from "../../db/repositories/organizations";

const EMPTY_USER = {
    email: null,
    name: null,
    audio: null,
    photo: null,
    resume: null,
    resumeName: null,
    onboardingCompleted: false,
} as const;

export const getUserDetails = async (
    data: GetUserValidation,
): Promise<GetUserDetails> => {
    let user: Awaited<ReturnType<typeof findUserById>> = null;
    try {
        user = await findUserById(data._id);
    } catch (e) {
        console.error(e);
        return {
            status: 500,
            data: { _id: data._id, ...EMPTY_USER },
            message: "Internal Server Error",
        };
    }

    if (!user) {
        return {
            status: 404,
            data: { _id: data._id, ...EMPTY_USER },
            message: "User not found",
        };
    }

    return {
        status: 200,
        data: {
            _id: user.id,
            email: user.email,
            name: user.name,
            audio: user.audio,
            photo: user.photo,
            resume: user.resume,
            resumeName: user.resumeName,
            onboardingCompleted: user.onboardingCompleted,
            onboarded: user.onboardingCompleted === true,
        },
        message: "User found",
    };
};

export interface OnboardResult {
    status: number;
    message: string;
    user?: Record<string, unknown>;
}

export const onboardUser = async (
    userId: string,
    data: OnboardValidation,
): Promise<OnboardResult> => {
    try {
        const existingUser = await findUserById(userId);
        if (!existingUser) {
            return { status: 404, message: "User not found" };
        }
        if (existingUser.onboardingCompleted) {
            return {
                status: 400,
                message: "Onboarding has already been completed. Use profile update instead.",
            };
        }

        const resumeCheck = validateBase64Field(data.resume, "resume");
        if (!resumeCheck.isValid) {
            return { status: 400, message: resumeCheck.message || "Invalid resume" };
        }
        if (!validatePdfFormat(data.resume)) {
            return {
                status: 400,
                message: "Invalid file format. Please upload a valid PDF document.",
            };
        }

        if (data.photo) {
            const photoCheck = validateBase64Field(data.photo, "photo");
            if (!photoCheck.isValid) {
                return { status: 400, message: photoCheck.message || "Invalid photo" };
            }
            if (!validatePhotoFormat(data.photo)) {
                return {
                    status: 400,
                    message: "Invalid photo format. Please upload a JPEG or PNG image.",
                };
            }
        }

        if (data.audio) {
            const audioCheck = validateBase64Field(data.audio, "audio");
            if (!audioCheck.isValid) {
                return { status: 400, message: audioCheck.message || "Invalid audio" };
            }
            if (!validateAudioFormat(data.audio)) {
                return {
                    status: 400,
                    message: "Invalid audio format. Please upload a WAV, WebM, or MP3 file.",
                };
            }
        }

        const updatedUser = await updateUser(userId, {
            resumeName: data.resumeName,
            resume: encryptField(data.resume) ?? null,
            photo: data.photo ? (encryptField(data.photo) ?? null) : null,
            audio: data.audio ? (encryptField(data.audio) ?? null) : null,
            onboardingCompleted: true,
        });

        if (!updatedUser) {
            return { status: 404, message: "User not found" };
        }

        // Large blobs are stripped from every response.
        const { resume: _r, photo: _p, audio: _a, password: _pw, ...safe } = updatedUser as Record<
            string,
            unknown
        >;
        return {
            status: 200,
            message: "Onboarding completed successfully",
            user: { ...safe, onboarded: true },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export interface UpdateProfileResult {
    status: number;
    message: string;
    user?: Record<string, unknown>;
}

export const updateUserProfile = async (
    userId: string,
    data: UpdateProfileValidation,
): Promise<UpdateProfileResult> => {
    try {
        const existingUser = await findUserById(userId);
        if (!existingUser) {
            return { status: 404, message: "User not found" };
        }

        if (data.photo !== undefined) {
            const photoCheck = validateBase64Field(data.photo, "photo");
            if (!photoCheck.isValid) {
                return { status: 400, message: photoCheck.message || "Invalid photo" };
            }
            if (data.photo && !validatePhotoFormat(data.photo)) {
                return {
                    status: 400,
                    message: "Invalid photo format. Please upload a JPEG or PNG image.",
                };
            }
        }

        if (data.audio !== undefined) {
            const audioCheck = validateBase64Field(data.audio, "audio");
            if (!audioCheck.isValid) {
                return { status: 400, message: audioCheck.message || "Invalid audio" };
            }
            if (data.audio && !validateAudioFormat(data.audio)) {
                return {
                    status: 400,
                    message: "Invalid audio format. Please upload a WAV, WebM, or MP3 file.",
                };
            }
        }

        const patch: Parameters<typeof updateUser>[1] = {};
        if (data.photo !== undefined) patch.photo = encryptField(data.photo) ?? null;
        if (data.audio !== undefined) patch.audio = encryptField(data.audio) ?? null;

        const updatedUser = await updateUser(userId, patch);
        if (!updatedUser) {
            return { status: 404, message: "User not found" };
        }

        const { resume: _r, photo: _p, audio: _a, password: _pw, ...safe } = updatedUser as Record<
            string,
            unknown
        >;
        return {
            status: 200,
            message: "Profile updated successfully",
            user: { ...safe, onboarded: updatedUser.onboardingCompleted === true },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export interface ConsentResult {
    status: number;
    message: string;
    consent?: {
        consentGiven: boolean;
        consentDate?: Date | null;
        consentVersion?: string | null;
    };
}

export const getUserConsent = async (userId: string): Promise<ConsentResult> => {
    try {
        const user = await findUserById(userId);
        if (!user) return { status: 404, message: "User not found" };
        return {
            status: 200,
            message: "Consent retrieved",
            consent: {
                consentGiven: user.consentGiven || false,
                consentDate: user.consentDate,
                consentVersion: user.consentVersion,
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const updateUserConsent = async (
    userId: string,
    consentGiven: boolean,
    consentVersion?: string,
): Promise<ConsentResult> => {
    try {
        if (typeof consentGiven !== "boolean") {
            return { status: 400, message: "consentGiven must be a boolean" };
        }

        const user = await updateUser(userId, {
            consentGiven,
            consentDate: new Date(),
            consentVersion: consentVersion || "1.0",
        });
        if (!user) return { status: 404, message: "User not found" };

        return {
            status: 200,
            message: consentGiven ? "Consent recorded" : "Consent revoked",
            consent: {
                consentGiven: user.consentGiven || false,
                consentDate: user.consentDate,
                consentVersion: user.consentVersion,
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export interface ExportDataResult {
    status: number;
    message: string;
    data?: Record<string, unknown>;
}

export const exportUserData = async (userId: string): Promise<ExportDataResult> => {
    try {
        const user = await findUserById(userId);
        if (!user) return { status: 404, message: "User not found" };

        const { rows: sessions } = await listRehearsalSessions(userId, 0, 10_000);
        const { rows: invites } = await listInvitesForCandidate(userId, 0, 10_000);

        // Resolve the interview/organization references, like the old
        // `.populate("interview", "title targetRole organization")`.
        const interviews = new Map<string, Record<string, unknown>>();
        await Promise.all(
            [...new Set(invites.map((i) => i.interviewId))].map(async (interviewId) => {
                const interview = await findInterviewRowById(interviewId);
                if (interview) interviews.set(interviewId, { ...interview, _id: interview.id });
            }),
        );

        const orgIds = [...new Set([...interviews.values()].map((i) => String(i.organizationId)))];
        const orgs = new Map<string, Record<string, unknown>>();
        await Promise.all(
            orgIds.map(async (orgId) => {
                const org = await findOrganizationRowById(orgId);
                if (org) orgs.set(orgId, { _id: org.id, name: org.name, slug: org.slug });
            }),
        );

        const candidateInvites = invites.map((invite) => {
            const interview = interviews.get(invite.interviewId);
            if (!interview) return { ...withId(invite), interview: null };
            return {
                ...withId(invite),
                interview: {
                    _id: interview.id,
                    id: interview.id,
                    title: interview.title,
                    targetRole: interview.targetRole,
                    organization: orgs.get(String(interview.organizationId)) ?? null,
                },
            };
        });

        return {
            status: 200,
            message: "User data exported successfully",
            data: {
                exportDate: new Date().toISOString(),
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                    consentGiven: user.consentGiven,
                    consentDate: user.consentDate,
                },
                rehearsalSessions: sessions,
                candidateInvites,
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export interface DeleteAccountResult {
    status: number;
    message: string;
}

export const deleteUserAccount = async (userId: string): Promise<DeleteAccountResult> => {
    try {
        const user = await findUserById(userId);
        if (!user) return { status: 404, message: "User not found" };

        // Soft delete: anonymize the account, then purge dependent records.
        await updateUser(userId, {
            isDeleted: true,
            deletedAt: new Date(),
            name: "[Deleted User]",
            email: `deleted-${userId}@anonymized.local`,
            password: null,
            resume: "",
            photo: "",
            audio: "",
            resumeName: "",
        });

        await deleteRehearsalSessionsForUser(userId);
        await deleteInvitesForCandidate(userId);

        return {
            status: 200,
            message: "Account and all associated data have been permanently deleted",
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};
