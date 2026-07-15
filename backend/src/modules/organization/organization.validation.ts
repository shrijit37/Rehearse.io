import z from "zod";

export const createOrganizationSchema = z.object({
    name: z.string().min(2, "Organization name must be at least 2 characters"),
});

export const inviteMemberSchema = z.object({
    email: z.string().email("Please provide a valid email address"),
    role: z.enum(["admin", "recruiter"]).optional(),
});