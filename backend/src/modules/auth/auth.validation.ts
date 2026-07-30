import zod from "zod";

export const SignUpSchema = zod.object({
    name: zod.string().min(2).max(100),
    email: zod.string().email(),
    password: zod.string().min(8).max(128),
    role: zod.enum(["recruiter", "candidate"]).optional(),
    consentGiven: zod.boolean().optional(),
    consentVersion: zod.string().optional(),
});

export type ISignUpSchema = zod.infer<typeof SignUpSchema>;

export const LoginSchema = zod.object({
    email: zod.string().email(),
    password: zod.string().min(8).max(128),
});

export type ILoginSchema = zod.infer<typeof LoginSchema>;



