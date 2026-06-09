import axios from "axios";
import { extractTextFromBase64Pdf } from "../utils/pdfParser.js";
import RehearsalSession from "../db/RehearsalSession.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Starts a rehearsal session.
 * Decodes the user's PDF resume, extracts the text, sends it to the AI service,
 * and returns the generated interview questions.
 */
export const startRehearsal = async (req, res, next) => {
  try {
    const user = req.user; // Attach by protect middleware
    
    if (!user.resume) {
      return res.status(400).json({ message: "No resume found. Please complete onboarding first." });
    }

    // Extract text from Base64 PDF
    let resumeText = "";
    try {
      resumeText = await extractTextFromBase64Pdf(user.resume);
    } catch (parseErr) {
      console.error("PDF parsing error:", parseErr);
      return res.status(500).json({ 
        message: "Failed to parse resume PDF. Please ensure you uploaded a valid PDF document.",
        error: parseErr.message 
      });
    }

    // Send request to FastAPI AI service
    const targetRole = req.query.targetRole || "Software Engineer";
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/generate-scenario`, {
        resume_text: resumeText,
        target_role: targetRole
      });

      return res.json({
        message: "Interview scenario questions generated successfully",
        questions: aiResponse.data.questions
      });
    } catch (aiErr) {
      console.error("AI service error:", aiErr.message);
      return res.status(502).json({
        message: "AI service failed to generate questions. Please try again later.",
        error: aiErr.message
      });
    }

  } catch (err) {
    next(err);
  }
};

/**
 * Evaluates the user's recorded audio answer.
 * Receives the audio file via multer, forwards it along with the question
 * to the FastAPI evaluation service, and returns the score and feedback.
 */
export const evaluateAnswer = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: "No question provided for evaluation" });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("audio", blob, req.file.originalname || "answer.webm");
    formData.append("question", question);

    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/evaluate-audio`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return res.json({
        score: aiResponse.data.score,
        feedback: aiResponse.data.feedback,
        transcription: aiResponse.data.transcription || "No transcription available",
      });
    } catch (aiErr) {
      console.error("AI evaluation service error:", aiErr.message);
      return res.status(502).json({
        message: "AI service failed to evaluate your answer. Please try again.",
        error: aiErr.message,
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Persists a completed rehearsal session.
 * Links the session to the authenticated user.
 */
export const saveSession = async (req, res, next) => {
  try {
    const { results, targetRole } = req.body;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ message: "Invalid or empty session results" });
    }

    const session = await RehearsalSession.create({
      user: req.user._id,
      targetRole: targetRole || "Software Engineer",
      results
    });

    return res.status(201).json({
      message: "Rehearsal session saved successfully",
      session
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches the user's historical rehearsal sessions.
 * Sorted chronologically descending.
 */
export const getHistory = async (req, res, next) => {
  try {
    const history = await RehearsalSession.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    return res.json({
      message: "Historical sessions fetched successfully",
      history
    });
  } catch (err) {
    next(err);
  }
};
