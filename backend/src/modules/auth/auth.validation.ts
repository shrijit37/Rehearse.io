import zod from "zod";

export const SignUpSchema = zod.object({
    name: zod.string().min(2),
    email: zod.email(),
    password: zod.string().min(6),
    role: zod.enum(["recruiter", "candidate"]),
    organization: zod.string(),
    resumeName: zod.string(),
    resume: zod.string(),
    photo: zod.string(),
    audio: zod.string(),
    consentGiven: zod.boolean(),
    consentDate: zod.coerce.date().nullable(),
    consentVersion: zod.string(),
    onboardingCompleted: zod.boolean(),
    isInvitedPlaceholder: zod.boolean(),
    isDeleted: zod.boolean(),
    deletedAt: zod.coerce.date().nullable()
});

export type ISignUpSchema = zod.infer<typeof SignUpSchema>

export const LoginSchema = zod.object({
    email: zod.email(),
    password: zod.string().min(8),
});

export type ILoginSchema = zod.infer<typeof LoginSchema>



