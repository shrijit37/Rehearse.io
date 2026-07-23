import express from "express";
import multer from "multer";
import { authenticateToken } from "../../middleware/auth.middleware";
import { handleTts } from "./tts.controller";

const router = express.Router();

// The frontend sends TTS requests as multipart/form-data (text, voice fields).
// multer.none() parses multipart bodies without files into req.body.
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", authenticateToken, upload.none(), handleTts);

export default router;