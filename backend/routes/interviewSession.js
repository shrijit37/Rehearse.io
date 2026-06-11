import express from "express";
import multer from "multer";
import { protect, requireOnboarded } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { MAX_AUDIO_SIZE } from "../config/constants.js";
import {
  createInterview,
  listInterviews,
  getInterview,
  updateInterview,
  generateInvite,
  acceptInvite,
  evaluateCandidateAnswer,
  submitAnswer,
  getMyInterviews,
} from "../controller/interviewSessionController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_SIZE },
});

// Candidate routes — require candidate role
// NOTE: /candidate/* and /accept-invite/* MUST come before /:id to avoid param capture
router.get("/candidate/my-interviews", protect, authorize("candidate"), getMyInterviews);

// Accept invite via token (no auth required — public link)
router.get("/candidate/accept/:token", acceptInvite);

// Recruiter routes — require authentication + recruiter role
router.post("/", protect, authorize("recruiter"), createInterview);
router.get("/", protect, authorize("recruiter"), listInterviews);
router.get("/:id", protect, getInterview);
router.put("/:id", protect, authorize("recruiter"), updateInterview);
router.post("/:id/invite", protect, authorize("recruiter"), generateInvite);

// Candidate evaluates and submits answers — require candidate role
router.post("/candidate/evaluate", protect, requireOnboarded, authorize("candidate"), upload.single("audio"), evaluateCandidateAnswer);
router.post("/candidate/submit", protect, requireOnboarded, authorize("candidate"), submitAnswer);

export default router;
