import express from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { handleStartLiveSession } from "./live.controller";

const router = express.Router();

// POST /api/live/session
//
// Guarded by authenticateToken alone: practice requires onboarding and the
// invited flow requires invite ownership, and both rules need the mode, which
// only the body knows. Enforcing them in the service keeps the client's flow a
// single call instead of two mode-specific endpoints.
router.post("/session", authenticateToken, handleStartLiveSession);

export default router;
