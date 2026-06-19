import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { protect } from "../middleware/auth.js";
import User from "../db/User.js";
import RehearsalSession from "../db/RehearsalSession.js";
import CandidateInvite from "../db/CandidateInvite.js";
import InterviewSession from "../db/InterviewSession.js";
import { logAudit } from "../middleware/auditLog.js";

const router = express.Router();

/**
 * GET /api/auth/consent
 * Returns the current user's consent status.
 */
router.get("/consent", protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("consentGiven consentDate consentVersion");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    consentGiven: user.consentGiven,
    consentDate: user.consentDate,
    consentVersion: user.consentVersion,
  });
}));

/**
 * POST /api/auth/consent
 * Update consent (accept or revoke).
 */
router.post("/consent", protect, asyncHandler(async (req, res) => {
  const { consentGiven, consentVersion } = req.body;
  if (typeof consentGiven !== "boolean") {
    return res.status(400).json({ message: "consentGiven must be a boolean" });
  }

  const update = {
    consentGiven,
    consentDate: new Date(),
    consentVersion: consentVersion || "1.0",
  };

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
    .select("consentGiven consentDate consentVersion");

  await logAudit({
    userId: req.user._id,
    action: "consent_update",
    details: consentGiven ? "Consent granted" : "Consent revoked",
    req,
  });

  res.json({
    message: consentGiven ? "Consent recorded" : "Consent revoked",
    consent: {
      consentGiven: user.consentGiven,
      consentDate: user.consentDate,
      consentVersion: user.consentVersion,
    },
  });
}));

/**
 * POST /api/auth/export-data
 * GDPR Article 20 — Right to Data Portability.
 * Returns all user data as JSON.
 */
router.post("/export-data", protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });

  const sessions = await RehearsalSession.find({ user: req.user._id }).sort({ createdAt: -1 });
  const invites = await CandidateInvite.find({ candidate: req.user._id })
    .populate("interview", "title targetRole organization")
    .sort({ createdAt: -1 });

  await logAudit({
    userId: req.user._id,
    action: "account_export",
    details: "User exported their data",
    req,
  });

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="rehearse-data-export-${Date.now()}.json"`);
  res.json({
    exportDate: new Date().toISOString(),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      consentGiven: user.consentGiven,
      consentDate: user.consentDate,
    },
    rehearsalSessions: sessions,
    candidateInvites: invites,
  });
}));

/**
 * DELETE /api/auth/delete-account
 * Soft-deletes user and all associated data.
 */
router.delete("/delete-account", protect, asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: "Password is required to delete your account" });
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await (await import("bcryptjs")).default.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Incorrect password" });
  }

  // Soft delete: anonymize data
  await User.findByIdAndUpdate(req.user._id, {
    isDeleted: true,
    deletedAt: new Date(),
    name: "[Deleted User]",
    email: `deleted-${req.user._id}@anonymized.local`,
    password: "DELETED",
    resume: "",
    photo: "",
    audio: "",
    resumeName: "",
  });

  // Delete rehearsal sessions
  await RehearsalSession.deleteMany({ user: req.user._id });

  // Delete candidate invites (cannot set candidate to null due to required field)
  await CandidateInvite.deleteMany({ candidate: req.user._id });

  // Delete interview sessions created by the user
  await InterviewSession.deleteMany({ createdBy: req.user._id });

  await logAudit({
    userId: req.user._id,
    action: "account_delete",
    details: "User deleted their account and all associated data",
    req,
  });

  res.json({ message: "Account and all associated data have been permanently deleted" });
}));

export default router;
