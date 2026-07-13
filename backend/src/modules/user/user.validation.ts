import z from "zod";

export const getUserValidation = z.object({
    id: z.string()
});

export type GetUserValidation = z.infer<typeof getUserValidation>;

export interface GetUserDetails {
    status: number,
    data: {
        id: string,
        email: string | null,
        name?: string | null,
        audio?: string | null,
        photo?: string | null,
        resume?: string | null,
        resumeName?: string | null,
        onboardingCompleted?: boolean,
    },
    message: string,
}