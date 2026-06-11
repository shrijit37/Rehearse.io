import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../db/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logAudit } from "../middleware/auditLog.js";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Strip HTML tags from a string to prevent stored XSS.
 * This is defense-in-depth — React already escapes JSX output,
 * but the backend must not store raw HTML.
 */
function stripHtml(str) {
	if (typeof str !== "string") return str;
	return str.replace(/<[^>]*>/g, "").trim();
}
if (!JWT_SECRET) {
	console.error("FATAL: JWT_SECRET environment variable is not set.");
	process.exit(1);
}

export const signup = asyncHandler(async (req, res) => {
	const { name, email, password, role, consentGiven, consentVersion } =
		req.body;

	// Input validation
	if (!name || name.trim().length < 2 || name.trim().length > 100) {
		return res
			.status(400)
			.json({ message: "Name must be between 2 and 100 characters" });
	}
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res
			.status(400)
			.json({ message: "Please provide a valid email address" });
	}
	if (!password || password.length < 8) {
		return res
			.status(400)
			.json({ message: "Password must be at least 8 characters" });
	}
	if (password.length > 128) {
		return res
			.status(400)
			.json({ message: "Password must not exceed 128 characters" });
	}
	if (role && !["recruiter", "candidate"].includes(role)) {
		return res
			.status(400)
			.json({ message: "Role must be either 'recruiter' or 'candidate'" });
	}

	const normalizedEmail = email.toLowerCase().trim();
	const existingUser = await User.findOne({ email: normalizedEmail });
	if (existingUser)
		return res.status(400).json({ message: "User already exists" });
	const hashedPassword = await bcrypt.hash(password, 12);
	const user = await User.create({
		name: stripHtml(name),
		email: normalizedEmail,
		password: hashedPassword,
		role: role || "candidate",
		consentGiven: consentGiven === true,
		consentDate: consentGiven === true ? new Date() : undefined,
		consentVersion: consentGiven === true ? consentVersion || "1.0" : undefined,
	});
	const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

	await logAudit({
		userId: user._id,
		action: "signup",
		details: `User signed up as ${user.role}`,
		req,
	});

	res
		.status(201)
		.json({
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
			},
			token,
		});
});

export const login = asyncHandler(async (req, res) => {
	const { email, password } = req.body;
	const user = await User.findOne({
		email: email?.toLowerCase().trim(),
	}).select("+password");
	if (!user || user.isDeleted)
		return res.status(400).json({ message: "Invalid credentials" });
	const isMatch = await bcrypt.compare(password, user.password);
	if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
	const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

	await logAudit({
		userId: user._id,
		action: "login",
		details: "User logged in",
		req,
	});

	res.json({
		user: {
			id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			onboarded: Boolean(user.resume),
		},
		token,
	});
});

export const getUser = asyncHandler(async (req, res) => {
	// First check if user has resume data (for onboarded status), then strip blobs
	const user = await User.findById(req.user._id).select("-password");
	if (!user || user.isDeleted)
		return res.status(404).json({ message: "User not found" });

	const onboarded = Boolean(user.resume);

	// Strip large base64 blobs from response — they should be fetched separately if needed
	const userData = user.toObject();
	delete userData.resume;
	delete userData.photo;
	delete userData.audio;
	delete userData.resumeName;

	res.json({ user: { ...userData, onboarded } });
});

/**
 * Validate a base64 field: must be a non-empty string, valid base64, under 5 MB.
 */
function validateBase64Field(value, fieldName, res) {
	if (!value) return true; // optional field
	if (typeof value !== "string") {
		res.status(400).json({ message: `${fieldName} must be a string` });
		return false;
	}
	// Basic base64 pattern check (data URI or raw base64)
	const raw = value.includes(",") ? value.split(",")[1] : value;
	if (!/^[A-Za-z0-9+/=\s]*$/.test(raw)) {
		res.status(400).json({ message: `${fieldName} is not valid base64` });
		return false;
	}
	const sizeBytes = Math.ceil((raw.length * 3) / 4);
	const MAX_FIELD_SIZE = 5 * 1024 * 1024; // 5 MB
	if (sizeBytes > MAX_FIELD_SIZE) {
		res.status(400).json({ message: `${fieldName} exceeds 5 MB size limit` });
		return false;
	}
	return true;
}

export const onboard = asyncHandler(async (req, res) => {
	const { resumeName, resume, photo, audio } = req.body;

	// Resume is required
	if (!resume) {
		return res.status(400).json({ message: "Resume is required" });
	}

	// Validate base64 fields
	if (!validateBase64Field(resume, "resume", res)) return;
	if (!validateBase64Field(photo, "photo", res)) return;
	if (!validateBase64Field(audio, "audio", res)) return;

	const user = await User.findByIdAndUpdate(
		req.user._id,
		{ resumeName, resume, photo, audio, onboardingCompleted: true },
		{ new: true },
	);
	if (!user) return res.status(404).json({ message: "User not found" });

	await logAudit({
		userId: user._id,
		action: "onboard",
		details: "User completed onboarding",
		req,
	});

	// Strip large blobs from response
	const userData = user.toObject();
	delete userData.resume;
	delete userData.photo;
	delete userData.audio;

	res.json({ message: "Onboarding completed successfully", user: userData });
});
