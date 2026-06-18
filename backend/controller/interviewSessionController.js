import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import bcrypt from "bcryptjs";
import InterviewSession from "../db/InterviewSession.js";
import CandidateInvite from "../db/CandidateInvite.js";
import Organization from "../db/Organization.js";
import User from "../db/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logAudit } from "../middleware/auditLog.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY;
const aiAuthHeaders = AI_SERVICE_API_KEY
	? { Authorization: `Bearer ${AI_SERVICE_API_KEY}` }
	: {};

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Create an interview session (recruiter only).
 */
export const createInterview = asyncHandler(async (req, res) => {
	const {
		title,
		targetRole,
		questions,
		description,
		expiresAt,
		organizationId,
		status,
	} = req.body;

	if (!title || !targetRole || !expiresAt) {
		return res
			.status(400)
			.json({ message: "title, targetRole, and expiresAt are required" });
	}

	// Validate organization membership
	const org = await Organization.findById(organizationId);
	if (!org) return res.status(404).json({ message: "Organization not found" });

	const isMember = org.members.some(
		(m) =>
			m.user.toString() === req.user._id.toString() &&
			["admin", "recruiter"].includes(m.role),
	);
	if (!isMember)
		return res
			.status(403)
			.json({ message: "Not authorized in this organization" });

	// Allow setting status on creation; default to "draft" if not provided or invalid
	const validStatuses = ["draft", "active"];
	const interviewStatus = validStatuses.includes(status) ? status : "draft";

	const interview = await InterviewSession.create({
		organization: organizationId,
		createdBy: req.user._id,
		title: title.trim(),
		targetRole: targetRole.trim(),
		description: description || "",
		questions: questions || [],
		expiresAt: new Date(expiresAt),
		status: interviewStatus,
	});

	await logAudit({
		userId: req.user._id,
		action: "interview_create",
		details: `Created interview: ${title}`,
		req,
	});

	res.status(201).json({ message: "Interview session created", interview });
});

/**
 * List interview sessions for the recruiter's organization.
 */
export const listInterviews = asyncHandler(async (req, res) => {
	const { organizationId } = req.query;
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;

	const filter = { createdBy: req.user._id };
	if (organizationId) {
		if (!mongoose.Types.ObjectId.isValid(organizationId)) {
			return res.status(400).json({ message: "Invalid organizationId format" });
		}
		filter.organization = organizationId;
	}

	const [interviews, total] = await Promise.all([
		InterviewSession.find(filter)
			.populate("organization", "name slug")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		InterviewSession.countDocuments(filter),
	]);

	res.json({ data: interviews, page, limit, total });
});

/**
 * Get a specific interview session with candidate invites.
 * Only the interview creator (recruiter) can access this endpoint.
 */
export const getInterview = asyncHandler(async (req, res) => {
	if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
		return res.status(400).json({ message: "Invalid interview ID format" });
	}

	const interview = await InterviewSession.findById(req.params.id)
		.populate("organization", "name slug")
		.populate("createdBy", "name email");

	if (!interview)
		return res.status(404).json({ message: "Interview not found" });

	// Authorization: only the creator can view interview details
	if (interview.createdBy._id.toString() !== req.user._id.toString()) {
		return res
			.status(403)
			.json({
				message: "Access denied. You can only view interviews you created.",
			});
	}

	// Get candidate invites and their results
	const invites = await CandidateInvite.find({ interview: interview._id })
		.populate("candidate", "name email")
		.sort({ createdAt: -1 });

	res.json({ interview, candidates: invites });
});

/**
 * Update an interview session.
 */
export const updateInterview = asyncHandler(async (req, res) => {
	const interview = await InterviewSession.findById(req.params.id);
	if (!interview)
		return res.status(404).json({ message: "Interview not found" });

	if (interview.createdBy.toString() !== req.user._id.toString()) {
		return res
			.status(403)
			.json({ message: "Only the creator can update this interview" });
	}

	const allowedFields = [
		"title",
		"targetRole",
		"questions",
		"description",
		"status",
		"expiresAt",
	];
	allowedFields.forEach((field) => {
		if (req.body[field] !== undefined) interview[field] = req.body[field];
	});
	await interview.save();

	res.json({ message: "Interview updated", interview });
});

