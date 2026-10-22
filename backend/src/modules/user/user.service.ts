import type { ProfileEducation, ProfileExperience } from "../../db/schema";
import { decryptField, encryptField } from "../../utils/encryption";
import {
    validateAudioFormat,
    validateBase64Field,
    validatePdfFormat,
    validatePhotoFormat,
} from "../../utils/fileValidation";
import { extractTextFromBase64Pdf } from "../../utils/pdfParser";
import { parseResume as aiParseResume } from "../../utils/aiClient";
import { profileHasContent, profileToRoundText } from "../../utils/profileText";
import { parsedProfileValidation } from "./user.validation";
import type {
    OnboardValidation,
    ProfilePayload,
    RoundSource,
    UpdateProfileValidation,
} from "./user.validation";
import {
    findUserById,
    updateUser,
    type UserPatch,
    type UserRecord,
} from "../../db/repositories/users";
import { listRehearsalSessions, deleteRehearsalSessionsForUser } from "../../db/repositories/rehearsals";
import { deleteInvitesForCandidate, listInvitesForCandidate, findInterviewRowById } from "../../db/repositories/interviews";
import { withId } from "../../db/shape";
import { findOrganizationRowById } from "../../db/repositories/organizations";

/** A stored data URL — or bare base64 — as bytes, with the type it declares. */
function decodeStoredFile(value: string, fallbackType: string): { body: Buffer; contentType: string } {
    const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.*)$/is.exec(value);
    return {
        contentType: match ? (match[1] ?? fallbackType) : fallbackType,
        body: Buffer.from(match ? (match[2] ?? "") : value, "base64"),
    };
}

/**
 * One payload for every profile read, so the page can never be told two
 * different things about the same record. The sealed blobs (resume, photo,
 * voice) are never inlined: each is fetched through its own endpoint, by the
 * account it belongs to.
 */
export function toProfilePayload(user: UserRecord): ProfilePayload {
    const structured = {
        headline: user.headline,
        location: user.location,
        skills: user.skills,
        experience: user.experience,
        education: user.education,
    };
    const usesProfile = profileHasContent(structured);
    const resumePlain = decryptField(user.resume);
    const onboarded = user.onboardingCompleted === true;
    const roundSource: RoundSource = usesProfile
        ? { kind: "profile", text: profileToRoundText(structured) }
        : { kind: user.resume ? "resume" : "none", text: null };

    return {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        onboardingCompleted: onboarded,
        onboarded,
        headline: user.headline ?? null,
        location: user.location ?? null,
        skills: user.skills ?? [],
        experience: user.experience ?? [],
        education: user.education ?? [],
        resumeParsedAt: user.resumeParsedAt ?? null,
        resume: {
            present: Boolean(user.resume),
            name: user.resumeName ?? null,
            sizeBytes: resumePlain ? decodeStoredFile(resumePlain, "application/pdf").body.length : null,
            updatedAt: user.resumeUpdatedAt ?? null,
        },
        photo: { present: Boolean(user.photo) },
        voice: { present: Boolean(user.audio) },
        consent: {
            given: user.consentGiven === true,
            date: user.consentDate ?? null,
            version: user.consentVersion ?? null,
        },
        roundSource,
    };
}

export interface ProfileResult {
    status: number;
    message: string;
    data?: ProfilePayload;
}

