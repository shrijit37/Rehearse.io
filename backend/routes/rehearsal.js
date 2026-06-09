import express from "express";
import multer from "multer";
import { startRehearsal, evaluateAnswer, saveSession, getHistory } from "../controller/rehearsalController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max (matches OpenAI Whisper limit)
});

// GET /api/rehearsal/start
router.get("/start", protect, startRehearsal);

// POST /api/rehearsal/evaluate
router.post("/evaluate", protect, upload.single("audio"), evaluateAnswer);

// POST /api/rehearsal/session
router.post("/session", protect, saveSession);

// GET /api/rehearsal/history
router.get("/history", protect, getHistory);

export default router;
