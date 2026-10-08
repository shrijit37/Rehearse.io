import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";
import { withId, type PopulatedUser } from "../shape";

/** Columns safe to return to any caller (never includes the password hash). */
export const USER_PUBLIC_COLUMNS = {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    organizationId: users.organizationId,
    resumeName: users.resumeName,
    resume: users.resume,
    photo: users.photo,
    audio: users.audio,
    consentGiven: users.consentGiven,
    consentDate: users.consentDate,
    consentVersion: users.consentVersion,
    onboardingCompleted: users.onboardingCompleted,
    isInvitedPlaceholder: users.isInvitedPlaceholder,
    isDeleted: users.isDeleted,
    deletedAt: users.deletedAt,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
} as const;

export type PublicUser = typeof users.$inferSelect;

export async function findUserById(id: string) {
    const rows = await db.select(USER_PUBLIC_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? withId(rows[0]) : null;
}

export async function findUserByEmail(email: string) {
    const rows = await db.select(USER_PUBLIC_COLUMNS).from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ? withId(rows[0]) : null;
}

/** Includes the password hash. Only the login and account-deletion paths. */
export async function findUserWithPasswordByEmail(email: string) {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ?? null;
}

export async function setUserOrganization(userId: string, organizationId: string) {
    await db.update(users).set({ organizationId, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function findUserWithPasswordById(id: string) {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
}

/** Batch lookup used to populate member/creator references. */
export async function findUsersByIds(ids: string[]): Promise<Map<string, PopulatedUser>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(inArray(users.id, unique));
    const out = new Map<string, PopulatedUser>();
    for (const row of rows) {
        out.set(row.id, { ...row, _id: row.id });
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
    password: string;
    role?: "recruiter" | "candidate";
    isInvitedPlaceholder?: boolean;
    consentGiven?: boolean;
    consentDate?: Date | null;
    consentVersion?: string | null;
}

export async function createUser(input: CreateUserInput) {
    const rows = await db
        .insert(users)
        .values({
            name: sanitizeName(input.name),
            email: input.email,
            password: input.password,
            role: input.role ?? "candidate",
            isInvitedPlaceholder: input.isInvitedPlaceholder ?? false,
            consentGiven: input.consentGiven ?? false,
            consentDate: input.consentDate ?? null,
            consentVersion: input.consentVersion ?? null,
        })
        .returning(USER_PUBLIC_COLUMNS);
    return withId(rows[0]);
}

export type UserPatch = Partial<{
    name: string;
    email: string;
    password: string;
    role: "recruiter" | "candidate";
    isInvitedPlaceholder: boolean;
    consentGiven: boolean;
    consentDate: Date | null;
    consentVersion: string | null;
    resumeName: string | null;
    resume: string | null;
    photo: string | null;
    audio: string | null;
    onboardingCompleted: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    organizationId: string | null;
}>;

export async function updateUser(id: string, patch: UserPatch) {
    const value = patch.name !== undefined ? { ...patch, name: sanitizeName(patch.name) } : patch;
    const rows = await db
        .update(users)
        .set({ ...value, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning(USER_PUBLIC_COLUMNS);
    return rows[0] ? withId(rows[0]) : null;
}

export async function isOnboarded(id: string): Promise<boolean> {
    const rows = await db
        .select({ onboardingCompleted: users.onboardingCompleted })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
    return rows[0]?.onboardingCompleted === true;
}