export const getUserProfile = async (userId: string): Promise<ProfileResult> => {
    try {
        const user = await findUserById(userId);
        if (!user) return { status: 404, message: "User not found" };
        return { status: 200, message: "Profile fetched", data: toProfilePayload(user) };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
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
    data?: ProfilePayload;
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

        if (data.resume !== undefined) {
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

        const patch: UserPatch = {};
        if (data.name !== undefined) patch.name = data.name;
        // "" clears a text field; [] clears a structured one.
        if (data.headline !== undefined) patch.headline = data.headline || null;
        if (data.location !== undefined) patch.location = data.location || null;
        if (data.skills !== undefined) patch.skills = data.skills.length > 0 ? data.skills : null;
        if (data.experience !== undefined) {
            patch.experience = data.experience.length > 0 ? data.experience : null;
        }
        if (data.education !== undefined) {
            patch.education = data.education.length > 0 ? data.education : null;
        }
        if (data.resume !== undefined) {
            patch.resume = encryptField(data.resume) ?? null;
            patch.resumeName = data.resumeName ?? existingUser.resumeName ?? "resume.pdf";
            patch.resumeUpdatedAt = new Date();
            // A new file has never been read, so the record must stop claiming
            // otherwise — the profile's sections still describe the old one.
            patch.resumeParsedAt = null;
            // A resume on record is exactly what onboarding means (see
            // requireOnboarded), so saving one from here finishes it rather than
            // sending the candidate back to a flow that only uploads a resume.
            if (!existingUser.onboardingCompleted) patch.onboardingCompleted = true;
        }
        if (data.photo !== undefined) patch.photo = data.photo ? (encryptField(data.photo) ?? null) : null;
        if (data.audio !== undefined) patch.audio = data.audio ? (encryptField(data.audio) ?? null) : null;

        const updatedUser = await updateUser(userId, patch);
        if (!updatedUser) {
            return { status: 404, message: "User not found" };
        }

        return {
            status: 200,
            message: "Profile updated",
            data: toProfilePayload(updatedUser),
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

/** The three artifacts a candidate can hand over, each stored sealed. */
export type ProfileMediaKind = "resume" | "photo" | "voice";

const MEDIA_FALLBACK_TYPE: Record<ProfileMediaKind, string> = {
    resume: "application/pdf",
    photo: "image/jpeg",
    voice: "audio/webm",
};

export interface MediaResult {
    status: number;
    message: string;
    file?: { body: Buffer; contentType: string; filename: string };
}

/**
 * One stored artifact, decrypted, for the account that owns it. The handler runs
 * behind the session, so this never serves anyone else's file.
 */
export const getProfileMedia = async (
    userId: string,
    kind: ProfileMediaKind,
): Promise<MediaResult> => {
    try {
        const user = await findUserById(userId);
        if (!user) return { status: 404, message: "User not found" };

        const sealed = kind === "resume" ? user.resume : kind === "photo" ? user.photo : user.audio;
        if (!sealed) {
            const noun = kind === "voice" ? "voice sample" : kind === "photo" ? "headshot" : "resume";
            return { status: 404, message: `No ${noun} on record` };
        }

        const plain = decryptField(sealed);
        if (!plain) {
            return {
                status: 500,
                message:
                    "The stored file cannot be read back on this server — ENCRYPTION_KEY is missing or has changed.",
            };
        }

        const { body, contentType } = decodeStoredFile(plain, MEDIA_FALLBACK_TYPE[kind]);
        const extension = (contentType.split("/")[1] ?? "").split(";")[0] || "bin";
        return {
            status: 200,
            message: "File fetched",
            file: {
                body,
                contentType,
                filename:
                    kind === "resume"
                        ? user.resumeName || `resume.${extension}`
                        : `${kind === "voice" ? "voice-sample" : "headshot"}.${extension}`,
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export interface ParseResumeResult {
    status: number;
    message: string;
    /** Which sections the read filled, by field name. */
    changed?: string[];
    /** What the read would change, section by section. Only on a preview. */
    preview?: ReadPreview[];
    data?: ProfilePayload;
}

/** The profile sections a read may fill, and the label each carries. */
const READ_SECTIONS = {
    headline: "Headline",
    location: "Location",
    skills: "Skills",
    experience: "Roles",
    education: "Education",
} as const;

export type ReadSection = keyof typeof READ_SECTIONS;

export interface ReadPreview {
    section: ReadSection;
    label: string;
    /** What the candidate has now, and what the read found instead. */
    current: unknown;
    next: unknown;
    /** True when the read would replace something the candidate already set. */
    replaces: boolean;
}

export interface ParseResumeOptions {
    /**
     * False by default: preview the read and write nothing. The candidate's own
     * corrections are the record, so a read may only ever propose until they
     * accept it. True writes the accepted sections.
     */
    apply?: boolean;
    /** Which sections to write when applying. Defaults to every section found. */
    sections?: ReadSection[];
}

/** True when a section holds anything worth protecting from a read. */
const hasContent = (value: unknown): boolean => {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
};

/**
 * Reads the resume on record into the structured profile.
 *
 * A preview returns what each section would become without writing anything, so
 * re-reading can never silently undo a correction. Applying writes only the
 * accepted sections, and never clears a section the read found nothing for.
 */
export const parseResumeIntoProfile = async (
    userId: string,
    options: ParseResumeOptions = {},
): Promise<ParseResumeResult> => {
    try {
        const user = await findUserById(userId);
        if (!user) return { status: 404, message: "User not found" };
        if (!user.resume) {
            return { status: 404, message: "No resume on record yet. Add one first." };
        }

        const resumePlain = decryptField(user.resume);
        if (!resumePlain) {
            return {
                status: 500,
                message:
                    "The stored resume cannot be read back on this server — ENCRYPTION_KEY is missing or has changed.",
            };
        }

        let resumeText: string;
        try {
            resumeText = await extractTextFromBase64Pdf(resumePlain);
        } catch (parseError: unknown) {
            const detail = parseError instanceof Error ? parseError.message : "unknown error";
            return {
                status: 422,
                message: `That file could not be read as a PDF (${detail}). Replace it and try again.`,
            };
        }
        if (resumeText.trim().length < 40) {
            return {
                status: 422,
                message:
                    "Your PDF holds almost no readable text, so there is nothing to read a profile from. If it is a scan, replace it with a text-based PDF.",
            };
        }

        let read: unknown;
        try {
            read = await aiParseResume(resumeText);
        } catch (aiError: unknown) {
            const detail = aiError instanceof Error ? aiError.message : "unknown error";
            return {
                status: 503,
                message: `Reading your resume is unavailable right now — ${detail}`,
            };
        }

        const parsed = parsedProfileValidation.safeParse(read);
        if (!parsed.success) {
            return {
                status: 502,
                message:
                    "The resume read came back in a shape this platform cannot store, so nothing was changed. Try again.",
            };
        }
        const patch: UserPatch = { resumeParsedAt: new Date() };
        const changed: string[] = [];
        const preview: ReadPreview[] = [];
        const accepted = options.sections;

        for (const [section, label] of Object.entries(READ_SECTIONS) as [
            ReadSection,
            string,
        ][]) {
            const next = parsed.data[section];
            if (!hasContent(next)) continue;

            preview.push({ section, label, current: user[section], next, replaces: hasContent(user[section]) });
            const apply = options.apply === true && (!accepted || accepted.includes(section));
            if (!apply) continue;

            if (section === "headline") patch.headline = String(next);
            if (section === "location") patch.location = String(next);
            if (section === "skills") patch.skills = next as string[];
            if (section === "experience") patch.experience = next as ProfileExperience[];
            if (section === "education") patch.education = next as ProfileEducation[];
            changed.push(section);
        }

        if (preview.length === 0) {
            return {
                status: 200,
                message: "The read finished without finding anything to add.",
                changed,
                preview,
                data: toProfilePayload(user),
            };
        }

        // A preview writes nothing: the candidate sees the proposal and accepts
        // the sections they want, so a re-read cannot undo their corrections.
        if (options.apply !== true || changed.length === 0) {
            return {
                status: 200,
                message:
                    changed.length === 0
                        ? "Nothing you had set was replaced — the read found no sections to fill."
                        : "The read found sections to fill.",
                changed,
                preview,
                data: toProfilePayload(user),
            };
        }

        const updatedUser = await updateUser(userId, patch);
        if (!updatedUser) {
            return { status: 404, message: "User not found" };
        }

        return {
            status: 200,
            message: "Resume read",
            changed,
            preview,
            data: toProfilePayload(updatedUser),
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
