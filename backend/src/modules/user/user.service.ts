import { RehearsalSession } from "../rehearsal/rehearsalSession.model";
import { CandidateInvite } from "../interview/candidateInvite.model";
import bcrypt from "bcryptjs";

import type { OnboardValidation, UpdateProfileValidation } from "./user.validation";
import { encryptField } from "../../utils/encryption";
import {
    validateBase64Field,
    validatePdfFormat,
    validatePhotoFormat,
    validateAudioFormat
} from "../../utils/fileValidation";

import type { GetUserDetails, GetUserValidation } from "./user.validation";
import { User } from "./user.model";

export const getUserDetails = async (data: GetUserValidation): Promise<GetUserDetails> => {
    let user = null;
    try {
        user = await User.findOne({ _id: data._id });
    } catch (e) {
        console.error(e);
        return {
            status: 500,
            data: {
                _id: data._id,
                email: null,
                name: null,
                audio: null,
                photo: null,
                resume: null,
                resumeName: null,
                onboardingCompleted: false,
            },
            message: "Internal Server Error",
        };
    }
    const _id = data._id;
    try {
        if (!user) {
            return {
                status: 404,
                data: {
                    _id: _id,
                    email: null,
                    name: null,
                    audio: null,
                    photo: null,
                    resume: null,
                    resumeName: null,
                    onboardingCompleted: false,
                },
                message: "User not found",
            };
        }

        return {
            status: 200,
            data: {
                _id: user._id.toString(),
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
    } catch (error) {
        console.error(error);
        return {
            status: 500,
            data: {
                _id: _id,
                email: null,
                name: null,
                audio: null,
                photo: null,
                resume: null,
                resumeName: null,
                onboardingCompleted: false,
            },
            message: "Internal Server Error",
        };
    }

}

export interface OnboardResult {
    status: number;
    message: string;
    user?: Record<string, unknown>;
}

export const onboardUser = async (
    userId: string,
    data: OnboardValidation
): Promise<OnboardResult> => {
    try {
        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return { status: 404, message: "User not found" };
        }
        if (existingUser.onboardingCompleted) {
            return { status: 400, message: "Onboarding has already been completed. Use profile update instead." };
        }

        // Validate base64 formats/sizes
        const resumeCheck = validateBase64Field(data.resume, "resume");
        if (!resumeCheck.isValid) {
            return { status: 400, message: resumeCheck.message || "Invalid resume" };
        }
        if (!validatePdfFormat(data.resume)) {
            return { status: 400, message: "Invalid file format. Please upload a valid PDF document." };
        }

        if (data.photo) {
            const photoCheck = validateBase64Field(data.photo, "photo");
            if (!photoCheck.isValid) {
                return { status: 400, message: photoCheck.message || "Invalid photo" };
            }
            if (!validatePhotoFormat(data.photo)) {
                return { status: 400, message: "Invalid photo format. Please upload a JPEG or PNG image." };
            }
        }

        if (data.audio) {
            const audioCheck = validateBase64Field(data.audio, "audio");
            if (!audioCheck.isValid) {
                return { status: 400, message: audioCheck.message || "Invalid audio" };
            }
            if (!validateAudioFormat(data.audio)) {
                return { status: 400, message: "Invalid audio format. Please upload a WAV, WebM, or MP3 file." };
            }
        }

        // Perform encryption and updates
        const encryptedResume = encryptField(data.resume);
        const encryptedPhoto = data.photo ? encryptField(data.photo) : undefined;
        const encryptedAudio = data.audio ? encryptField(data.audio) : undefined;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                resumeName: data.resumeName,
                resume: encryptedResume,
                photo: encryptedPhoto,
                audio: encryptedAudio,
                onboardingCompleted: true,
            },
            { new: true }
        );

        if (!updatedUser) {
            return { status: 404, message: "User not found" };
        }

        // Strip large blobs from returned user data
        const userObj = updatedUser.toObject() as Record<string, unknown>;
        delete userObj.password;
        delete userObj.resume;
        delete userObj.photo;
        delete userObj.audio;
        userObj.onboarded = true;

        return {
            status: 200,
            message: "Onboarding completed successfully",
            user: userObj,
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
    data: UpdateProfileValidation
): Promise<UpdateProfileResult> => {
    try {
        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return { status: 404, message: "User not found" };
        }

        // Validate formats
        if (data.photo !== undefined) {
            const photoCheck = validateBase64Field(data.photo, "photo");
            if (!photoCheck.isValid) {
                return { status: 400, message: photoCheck.message || "Invalid photo" };
            }
            if (data.photo && !validatePhotoFormat(data.photo)) {
                return { status: 400, message: "Invalid photo format. Please upload a JPEG or PNG image." };
            }
        }

        if (data.audio !== undefined) {
            const audioCheck = validateBase64Field(data.audio, "audio");
            if (!audioCheck.isValid) {
                return { status: 400, message: audioCheck.message || "Invalid audio" };
            }
            if (data.audio && !validateAudioFormat(data.audio)) {
                return { status: 400, message: "Invalid audio format. Please upload a WAV, WebM, or MP3 file." };
            }
        }

        // Build updates
        const update: Record<string, string | undefined | null> = {};
        if (data.photo !== undefined) {
            update.photo = encryptField(data.photo);
        }
        if (data.audio !== undefined) {
            update.audio = encryptField(data.audio);
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true }
        );

        if (!updatedUser) {
            return { status: 404, message: "User not found" };
        }

        // Strip blobs
        const userObj = updatedUser.toObject() as Record<string, unknown>;
        delete userObj.password;
        delete userObj.resume;
        delete userObj.photo;
        delete userObj.audio;
        userObj.onboarded = updatedUser.onboardingCompleted === true;

        return {
            status: 200,
            message: "Profile updated successfully",
            user: userObj,
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
        const user = await User.findById(userId).select("consentGiven consentDate consentVersion");
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
    consentVersion?: string
): Promise<ConsentResult> => {
    try {
        if (typeof consentGiven !== "boolean") {
            return { status: 400, message: "consentGiven must be a boolean" };
        }

        const update = {
            consentGiven,
            consentDate: new Date(),
            consentVersion: consentVersion || "1.0",
        };

        const user = await User.findByIdAndUpdate(userId, update, { new: true })
            .select("consentGiven consentDate consentVersion");

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
        const user = await User.findById(userId).select("-password");
        if (!user) return { status: 404, message: "User not found" };

        const sessions = await RehearsalSession.find({ user: userId }).sort({ createdAt: -1 });
        const invites = await CandidateInvite.find({ candidate: userId })
            .populate("interview", "title targetRole organization")
            .sort({ createdAt: -1 });

        return {
            status: 200,
            message: "User data exported successfully",
            data: {
                exportDate: new Date().toISOString(),
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                    consentGiven: user.consentGiven,
                    consentDate: user.consentDate,
                },
                rehearsalSessions: sessions,
                candidateInvites: invites,
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

export const deleteUserAccount = async (
    userId: string,
    password?: string
): Promise<DeleteAccountResult> => {
    try {
        if (!password) {
            return { status: 400, message: "Password is required to delete your account" };
        }

        const user = await User.findById(userId).select("+password");
        if (!user) return { status: 404, message: "User not found" };

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { status: 400, message: "Incorrect password" };
        }

        // Soft delete: anonymize data
        await User.findByIdAndUpdate(userId, {
            isDeleted: true,
            deletedAt: new Date(),
            name: "[Deleted User]",
            email: `deleted-${userId}@anonymized.local`,
            password: "DELETED",
            resume: "",
            photo: "",
            audio: "",
            resumeName: "",
        });

        // Delete rehearsal sessions
        await RehearsalSession.deleteMany({ user: userId });

        // Delete candidate invites
        await CandidateInvite.deleteMany({ candidate: userId });

        return {
            status: 200,
            message: "Account and all associated data have been permanently deleted",
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

