import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { organizationMembers, organizations } from "../schema";
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
    const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return rows[0] ?? null;
}

export async function findOrganizationRowBySlug(slug: string): Promise<OrganizationRow | null> {
    const rows = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    return rows[0] ?? null;
}

export async function createOrganizationRow(input: {
    name: string;
    slug: string;
    createdBy: string;
}) {
    const rows = await db
        .insert(organizations)
        .values({ name: input.name, slug: input.slug, createdBy: input.createdBy })
        .returning();
    return withId(rows[0]);
}

export async function updateOrganizationName(id: string, name: string) {
    const rows = await db
        .update(organizations)
        .set({ name, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning();
    return rows[0] ? withId(rows[0]) : null;
}

/** Builds the Mongoose-style `members` array with populated user objects. */
async function withMembers(orgRows: OrganizationRow[]): Promise<OrgWithMembers[]> {
    if (orgRows.length === 0) return [];
    const orgIds = orgRows.map((o) => o.id);

    const memberRows = await db
        .select()
        .from(organizationMembers)
        .where(inArray(organizationMembers.organizationId, orgIds));

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
    const memberRows = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId));
    if (memberRows.length === 0) return { orgs: [], total: 0 };

    const orgIds = memberRows.map((m) => m.organizationId);
    const orgRows = await db
        .select()
        .from(organizations)
        .where(inArray(organizations.id, orgIds))
        .orderBy(desc(organizations.createdAt));

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
    const rows = await db
        .select()
        .from(organizationMembers)
        .where(
            and(
                eq(organizationMembers.organizationId, orgId),
                eq(organizationMembers.userId, userId),
            ),
        )
        .limit(1);
    return rows[0] ?? null;
}

export async function addMember(orgId: string, userId: string, role: "admin" | "recruiter") {
    await db.insert(organizationMembers).values({ organizationId: orgId, userId, role });
}

export async function listOrgIdsForUser(userId: string): Promise<string[]> {
    const rows = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId));
    return rows.map((r) => r.organizationId);
}
