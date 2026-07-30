import z from "zod";

export const getUserValidation = z.object({
    _id: z.string()
});

export type GetUserValidation = z.infer<typeof getUserValidation>;

export interface GetUserDetails {
    status: number,
    data: {
        _id: string,
        email: string | null,
        name?: string | null,
        audio?: string | null,
        photo?: string | null,
        resume?: string | null,
        resumeName?: string | null,
        onboardingCompleted?: boolean,
        onboarded?: boolean,
    },
    message: string,
}

export const onboardValidation = z.object({
    resumeName: z.string().optional(),
    resume: z.string().min(1, "Resume is required"),
    photo: z.string().optional(),
    audio: z.string().optional(),
});

export type OnboardValidation = z.infer<typeof onboardValidation>;

export const updateProfileValidation = z.object({
    photo: z.string().optional(),
    audio: z.string().optional(),
}).refine(data => data.photo !== undefined || data.audio !== undefined, {
    message: "Provide at least one field to update: photo or audio",
});

export type UpdateProfileValidation = z.infer<typeof updateProfileValidation>;