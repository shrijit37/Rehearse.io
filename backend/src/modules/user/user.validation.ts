import z from "zod";
import type { ProfileEducation, ProfileExperience } from "../../db/schema";

/**
 * Field caps for one role. Shared by the two writers of these columns — the
 * candidate's own input and the resume read — so both land inside the same
 * limits, and the read cannot write a shape the page cannot edit.
 */
export const profileExperienceFields = z.object({
    title: z.string().trim().max(120).default(""),
    company: z.string().trim().max(120).default(""),
    period: z.string().trim().max(60).optional(),
    summary: z.string().trim().max(1200).optional(),
});

/** One role as the candidate maintains it: a row needs a title or a company. */
export const profileExperienceValidation = profileExperienceFields.refine(
    (row) => row.title.length > 0 || row.company.length > 0,
    { message: "A role needs a title or a company" },
);

/** One qualification in the candidate-maintained profile. */
export const profileEducationFields = z.object({
    school: z.string().trim().max(160).default(""),
    qualification: z.string().trim().max(120).optional(),
    period: z.string().trim().max(60).optional(),
});

export const onboardValidation = z.object({
    resumeName: z.string().optional(),
    resume: z.string().min(1, "Resume is required"),
    photo: z.string().optional(),
    audio: z.string().optional(),
});

export type OnboardValidation = z.infer<typeof onboardValidation>;

/**
 * Every field the candidate maintains, all optional: a save sends only the plate
 * it belongs to. Text fields accept "" to clear them; the structured arrays
 * accept [] for the same reason.
 */
export const updateProfileValidation = z
    .object({
        name: z.string().trim().min(1, "A name cannot be empty").max(100).optional(),
        headline: z.string().trim().max(160).optional(),
        location: z.string().trim().max(80).optional(),
        skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
        experience: z.array(profileExperienceValidation).max(20).optional(),
        education: z.array(profileEducationFields).max(10).optional(),
        resume: z.string().min(1).optional(),
        resumeName: z.string().trim().max(200).optional(),
        photo: z.string().optional(),
        audio: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Provide at least one field to update",
    })
    .refine((data) => data.resumeName === undefined || typeof data.resume === "string", {
        message: "A resume file name needs the resume it names",
    });

export type UpdateProfileValidation = z.infer<typeof updateProfileValidation>;

/**
 * The resume read's own output, validated before it is stored: a model wrote it,
 * so the row fields are filled from their defaults rather than required, while
 * every cap still applies.
 */
export const parsedProfileValidation = z.object({
    headline: z.string().trim().max(160).optional(),
    location: z.string().trim().max(80).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    experience: z.array(profileExperienceFields).max(20).optional(),
    education: z.array(profileEducationFields).max(10).optional(),
});

export type ParsedProfileValidation = z.infer<typeof parsedProfileValidation>;

/** What the candidate sends when asking for a read, and what they accept from it. */
export const parseResumeRequest = z.object({
    /** Omitted or false previews the read and writes nothing. */
    apply: z.boolean().optional(),
    /** Which sections to write when applying. Defaults to every section found. */
    sections: z
        .array(z.enum(["headline", "location", "skills", "experience", "education"]))
        .max(5)
        .optional(),
});

export type ParseResumeRequest = z.infer<typeof parseResumeRequest>;

/** A stored artifact as the candidate may read it back. */
export interface ProfileArtifact {
    present: boolean;
    /** Bytes behind the stored file, or null when it cannot be read back. */
    sizeBytes?: number | null;
    name?: string | null;
    updatedAt?: Date | null;
}

/** What a practice round is generated from, and where that text comes from. */
export type RoundSource =
    | { kind: "profile"; text: string }
    | { kind: "resume"; text: null }
    | { kind: "none"; text: null };

/** The candidate's own record, as `GET /api/users` returns it. */
export interface ProfilePayload {
    _id: string;
    id: string;
    name: string;
    email: string;
    role: "candidate" | "recruiter";
    createdAt: Date;
    onboardingCompleted: boolean;
    onboarded: boolean;
    headline: string | null;
    location: string | null;
    skills: string[];
    experience: ProfileExperience[];
    education: ProfileEducation[];
    resumeParsedAt: Date | null;
    resume: ProfileArtifact;
    photo: ProfileArtifact;
    voice: ProfileArtifact;
    consent: { given: boolean; date: Date | null; version: string | null };
    roundSource: RoundSource;
}
