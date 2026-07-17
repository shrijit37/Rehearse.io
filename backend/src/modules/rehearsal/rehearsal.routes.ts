import express from "express";
import multer from "multer";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireOnboarded } from "../../middleware/requireOnboarded.middleware";
import { MAX_AUDIO_SIZE } from "../../config/constants";
import {
    handleStartRehearsal,
    handleEvaluateAnswer,
    handleSaveSession,
    handleGetHistory,
    handleStartDsaPractice,
    handleEvaluateDsaSubmission,
} from "./rehearsal.controller";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_SIZE },
});

// GET /api/rehearsal/start
router.get("/start", authenticateToken, requireOnboarded, handleStartRehearsal);

// POST /api/rehearsal/evaluate
router.post("/evaluate", authenticateToken, requireOnboarded, upload.single("audio"), handleEvaluateAnswer);

// POST /api/rehearsal/session
router.post("/session", authenticateToken, handleSaveSession);

// GET /api/rehearsal/history
router.get("/history", authenticateToken, handleGetHistory);

// DSA practice
// POST /api/rehearsal/dsa/start
router.post("/dsa/start", authenticateToken, requireOnboarded, handleStartDsaPractice);
// POST /api/rehearsal/dsa/evaluate
router.post("/dsa/evaluate", authenticateToken, requireOnboarded, handleEvaluateDsaSubmission);

export default router;