/**
 * Generate an invite link for a candidate.
 */
export const generateInvite = asyncHandler(async (req, res) => {
	const interview = await InterviewSession.findById(req.params.id);
	if (!interview)
		return res.status(404).json({ message: "Interview not found" });

	if (interview.createdBy.toString() !== req.user._id.toString()) {
		return res
			.status(403)
			.json({ message: "Only the creator can invite candidates" });
	}

	if (interview.status !== "active") {
		return res
			.status(400)
			.json({ message: "Interview must be active to invite candidates" });
	}

	const { candidateEmail } = req.body;
	if (!candidateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
		return res
			.status(400)
			.json({ message: "Please provide a valid email address" });
	}

	// Find or create candidate user
	const normalizedEmail = candidateEmail.toLowerCase().trim();
	let candidate = await User.findOne({ email: normalizedEmail });

	if (!candidate) {
		// Auto-create candidate account with random password
		const randomPassword = crypto.randomBytes(32).toString("hex");
		candidate = await User.create({
			name: normalizedEmail.split("@")[0],
			email: normalizedEmail,
			password: await bcrypt.hash(randomPassword, 12),
			role: "candidate",
		});
	}

	// Check if already invited
	const existingInvite = await CandidateInvite.findOne({
		interview: interview._id,
		candidate: candidate._id,
	});
	if (existingInvite) {
		return res.status(400).json({ message: "Candidate already invited" });
	}

	const inviteToken = crypto.randomBytes(32).toString("hex");

	const invite = await CandidateInvite.create({
		interview: interview._id,
		candidate: candidate._id,
		inviteToken,
	});

	await logAudit({
		userId: req.user._id,
		action: "interview_invite",
		details: `Invited ${candidateEmail}`,
		req,
		metadata: { interviewId: interview._id },
	});

	res.status(201).json({
		message: "Invite generated",
		inviteToken,
		candidateEmail: normalizedEmail,
	});
});

/**
 * Candidate accepts invite link.
 * Returns a JWT token so the candidate can authenticate for evaluate/submit calls.
 */
export const acceptInvite = asyncHandler(async (req, res) => {
	const { token } = req.params;
	const invite = await CandidateInvite.findOne({ inviteToken: token })
		.populate(
			"interview",
			"title targetRole description questions expiresAt status",
		)
		.populate("candidate", "name email");

	if (!invite) return res.status(404).json({ message: "Invalid invite link" });
	if (invite.interview.status !== "active")
		return res
			.status(400)
			.json({ message: "This interview is no longer active" });
	if (new Date() > invite.interview.expiresAt)
		return res.status(400).json({ message: "This interview has expired" });

	if (invite.status !== "pending") {
		return res
			.status(400)
			.json({ message: "Invite link has already been used" });
	}

	invite.status = "started";
	invite.startedAt = new Date();
	await invite.save();

	// Generate a JWT token for the candidate so they can authenticate for evaluate/submit
	const authToken = jwt.sign({ id: invite.candidate._id }, JWT_SECRET, {
		expiresIn: "2d",
	});

	res.json({
		invite,
		interview: invite.interview,
		token: authToken,
		user: invite.candidate,
	});
});

/**
 * Evaluate a candidate's audio answer via AI and save the result to DB.
 * Score/feedback/transcription are persisted immediately so they survive
 * page reloads and are visible to recruiters in candidate results.
 */
