/**
 * Row-shaping helpers shared by the repository layer.
 *
 * The HTTP contract exposes every record's primary key as `_id` (that is what
 * the React frontend reads), while Postgres/Supabase use `id`. These helpers
 * keep both names available so controllers and services stay unchanged.
 */
import type { UserRow } from "./schema";

export type {
    AuditRow,
    DsaProblem,
    DsaResultItem,
    InterviewRow,
    InviteRow,
    OrganizationMemberRow,
    OrganizationRow,
    RehearsalRow,
    ResultItem,
    UserRow,
} from "./schema";

export type WithId<T extends { id: string }> = T & { _id: string };

/** Adds `_id` alongside the Postgres `id`. */
export function withId<T extends { id: string }>(row: T): WithId<T>;
export function withId<T extends { id: string }>(row: T | undefined): WithId<T> | null;
export function withId<T extends { id: string }>(row: T | undefined): WithId<T> | null {
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
