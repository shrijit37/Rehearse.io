import { findUserByEmail, setUserOrganization } from "../../db/repositories/users";
import {
    addMember,
    createOrganizationRow,
    findMembership,
    findOrganizationRowBySlug,
    getOrganizationWithMembers,
    listOrganizationsForUser,
    updateOrganizationName,
} from "../../db/repositories/organizations";

export interface OrgResult {
    status: number;
    message: string;
    organization?: unknown;
    member?: unknown;
    data?: unknown;
    page?: number;
    limit?: number;
    total?: number;
}

/** True when the id looks like a UUID. Replaces ObjectId.isValid(). */
const isValidId = (id: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const createOrganization = async (
    userId: string,
    name: string,
): Promise<OrgResult> => {
    try {
        if (!name || name.trim().length < 2) {
            return { status: 400, message: "Organization name must be at least 2 characters" };
        }

        const slug = name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        const existing = await findOrganizationRowBySlug(slug);
        const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

        const organization = await createOrganizationRow({
            name: name.trim(),
            slug: finalSlug,
            createdBy: userId,
        });
        if (!organization) {
            return { status: 500, message: "Failed to create organization" };
        }

        // Creator joins as admin.
        await addMember(organization.id, userId, "admin");
        await setUserOrganization(userId, organization.id);

        const withMembers = await getOrganizationWithMembers(organization.id);
        return {
            status: 201,
            message: "Organization created",
            organization: withMembers ?? organization,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getMyOrganizations = async (
    userId: string,
    page: number,
    limit: number,
): Promise<OrgResult> => {
    try {
        const skip = (page - 1) * limit;
        const { orgs, total } = await listOrganizationsForUser(userId, skip, limit);
        return {
            status: 200,
            message: "Organizations fetched",
            data: orgs,
            page,
            limit,
            total,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const getOrganization = async (
    userId: string,
    orgId: string,
): Promise<OrgResult> => {
    try {
        if (!isValidId(orgId)) {
            return { status: 400, message: "Invalid organization ID format" };
        }

        const organization = await getOrganizationWithMembers(orgId);
        if (!organization) return { status: 404, message: "Organization not found" };

        const isMember = organization.members.some((m) => m.user.id === userId);
        if (!isMember) {
            return {
                status: 403,
                message: "You are not a member of this organization",
            };
        }

        return { status: 200, message: "Organization fetched", organization };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const updateOrganization = async (
    userId: string,
    orgId: string,
    name: string,
): Promise<OrgResult> => {
    try {
        if (!isValidId(orgId)) {
            return { status: 400, message: "Invalid organization ID format" };
        }

        const membership = await findMembership(orgId, userId);
        if (!membership || membership.role !== "admin") {
            // Distinguish "no such org" from "not allowed" for a clearer error.
            const organization = membership
                ? null
                : await getOrganizationWithMembers(orgId);
            if (!organization) return { status: 404, message: "Organization not found" };
            return { status: 403, message: "Only admins can update the organization" };
        }

        if (name) await updateOrganizationName(orgId, name.trim());
        const organization = await getOrganizationWithMembers(orgId);
        return { status: 200, message: "Organization updated", organization };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};

export const inviteMember = async (
    userId: string,
    orgId: string,
    email: string,
    role: string,
): Promise<OrgResult> => {
    try {
        if (!isValidId(orgId)) {
            return { status: 400, message: "Invalid organization ID format" };
        }

        const membership = await findMembership(orgId, userId);
        if (!membership || !["admin", "recruiter"].includes(membership.role)) {
            return { status: 403, message: "Insufficient permissions" };
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { status: 400, message: "Please provide a valid email address" };
        }

        const requestedRole = role || "recruiter";
        if (requestedRole === "admin" && membership.role !== "admin") {
            return { status: 403, message: "Only admins can assign admin role" };
        }
        if (!["admin", "recruiter"].includes(requestedRole)) {
            return { status: 400, message: "Role must be either 'admin' or 'recruiter'" };
        }

        const userToAdd = await findUserByEmail(email.toLowerCase().trim());
        if (!userToAdd) return { status: 404, message: "User not found with that email" };

        const alreadyMember = await findMembership(orgId, userToAdd.id);
        if (alreadyMember) return { status: 400, message: "User is already a member" };

        await addMember(orgId, userToAdd.id, requestedRole as "admin" | "recruiter");
        await setUserOrganization(userToAdd.id, orgId);

        const member = {
            user: { _id: userToAdd.id, id: userToAdd.id, name: userToAdd.name, email: userToAdd.email },
            role: requestedRole,
            email,
        };

        return { status: 200, message: "Member added", member };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};
