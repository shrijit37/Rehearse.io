import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import sanitize from "mongo-sanitize";
import authRoutes from "./routes/auth.js";
import rehearsalRoutes from "./routes/rehearsal.js";
import dataRightsRoutes from "./routes/dataRights.js";
import organizationRoutes from "./routes/organization.js";
import interviewSessionRoutes from "./routes/interviewSession.js";
import ttsRoutes from "./routes/tts.js";
import morgan from "morgan";
import cors from "cors";

dotenv.config();

const app = express();

// CORS — first middleware so preflight and error responses always include CORS headers
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
	: [
			"http://localhost:5173",
			"http://localhost:3000",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:3000",
		];

app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (mobile apps, curl, server-to-server)
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes("*")) {
				return callback(null, true);
			}
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			// Reject without throwing — avoids 500 responses missing CORS headers
			return callback(null, false);
		},
		credentials: !allowedOrigins.includes("*"),
	}),
);

// Security headers — omit deprecated browsing-topics (removed in Chrome 100+)
app.use(
	helmet({
		permissionsPolicy: {
			policy: {},
		},
	}),
);

// Express 5: req.query and req.params are read-only getters — mongo-sanitize mutates in place
app.use((req, res, next) => {
	if (req.query) sanitize(req.query);
	if (req.params) sanitize(req.params);
	next();
});

app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
	if (req.body) sanitize(req.body);
	next();
});
app.use(morgan("combined"));

// Rate limiting - general (after CORS so 429 responses have proper headers)
const generalLimiter = rateLimit({
	windowMs: parseInt(process.env.RATE_WINDOW_MS || "900000"), // 15 min default
	max: parseInt(process.env.RATE_MAX || "1000"), // Default for local dev; docker-compose overrides to 5000
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: "Too many requests, please try again later." },
	skip: (req) => req.method === "OPTIONS",
});
app.use(generalLimiter);

// Rate limiting - auth endpoints (stricter)
const authLimiter = rateLimit({
	windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS || "900000"), // 15 min default
	max: parseInt(process.env.AUTH_RATE_MAX || "10"),
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		message: "Too many authentication attempts, please try again later.",
	},
	skip: (req) => req.method === "OPTIONS",
});

// Routes
// Data rights routes MUST come before authLimiter — they're authenticated but
// not brute-force targets, so they shouldn't consume auth rate-limit quota
app.use("/api/auth", dataRightsRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/rehearsal", rehearsalRoutes);
app.use("/api/org", organizationRoutes);
app.use("/api/interviews", interviewSessionRoutes);
app.use("/api/tts", ttsRoutes);

const PORT = process.env.PORT || 9000;

mongoose
	.connect(process.env.MONGO_URI || "mongodb://localhost:27017/rehearse")
	.then(() => {
		console.log("MongoDB connected");
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
	});

if (process.env.NODE_ENV !== "production") {
	app.get("/test", (req, res) => {
		res.json({ message: "api working" });
	});
}

// Health check endpoint
app.get("/health", (req, res) => {
	const dbState = mongoose.connection.readyState;
	const dbStatus = dbState === 1 ? "connected" : "disconnected";
	const status = dbState === 1 ? 200 : 503;
	res.status(status).json({
		status: dbStatus,
		timestamp: new Date().toISOString(),
	});
});

// Global error handler
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(err.status || 500).json({
		message: err.message || "Internal Server Error",
		error: process.env.NODE_ENV === "production" ? undefined : err.stack,
	});
});

app.listen(PORT, () => {
	console.log(`Server running on ${PORT}`);
});

process.on("SIGTERM", async () => {
	console.log("SIGTERM received. Shutting down gracefully...");
	await mongoose.connection.close();
	process.exit(0);
});
