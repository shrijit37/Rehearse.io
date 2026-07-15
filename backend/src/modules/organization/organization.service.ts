import { Organization } from "./organization.model";
import { User } from "../user/user.model";
import mongoose from "mongoose";

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

interface MemberData {
    user: mongoose.Types.ObjectId | string;
    role: "admin" | "recruiter";
    email?: string;
}

function memberRole(org: any, userId: string): string | null {
    const member = org.members?.find(
        (m: any) => m.user.toString() === userId,
    );
    return member?.role ?? null;
}

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

        const existing = await Organization.findOne({ slug });
        const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

        const organization = await Organization.create({
            name: name.trim(),
            slug: finalSlug,
            createdBy: userId,
            members: [{ user: userId, role: "admin" }],
        });

        // Link user to organization
        await User.findByIdAndUpdate(userId, { organization: organization._id });

        return {
            status: 201,
            message: "Organization created",
            organization: organization.toObject(),
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
        const filter = { "members.user": new mongoose.Types.ObjectId(userId) };

        const [organizations, total] = await Promise.all([
            Organization.find(filter)
                .populate("members.user", "name email role")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Organization.countDocuments(filter),
        ]);

        return {
            status: 200,
            message: "Organizations fetched",
            data: organizations,
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
        if (!mongoose.Types.ObjectId.isValid(orgId)) {
            return { status: 400, message: "Invalid organization ID format" };
        }

        const organization = await Organization.findById(orgId).populate(
            "members.user",
            "name email role",
        );
        if (!organization) return { status: 404, message: "Organization not found" };

        const isMember = organization.members.some(
            (m) => m.user._id.toString() === userId,
        );
        if (!isMember) {
            return { status: 403, message: "You are not a member of this organization" };
        }

        return { status: 200, message: "Organization fetched", organization: organization.toObject() };
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
        if (!mongoose.Types.ObjectId.isValid(orgId)) {
            return { status: 400, message: "Invalid organization ID format" };
        }

        const organization = await Organization.findById(orgId);
        if (!organization) return { status: 404, message: "Organization not found" };

        const membership = organization.members.find(
            (m) => m.user.toString() === userId,
        );
        if (!membership || membership.role !== "admin") {
            return { status: 403, message: "Only admins can update the organization" };
        }

        if (name) organization.name = name.trim();
        await organization.save();

        return { status: 200, message: "Organization updated", organization: organization.toObject() };
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
        if (!mongoose.Types.ObjectId.isValid(orgId)) {
            return { status: 400, message: "Invalid organization ID format" };
        }

        const organization = await Organization.findById(orgId);
        if (!organization) return { status: 404, message: "Organization not found" };

        const membership = organization.members.find(
            (m) => m.user.toString() === userId,
        );
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

        const userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
        if (!userToAdd) return { status: 404, message: "User not found with that email" };

        const alreadyMember = organization.members.some(
            (m) => m.user.toString() === userToAdd._id.toString(),
        );
        if (alreadyMember) return { status: 400, message: "User is already a member" };

        organization.members.push({ user: userToAdd._id, role: requestedRole as "admin" | "recruiter", joinedAt: new Date() });
        await organization.save();

        await User.findByIdAndUpdate(userToAdd._id, { organization: organization._id });

        const member: MemberData & { email: string } = {
            user: userToAdd._id,
            role: requestedRole as "admin" | "recruiter",
            email,
        };

        return { status: 200, message: "Member added", member };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { status: 500, message: `Internal server error: ${message}` };
    }
};