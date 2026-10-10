import zod from "zod";

/**
 * Sign-in lives on the shared auth service; the app only learns what a signed-in
 * visitor chose here: which side of the product they use and their consent.
 */
export const ClaimSchema = zod.object({
    role: zod.enum(["recruiter", "candidate"]).optional(),
    consentGiven: zod.boolean().optional(),
    consentVersion: zod.string().max(32).optional(),
});

export type IClaimSchema = zod.infer<typeof ClaimSchema>;