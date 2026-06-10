import Organization from "../db/Organization.js";
import User from "../db/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logAudit } from "../middleware/auditLog.js";

/**
 * Create an organization. The creator becomes the admin.
 */
export const createOrganization = asyncHandler(async (req, res) => {
	const { name } = req.body;
	if (!name || name.trim().length < 2) {
		return res
			.status(400)
			.json({ message: "Organization name must be at least 2 characters" });
	}

	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	// Check slug uniqueness
	const existing = await Organization.findOne({ slug });
	const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

	const organization = await Organization.create({
		name: name.trim(),
		slug: finalSlug,
		createdBy: req.user._id,
		members: [{ user: req.user._id, role: "admin" }],
	});

	// Link user to organization
	await User.findByIdAndUpdate(req.user._id, {
		organization: organization._id,
	});

	await logAudit({
		userId: req.user._id,
		action: "org_create",
		details: `Created org: ${name}`,
		req,
	});

	res.status(201).json({ message: "Organization created", organization });
});

/**
 * Get current user's organizations.
 */
export const getMyOrganizations = asyncHandler(async (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;

	const filter = { "members.user": req.user._id };

	const [organizations, total] = await Promise.all([
		Organization.find(filter)
			.populate("members.user", "name email role")
			.skip(skip)
			.limit(limit),
		Organization.countDocuments(filter),
	]);

	res.json({ data: organizations, page, limit, total });
});

/**
 * Get a specific organization by ID.
 */
export const getOrganization = asyncHandler(async (req, res) => {
	const organization = await Organization.findById(req.params.id).populate(
		"members.user",
		"name email role",
	);

	if (!organization) {
		return res.status(404).json({ message: "Organization not found" });
	}

	// Check membership
	const isMember = organization.members.some(
		(m) => m.user._id.toString() === req.user._id.toString(),
	);
	if (!isMember) {
		return res
			.status(403)
			.json({ message: "You are not a member of this organization" });
	}

	res.json({ organization });
});

/**
 * Update organization name.
 */
export const updateOrganization = asyncHandler(async (req, res) => {
	const organization = await Organization.findById(req.params.id);
	if (!organization) {
		return res.status(404).json({ message: "Organization not found" });
	}

	const membership = organization.members.find(
		(m) => m.user.toString() === req.user._id.toString(),
	);
	if (!membership || membership.role !== "admin") {
		return res
			.status(403)
			.json({ message: "Only admins can update the organization" });
	}

	const { name } = req.body;
	if (name) organization.name = name.trim();
	await organization.save();

	await logAudit({
		userId: req.user._id,
		action: "org_update",
		details: `Updated org: ${organization.name}`,
		req,
	});

	res.json({ message: "Organization updated", organization });
});

/**
 * Invite a member to organization by email.
 */
export const inviteMember = asyncHandler(async (req, res) => {
	const organization = await Organization.findById(req.params.id);
	if (!organization) {
		return res.status(404).json({ message: "Organization not found" });
	}

	const membership = organization.members.find(
		(m) => m.user.toString() === req.user._id.toString(),
	);
	if (!membership || !["admin", "recruiter"].includes(membership.role)) {
		return res.status(403).json({ message: "Insufficient permissions" });
	}

	const { email, role } = req.body;
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res
			.status(400)
			.json({ message: "Please provide a valid email address" });
	}

	// Only admins can assign admin role; recruiters can only invite recruiters
	const requestedRole = role || "recruiter";
	if (requestedRole === "admin" && membership.role !== "admin") {
		return res
			.status(403)
			.json({ message: "Only admins can assign admin role" });
	}
	if (!["admin", "recruiter"].includes(requestedRole)) {
		return res
			.status(400)
			.json({ message: "Role must be either 'admin' or 'recruiter'" });
	}

	const userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
	if (!userToAdd)
		return res.status(404).json({ message: "User not found with that email" });

	const alreadyMember = organization.members.some(
		(m) => m.user.toString() === userToAdd._id.toString(),
	);
	if (alreadyMember)
		return res.status(400).json({ message: "User is already a member" });

	organization.members.push({
		user: userToAdd._id,
		role: requestedRole,
	});
	await organization.save();

	await User.findByIdAndUpdate(userToAdd._id, {
		organization: organization._id,
	});

	await logAudit({
		userId: req.user._id,
		action: "org_member_invite",
		details: `Invited ${email} to org`,
		req,
	});

	res.json({
		message: "Member added",
		member: { user: userToAdd._id, email, role: role || "recruiter" },
	});
});
