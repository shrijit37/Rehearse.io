import express from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireOnboarded } from "../../middleware/requireOnboarded.middleware";
import {
    handleStartRehearsal,
    handleSaveSession,
    handleGetHistory,
    handleStartDsaPractice,
    handleEvaluateDsaSubmission,
} from "./rehearsal.controller";

const router = express.Router();

// GET /api/rehearsal/start
router.get("/start", authenticateToken, requireOnboarded, handleStartRehearsal);

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
