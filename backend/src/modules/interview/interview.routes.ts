import express from "express";
import multer from "multer";
import { authenticateToken } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize.middleware";
import { MAX_AUDIO_SIZE } from "../../config/constants";
import {
    handleCreateInterview,
    handleListInterviews,
    handleGetInterview,
    handleUpdateInterview,
    handleGenerateInvite,
    handleAcceptInvite,
    handleEvaluateCandidateAnswer,
    handleSubmitInterviewAnswer,
    handleGetMyInterviews,
    handleGenerateDsaForInterview,
    handleEvaluateInterviewDsa,
} from "./interview.controller";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_SIZE },
});

// ---------------------------------------------------------------------------
// Recruiter routes
// ---------------------------------------------------------------------------
router.post("/generate-dsa", authenticateToken, authorize("recruiter"), handleGenerateDsaForInterview);
router.post("/", authenticateToken, authorize("recruiter"), handleCreateInterview);
router.get("/", authenticateToken, authorize("recruiter"), handleListInterviews);

// ---------------------------------------------------------------------------
// Candidate routes — MUST be registered before /:id to avoid param capture
// ---------------------------------------------------------------------------
router.get("/candidate/my-interviews", authenticateToken, authorize("candidate"), handleGetMyInterviews);

// Accept invite via token (no auth required — public link)
router.get("/candidate/accept/:token", handleAcceptInvite);

router.post("/candidate/evaluate", authenticateToken, authorize("candidate"), upload.single("audio"), handleEvaluateCandidateAnswer);
router.post("/candidate/submit", authenticateToken, authorize("candidate"), handleSubmitInterviewAnswer);
router.post("/candidate/evaluate-dsa", authenticateToken, authorize("candidate"), handleEvaluateInterviewDsa);

// ---------------------------------------------------------------------------
// Interview by id (recruiter)
// ---------------------------------------------------------------------------
router.get("/:id", authenticateToken, authorize("recruiter"), handleGetInterview);
router.put("/:id", authenticateToken, authorize("recruiter"), handleUpdateInterview);
router.post("/:id/invite", authenticateToken, authorize("recruiter"), handleGenerateInvite);

export default router;