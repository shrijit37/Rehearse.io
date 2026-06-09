import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  createInterview,
  listInterviews,
  getInterview,
  updateInterview,
  generateInvite,
  acceptInvite,
  submitAnswer,
  getMyInterviews,
} from "../controller/interviewSessionController.js";
import { evaluateAnswer } from "../controller/rehearsalController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max (matches OpenAI Whisper limit)
});

// Candidate routes (no role restriction, but must be authenticated)
// NOTE: /candidate/* and /accept-invite/* MUST come before /:id to avoid param capture
router.get("/candidate/my-interviews", protect, getMyInterviews);

// Accept invite via token (no auth required - public link)
router.post("/accept-invite/:token", acceptInvite);

// Recruiter routes - require authentication + recruiter role
router.post("/", protect, authorize("recruiter"), createInterview);
router.get("/", protect, authorize("recruiter"), listInterviews);
router.get("/:id", protect, getInterview);
router.put("/:id", protect, authorize("recruiter"), updateInterview);
router.post("/:id/invite", protect, authorize("recruiter"), generateInvite);

// Candidate submits answer - uses AI evaluation from rehearsal controller
router.post("/candidate/evaluate", protect, upload.single("audio"), evaluateAnswer);
router.post("/candidate/submit", protect, submitAnswer);

export default router;