export const evaluateCandidateAnswer = asyncHandler(async (req, res) => {
	if (!req.file) {
		return res.status(400).json({ message: "No audio file uploaded" });
	}

	const { question, inviteId } = req.body;
	if (!question) {
		return res
			.status(400)
			.json({ message: "No question provided for evaluation" });
	}
	if (!inviteId) {
		return res.status(400).json({ message: "inviteId is required" });
	}

	// Validate the invite belongs to this candidate
	if (!mongoose.Types.ObjectId.isValid(inviteId)) {
		return res.status(400).json({ message: "Invalid inviteId format" });
	}

	const invite = await CandidateInvite.findById(inviteId);
	if (!invite) return res.status(404).json({ message: "Invite not found" });
	if (invite.candidate.toString() !== req.user._id.toString()) {
		return res.status(403).json({ message: "Not authorized for this invite" });
	}
	if (invite.status !== "started") {
		return res.status(400).json({ message: "Invite is not active" });
	}

	// Verify question belongs to this interview
	const interview = await InterviewSession.findById(invite.interview);
	if (!interview) return res.status(404).json({ message: "Interview not found" });

	const questionIndex = interview.questions.indexOf(question);
	if (questionIndex === -1) {
		return res
			.status(400)
			.json({ message: "Question not found in this interview" });
	}

	// Forward audio to AI service
	const formData = new FormData();
	const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
	formData.append("audio", blob, req.file.originalname || "answer.webm");
	formData.append("question", question);

	let aiResponse;
	try {
		aiResponse = await axios.post(
			`${AI_SERVICE_URL}/api/evaluate-audio`,
			formData,
			{
				headers: aiAuthHeaders,
				// No manual Content-Type — axios sets multipart boundary automatically
			},
		);
	} catch (aiErr) {
		console.error("AI evaluation service error:", aiErr.message);
		return res.status(502).json({
			message: "AI service failed to evaluate your answer. Please try again.",
			error: aiErr.message,
		});
	}

	const transcription = aiResponse.data.transcription || "";
	const score = aiResponse.data.score;
	const feedback = aiResponse.data.feedback || "";

	// Save or update result in the invite
	const existingIndex = invite.results.findIndex(
		(r) => interview.questions.indexOf(r.question) === questionIndex,
	);

	if (existingIndex >= 0) {
		invite.results[existingIndex].transcription = transcription;
		invite.results[existingIndex].score = score;
		invite.results[existingIndex].feedback = feedback;
	} else {
		invite.results.push({
			question,
			transcription,
			score,
			feedback,
		});
	}

	await invite.save();

	return res.json({
		score,
		feedback,
		transcription: transcription || "No transcription available",
	});
});

/**
 * Candidate submits an answer to finalize the interview.
 * Results (score/feedback/transcription) are already persisted by
 * evaluateCandidateAnswer — this endpoint only marks completion
 * and ensures a result entry exists for each answered question.
 */
export const submitAnswer = asyncHandler(async (req, res) => {
	const { inviteId, questionIndex } = req.body;

	if (!inviteId || questionIndex === undefined) {
		return res
			.status(400)
			.json({ message: "inviteId and questionIndex are required" });
	}

	if (!mongoose.Types.ObjectId.isValid(inviteId)) {
		return res.status(400).json({ message: "Invalid inviteId format" });
	}

	const invite = await CandidateInvite.findById(inviteId);
	if (!invite) return res.status(404).json({ message: "Invite not found" });
	if (invite.candidate.toString() !== req.user._id.toString()) {
		return res.status(403).json({ message: "Not authorized" });
	}
	if (invite.status !== "started") {
		return res.status(400).json({ message: "Invite is not in started status" });
	}

	const interview = await InterviewSession.findById(invite.interview);
	if (!interview || !interview.questions[questionIndex]) {
		return res.status(400).json({ message: "Invalid question index" });
	}

	// Ensure a result entry exists (should already be saved by evaluateCandidateAnswer)
	const existingIndex = invite.results.findIndex(
		(r) => interview.questions.indexOf(r.question) === questionIndex,
	);

	if (existingIndex === -1) {
		// Defensive: no evaluation result yet — create a placeholder
		invite.results.push({
			question: interview.questions[questionIndex],
			transcription: "",
			score: null,
			feedback: "",
		});
	}

	// Check if all questions answered
	if (invite.results.length >= interview.questions.length) {
		invite.status = "completed";
		invite.completedAt = new Date();
	}

	await invite.save();

	res.json({ message: "Answer submitted", invite });
});

/**
 * Get candidate's own interview list.
 */
export const getMyInterviews = asyncHandler(async (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;

	const filter = { candidate: req.user._id };

	const [invites, total] = await Promise.all([
		CandidateInvite.find(filter)
			.populate({
				path: "interview",
				select: "title targetRole description status expiresAt",
				populate: { path: "organization", select: "name" },
			})
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		CandidateInvite.countDocuments(filter),
	]);

	res.json({ data: invites, page, limit, total });
});
