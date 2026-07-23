import type { Request, Response } from "express";
import { tts } from "../../utils/aiClient";

export const handleTts = async (req: Request, res: Response): Promise<void> => {
    try {
        const text = typeof req.body?.text === "string" ? req.body.text : "";
        const voice = typeof req.body?.voice === "string" ? req.body.voice : "tara";

        if (!text || text.length === 0) {
            res.status(400).json({ message: "Text is required" });
            return;
        }
        if (text.length > 5000) {
            res.status(400).json({ message: "Text exceeds 5000 character limit" });
            return;
        }

        const result = await tts(text, voice);
        const audioBuffer = Buffer.from(result.arrayBuffer);

        res.setHeader("Content-Type", result.contentType || "audio/mpeg");
        res.setHeader("Content-Disposition", 'inline; filename="speech.mp3"');
        res.setHeader("Content-Length", String(audioBuffer.length));
        res.end(audioBuffer);
    } catch (err) {
        console.error("TTS proxy error:", err instanceof Error ? err.message : err);
        res.status(502).json({
            message: "TTS service unavailable",
            error: err instanceof Error ? err.message : "unknown error",
        });
    }
};