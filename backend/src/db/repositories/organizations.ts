import { db } from "../index";
import { read, toDb, unwrap } from "../mappers";
import { withId, type OrganizationRow, type PopulatedUser } from "../shape";
import { findUsersByIds } from "./users";

export interface OrgMember {
    user: PopulatedUser;
    role: "admin" | "recruiter";
    joinedAt: Date;
}

export interface OrgWithMembers {
    _id: string;
    id: string;
    name: string;
    slug: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    members: OrgMember[];
}

export async function findOrganizationRowById(id: string): Promise<OrganizationRow | null> {
    const rows = unwrap(await db.from("organizations").select("*").eq("id", id).limit(1));
    return rows[0] ? read.organization(rows[0] as Record<string, unknown>) : null;
}

export async function findOrganizationRowBySlug(slug: string): Promise<OrganizationRow | null> {
    const rows = unwrap(await db.from("organizations").select("*").eq("slug", slug).limit(1));
    return rows[0] ? read.organization(rows[0] as Record<string, unknown>) : null;
}

export async function createOrganizationRow(input: {
    name: string;
    slug: string;
    createdBy: string;
}) {
    const rows = unwrap(
        await db
            .from("organizations")
            .insert(toDb("organizations", { ...input }))
            .select(),
    );
    return withId(read.organization(rows[0] as Record<string, unknown>));
}

export async function updateOrganizationName(id: string, name: string) {
    const rows = unwrap(
        await db
            .from("organizations")
            .update(toDb("organizations", { name, updatedAt: new Date() }))
            .eq("id", id)
            .select(),
    );
    return rows[0] ? withId(read.organization(rows[0] as Record<string, unknown>)) : null;
}

/** Builds the Mongoose-style `members` array with populated user objects. */
async function withMembers(orgRows: OrganizationRow[]): Promise<OrgWithMembers[]> {
    if (orgRows.length === 0) return [];
    const orgIds = orgRows.map((o) => o.id);

    const rows = unwrap(
        await db.from("organization_members").select("*").in("organization_id", orgIds),
    );
    const memberRows = rows.map((row) => read.member(row as Record<string, unknown>));

    const userMap = await findUsersByIds(memberRows.map((m) => m.userId));

    return orgRows.map((org) => ({
        ...withId(org),
        members: memberRows
            .filter((m) => m.organizationId === org.id)
            .map((m) => ({
                user: userMap.get(m.userId) ?? {
                    _id: m.userId,
                    id: m.userId,
                    name: "",
                    email: "",
                    role: "candidate" as const,
                },
                role: m.role,
                joinedAt: m.joinedAt,
            })),
    }));
}

/** Organizations the user is a member of, newest first, paginated. */
export async function listOrganizationsForUser(
    userId: string,
    skip: number,
    limit: number,
): Promise<{ orgs: OrgWithMembers[]; total: number }> {
    const memberRowsRaw = unwrap(
        await db
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", userId),
    );
    if (memberRowsRaw.length === 0) return { orgs: [], total: 0 };

    const orgIds = memberRowsRaw.map((m) => (m as { organization_id: string }).organization_id);
    const rows = unwrap(
        await db
            .from("organizations")
            .select("*")
            .in("id", orgIds)
            .order("created_at", { ascending: false }),
    );
    const orgRows = rows.map((row) => read.organization(row as Record<string, unknown>));

    const page = orgRows.slice(skip, skip + limit);
    return { orgs: await withMembers(page), total: orgRows.length };
}

export async function getOrganizationWithMembers(id: string): Promise<OrgWithMembers | null> {
    const org = await findOrganizationRowById(id);
    if (!org) return null;
    const [result] = await withMembers([org]);
    return result ?? null;
}

export async function findMembership(orgId: string, userId: string) {
    const rows = unwrap(
        await db
            .from("organization_members")
            .select("*")
            .eq("organization_id", orgId)
            .eq("user_id", userId)
            .limit(1),
    );
    return rows[0] ? read.member(rows[0] as Record<string, unknown>) : null;
}

export async function addMember(orgId: string, userId: string, role: "admin" | "recruiter") {
    unwrap(
        await db
            .from("organization_members")
            .insert(toDb("organization_members", { organizationId: orgId, userId, role }))
            .select("id"),
    );
}

export async function listOrgIdsForUser(userId: string): Promise<string[]> {
    const rows = unwrap(
        await db
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", userId),
    );
    return rows.map((r) => (r as { organization_id: string }).organization_id);
}
