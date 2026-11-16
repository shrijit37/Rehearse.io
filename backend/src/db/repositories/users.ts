import { db } from "../index";
import { read, toDb, unwrap } from "../mappers";
import type { UserRow } from "../schema";
import type { ProfileEducation, ProfileExperience } from "../schema";
import { withId, type PopulatedUser, type WithId } from "../shape";

/** Columns safe to return to any caller (never includes the password hash). */
export const USER_PUBLIC_COLUMNS = [
    "id",
    "name",
    "email",
    "auth_id",
    "role",
    "organization_id",
    "resume_name",
    "resume",
    "photo",
    "audio",
    "headline",
    "location",
    "skills",
    "experience",
    "education",
    "resume_parsed_at",
    "resume_updated_at",
    "consent_given",
    "consent_date",
    "consent_version",
    "onboarding_completed",
    "is_invited_placeholder",
    "is_deleted",
    "deleted_at",
    "created_at",
    "updated_at",
] as const;

const PUBLIC_SELECT = USER_PUBLIC_COLUMNS.join(",");

export type PublicUser = UserRow;

/**
 * A user row as the read paths below return it: the public columns plus `_id`.
 * Named here rather than derived from the function, so consumers (a published
 * payload type, the auth session mapping) depend on the contract, not on the
 * query's inferred shape.
 */
export type UserRecord = WithId<Omit<PublicUser, "password">>;

function publicUser(row: Record<string, unknown>): Omit<UserRow, "password"> {
    const mapped = read.user(row);
    const { password: _password, ...rest } = mapped;
    return rest;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
    const rows = unwrap(await db.from("users").select("*").eq("id", id).limit(1));
    return rows[0] ? withId(publicUser(rows[0] as Record<string, unknown>)) : null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = unwrap(await db.from("users").select("*").eq("email", email).limit(1));
    return rows[0] ? withId(publicUser(rows[0] as Record<string, unknown>)) : null;
}

/** Looks a visitor up by the account id minted by Supabase Auth. */
export async function findUserByAuthId(authId: string): Promise<UserRecord | null> {
    const rows = unwrap(await db.from("users").select("*").eq("auth_id", authId).limit(1));
    return rows[0] ? withId(publicUser(rows[0] as Record<string, unknown>)) : null;
}

export async function setUserOrganization(userId: string, organizationId: string) {
    unwrap(
        await db
            .from("users")
            .update(toDb("users", { organizationId, updatedAt: new Date() }))
            .eq("id", userId)
            .select("id"),
    );
}

/** Batch lookup used to populate member/creator references. */
export async function findUsersByIds(ids: string[]): Promise<Map<string, PopulatedUser>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = unwrap(await db.from("users").select("id,name,email,role").in("id", unique));
    const out = new Map<string, PopulatedUser>();
    for (const row of rows) {
        const user = read.user(row as Record<string, unknown>);
        out.set(user.id, { ...user, _id: user.id });
    }
    return out;
}

/** Mirrors the old `pre("save")` hook: strip HTML tags from the display name. */
function sanitizeName(name: string): string {
    return name.replace(/<[^>]*>/g, "").trim();
}

export interface CreateUserInput {
    name: string;
    email: string;
    authId?: string;
    password?: string | null;
    role?: "recruiter" | "candidate";
    isInvitedPlaceholder?: boolean;
    consentGiven?: boolean;
    consentDate?: Date | null;
    consentVersion?: string | null;
}

export async function createUser(input: CreateUserInput) {
    const rows = unwrap(
        await db
            .from("users")
            .insert(
                toDb("users", {
                    name: sanitizeName(input.name),
                    email: input.email,
                    password: input.password ?? null,
                    authId: input.authId ?? null,
                    role: input.role ?? "candidate",
                    isInvitedPlaceholder: input.isInvitedPlaceholder ?? false,
                    consentGiven: input.consentGiven ?? false,
                    consentDate: input.consentDate ?? null,
                    consentVersion: input.consentVersion ?? null,
                }),
            )
            .select("*"),
    );
    return withId(publicUser(rows[0] as Record<string, unknown>));
}

export type UserPatch = Partial<{
    name: string;
    email: string;
    authId: string | null;
    password: string | null;
    role: "recruiter" | "candidate";
    isInvitedPlaceholder: boolean;
    consentGiven: boolean;
    consentDate: Date | null;
    consentVersion: string | null;
    resumeName: string | null;
    resume: string | null;
    resumeUpdatedAt: Date | null;
    photo: string | null;
    audio: string | null;
    headline: string | null;
    location: string | null;
    skills: string[] | null;
    experience: ProfileExperience[] | null;
    education: ProfileEducation[] | null;
    resumeParsedAt: Date | null;
    onboardingCompleted: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    organizationId: string | null;
}>;

export async function updateUser(id: string, patch: UserPatch) {
    const value = patch.name !== undefined ? { ...patch, name: sanitizeName(patch.name) } : patch;
    const rows = unwrap(
        await db
            .from("users")
            .update(toDb("users", { ...value, updatedAt: new Date() }))
            .eq("id", id)
            .select("*"),
    );
    return rows[0] ? withId(publicUser(rows[0] as Record<string, unknown>)) : null;
}

export async function isOnboarded(id: string): Promise<boolean> {
    const rows = unwrap(
        await db.from("users").select("onboarding_completed").eq("id", id).limit(1),
    );
    return (rows[0] as { onboarding_completed?: boolean } | undefined)?.onboarding_completed === true;
}
