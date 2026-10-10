import {
    createUser,
    findUserByAuthId,
    findUserByEmail,
    updateUser,
    type UserPatch,
} from "../../db/repositories/users";
import type { IClaimSchema } from "./auth.validation";

/** The user object the shared auth service returns for a valid session. */
export interface SessionUser {
    id: string;
    email: string;
    name?: string | null;
}

/** A local user row as the repository returns it: public columns plus _id, no password. */
type LocalUser = NonNullable<Awaited<ReturnType<typeof findUserByAuthId>>>;

export const toPublicUser = (user: LocalUser) => ({
    id: user.id,
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    onboarded: user.onboardingCompleted === true,
});

/**
 * Maps a shared-auth session onto a local user row: same account -> same row,
 * an invited placeholder with a matching email -> claimed, otherwise created.
 * Returns null when the row cannot be trusted (deleted, or already bound to a
 * different auth account), which the middleware turns into a 401.
 */
export async function resolveSessionUser(sessionUser: SessionUser): Promise<LocalUser | null> {
    const email = sessionUser.email.toLowerCase().trim();
    const byAuthId = await findUserByAuthId(sessionUser.id);
    const existing = byAuthId ?? (await findUserByEmail(email));

    if (!existing) {
        return await createUser({
            name: sessionUser.name?.trim() || email,
            email,
            authId: sessionUser.id,
            role: "candidate",
        });
    }

    if (existing.isDeleted) return null;
    if (existing.authId && existing.authId !== sessionUser.id) return null;

    const patch: UserPatch = { authId: sessionUser.id, isInvitedPlaceholder: false };
    if (sessionUser.name?.trim()) patch.name = sessionUser.name.trim();

    return (await updateUser(existing._id, patch)) ?? existing;
}

/** Records the choices the sign-up form collected here: role and consent. */
export async function claimProfile(userId: string, data: IClaimSchema): Promise<LocalUser> {
    const patch: UserPatch = {};
    if (data.role) patch.role = data.role;
    if (data.consentGiven !== undefined) {
        patch.consentGiven = data.consentGiven;
        patch.consentDate = data.consentGiven ? new Date() : null;
        if (data.consentVersion) patch.consentVersion = data.consentVersion;
    }

    const user = await updateUser(userId, patch);
    if (!user) throw new Error(`User ${userId} not found`);
    return user;
}