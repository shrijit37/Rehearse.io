import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import InterviewSession from "../db/InterviewSession.js";
import CandidateInvite from "../db/CandidateInvite.js";
import Organization from "../db/Organization.js";
import User from "../db/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logAudit } from "../middleware/auditLog.js";

const JWT_SECRET = process.env.JWT_SECRET;

/** Validate a string is a valid MongoDB ObjectId */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Create an interview session (recruiter only).
 */
export const createInterview = asyncHandler(async (req, res) => {
  const { title, targetRole, questions, description, expiresAt, organizationId } = req.body;

  if (!title || !targetRole || !expiresAt) {
    return res.status(400).json({ message: "title, targetRole, and expiresAt are required" });
  }

  // Validate organization membership
  const org = await Organization.findById(organizationId);
  if (!org) return res.status(404).json({ message: "Organization not found" });

  const isMember = org.members.some(
    (m) => m.user.toString() === req.user._id.toString() && ["admin", "recruiter"].includes(m.role)
  );
  if (!isMember) return res.status(403).json({ message: "Not authorized in this organization" });

  const interview = await InterviewSession.create({
    organization: organizationId,
    createdBy: req.user._id,
    title: title.trim(),
    targetRole: targetRole.trim(),
    description: description || "",
    questions: questions || [],
    expiresAt: new Date(expiresAt),
    status: "draft", // Always start as draft; status can only be changed via updateInterview
  });

  await logAudit({ userId: req.user._id, action: "interview_create", details: `Created interview: ${title}`, req });

  res.status(201).json({ message: "Interview session created", interview });
});

/**
 * List interview sessions for the recruiter's organization.
 */
export const listInterviews = asyncHandler(async (req, res) => {
  const { organizationId } = req.query;

  const filter = { createdBy: req.user._id };
  if (organizationId) {
    if (!isValidObjectId(organizationId)) {
      return res.status(400).json({ message: "Invalid organizationId format" });
    }
    filter.organization = organizationId;
  }

  const interviews = await InterviewSession.find(filter)
    .populate("organization", "name slug")
    .sort({ createdAt: -1 });

  res.json({ interviews });
});

/**
 * Get a specific interview session with candidate invites.
 * Only the interview creator (recruiter) can access this endpoint.
 */
export const getInterview = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid interview ID format" });
  }

  const interview = await InterviewSession.findById(req.params.id)
    .populate("organization", "name slug")
    .populate("createdBy", "name email");

  if (!interview) return res.status(404).json({ message: "Interview not found" });

  // Authorization: only the creator can view interview details
  if (interview.createdBy._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Access denied. You can only view interviews you created." });
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
  if (!interview) return res.status(404).json({ message: "Interview not found" });

  if (interview.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the creator can update this interview" });
  }

  const allowedFields = ["title", "targetRole", "questions", "description", "status", "expiresAt"];
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
  if (!interview) return res.status(404).json({ message: "Interview not found" });

  if (interview.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the creator can invite candidates" });
  }

  if (interview.status !== "active") {
    return res.status(400).json({ message: "Interview must be active to invite candidates" });
  }

  const { candidateEmail } = req.body;
  if (!candidateEmail) return res.status(400).json({ message: "candidateEmail is required" });

  // Find or create candidate user
  const normalizedEmail = candidateEmail.toLowerCase().trim();
  let candidate = await User.findOne({ email: normalizedEmail });

  if (!candidate) {
    // Auto-create candidate account with random password
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const bcrypt = await import("bcryptjs");
    candidate = await User.create({
      name: normalizedEmail.split("@")[0],
      email: normalizedEmail,
      password: await bcrypt.default.hash(randomPassword, 12),
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

  await logAudit({ userId: req.user._id, action: "interview_invite", details: `Invited ${candidateEmail}`, req, metadata: { interviewId: interview._id } });

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
    .populate("interview", "title targetRole description questions expiresAt status")
    .populate("candidate", "name email");

  if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  if (invite.interview.status !== "active") return res.status(400).json({ message: "This interview is no longer active" });
  if (new Date() > invite.interview.expiresAt) return res.status(400).json({ message: "This interview has expired" });

  if (invite.status === "pending") {
    invite.status = "started";
    invite.startedAt = new Date();
    await invite.save();
  }

  // Generate a JWT token for the candidate so they can authenticate for evaluate/submit
  const authToken = jwt.sign({ id: invite.candidate._id }, JWT_SECRET, { expiresIn: "2d" });

  res.json({ invite, interview: invite.interview, token: authToken, user: invite.candidate });
});

/**
 * Candidate submits an answer.
 * Score and feedback are NOT accepted from the client — they must be generated
 * server-side via the AI evaluation endpoint (evaluateAnswer).
 */
export const submitAnswer = asyncHandler(async (req, res) => {
  const { inviteId, questionIndex, transcription } = req.body;

  if (!inviteId || questionIndex === undefined) {
    return res.status(400).json({ message: "inviteId and questionIndex are required" });
  }

  if (!isValidObjectId(inviteId)) {
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

  // Check if this question already has an AI-evaluated result (from evaluateAnswer)
  const existingIndex = invite.results.findIndex(
    (r) => interview.questions.indexOf(r.question) === questionIndex
  );

  if (existingIndex >= 0) {
    // Update transcription only — preserve existing AI-generated score and feedback
    invite.results[existingIndex].transcription = transcription || invite.results[existingIndex].transcription;
  } else {
    // No AI evaluation exists yet — store transcription only; score/feedback come from evaluateAnswer
    const result = {
      question: interview.questions[questionIndex],
      transcription: transcription || "",
      score: 0,
      feedback: "",
    };
    invite.results.push(result);
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
  const invites = await CandidateInvite.find({ candidate: req.user._id })
    .populate({
      path: "interview",
      select: "title targetRole description status expiresAt",
      populate: { path: "organization", select: "name" },
    })
    .sort({ createdAt: -1 });

  res.json({ interviews: invites });
});
