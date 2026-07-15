import type { Request, Response } from "express";
import {
    createOrganization,
    getMyOrganizations,
    getOrganization,
    updateOrganization,
    inviteMember,
} from "./organization.service";
import { logAudit } from "../../middleware/auditLog";
import { createOrganizationSchema, inviteMemberSchema } from "./organization.validation";

interface AuthenticatedRequest extends Request {
    user?: { _id: string; role: string };
}

function getUserId(req: Request): string | null {
    const user = (req as AuthenticatedRequest).user;
    return user?._id || null;
}

function paramId(req: Request): string {
    return typeof req.params.id === "string" ? req.params.id : "";
}

export const handleCreateOrganization = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await createOrganization(userId, parsed.data.name);
    if (result.status === 201 && result.organization) {
        await logAudit({ userId, action: "org_create", details: `Created org: ${parsed.data.name}`, req });
    }
    res.status(result.status).json({
        message: result.message,
        ...(result.organization ? { organization: result.organization } : {}),
    });
};

export const handleGetMyOrganizations = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 20;
    const result = await getMyOrganizations(userId, page, limit);
    res.status(result.status).json({
        message: result.message,
        data: result.data,
        page,
        limit,
        total: result.total,
    });
};

export const handleGetOrganization = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const result = await getOrganization(userId, paramId(req));
    res.status(result.status).json({
        message: result.message,
        ...(result.organization ? { organization: result.organization } : {}),
    });
};

export const handleUpdateOrganization = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = createOrganizationSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const result = await updateOrganization(userId, paramId(req), parsed.data.name || "");
    if (result.status === 200 && result.organization) {
        await logAudit({ userId, action: "org_update", details: `Updated org to: ${parsed.data.name || paramId(req)}`, req });
    }
    res.status(result.status).json({
        message: result.message,
        ...(result.organization ? { organization: result.organization } : {}),
    });
};

export const handleInviteMember = async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }
    const { email, role } = parsed.data;
    const result = await inviteMember(userId, paramId(req), email, role || "recruiter");
    if (result.status === 200) {
        await logAudit({ userId, action: "org_member_invite", details: `Invited ${email} to org`, req });
    }
    res.status(result.status).json({
        message: result.message,
        ...(result.member ? { member: result.member } : {}),
    });
};