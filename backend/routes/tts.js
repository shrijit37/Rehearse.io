import express from "express";
import axios from "axios";
import FormData from "form-data";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY;
const aiAuthHeaders = AI_SERVICE_API_KEY
	? { Authorization: `Bearer ${AI_SERVICE_API_KEY}` }
	: {};

/**
 * POST /api/tts
 * Proxy text-to-speech requests to the AI service.
 * Requires authentication (any logged-in user).
 */
router.post("/", protect, async (req, res) => {
	try {
		const { text, voice } = req.body;

		if (!text || typeof text !== "string" || text.length === 0) {
			return res.status(400).json({ message: "Text is required" });
		}

		if (text.length > 5000) {
			return res.status(400).json({ message: "Text exceeds 5000 character limit" });
		}

		const formData = new FormData();
		formData.append("text", text);
		formData.append("voice", voice || "alloy");

		const aiResponse = await axios.post(
			`${AI_SERVICE_URL}/api/tts`,
			formData,
			{
				headers: {
					...aiAuthHeaders,
					...formData.getHeaders(),
				},
				responseType: "stream",
			},
		);

		res.setHeader("Content-Type", aiResponse.headers["content-type"] || "audio/mpeg");
		res.setHeader("Content-Disposition", "inline; filename=\"speech.mp3\"");
		if (aiResponse.headers["content-length"]) {
			res.setHeader("Content-Length", aiResponse.headers["content-length"]);
		}

		aiResponse.data.pipe(res);
	} catch (err) {
		console.error("TTS proxy error:", err.message);
		if (err.response) {
			return res.status(err.response.status).json({
				message: "TTS service error",
				error: err.response.data?.detail || err.message,
			});
		}
		res.status(502).json({
			message: "TTS service unavailable",
			error: err.message,
		});
	}
});

export default router;