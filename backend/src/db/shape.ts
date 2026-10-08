/**
 * Row-shaping helpers shared by the repository layer.
 *
 * The HTTP contract exposes every record's primary key as `_id` (that is what
 * the React frontend reads), while Postgres/Drizzle use `id`. These helpers keep
 * both names available so controllers and services stay unchanged.
 */
import * as t from "./schema";

export type { DsaProblem, DsaResultItem, ResultItem } from "./schema";

export type UserRow = typeof t.users.$inferSelect;
export type OrganizationRow = typeof t.organizations.$inferSelect;
export type OrganizationMemberRow = typeof t.organizationMembers.$inferSelect;
export type InterviewRow = typeof t.interviewSessions.$inferSelect;
export type InviteRow = typeof t.candidateInvites.$inferSelect;
export type RehearsalRow = typeof t.rehearsalSessions.$inferSelect;
export type AuditRow = typeof t.auditLogs.$inferSelect;

export type WithId<T extends { id: string }> = T & { _id: string };

/** Adds `_id` alongside the Drizzle `id`. */
export function withId<T extends { id: string }>(row: T): WithId<T>;
export function withId<T extends { id: string }>(row: T | undefined): WithId<T> | null;
export function withId<T extends { id: string }>(row: T | undefined): WithId<T> | null {
    // Drizzle types `.returning()` as `T[]` even though an INSERT always yields
    // a row; treat an empty result as "not found" rather than crashing.
    return row ? { ...row, _id: row.id } : null;
}

export function withIds<T extends { id: string }>(rows: T[]): WithId<T>[] {
    return rows.map((row) => ({ ...row, _id: row.id }));
}

/** A user without `password`. The default for every read path. */
export type PublicUser = Omit<UserRow, "password">;
export type WithIdPublicUser = WithId<PublicUser>;

/** Minimal user shape embedded by populated references. */
export type PopulatedUser = {
    _id: string;
    id: string;
    name: string;
    email: string;
    role: "recruiter" | "candidate";
};
