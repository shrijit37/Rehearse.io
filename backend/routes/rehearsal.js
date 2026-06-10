import express from "express";
import multer from "multer";
import {
	startRehearsal,
	evaluateAnswer,
	saveSession,
	getHistory,
} from "../controller/rehearsalController.js";
import { protect, requireOnboarded } from "../middleware/auth.js";
import { MAX_AUDIO_SIZE } from "../config/constants.js";

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_AUDIO_SIZE },
});

// GET /api/rehearsal/start
router.get("/start", protect, requireOnboarded, startRehearsal);

// POST /api/rehearsal/evaluate
router.post(
	"/evaluate",
	protect,
	requireOnboarded,
	upload.single("audio"),
	evaluateAnswer,
);

// POST /api/rehearsal/session
router.post("/session", protect, saveSession);

// GET /api/rehearsal/history
router.get("/history", protect, getHistory);

export default router;
