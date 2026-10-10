import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/user/user.routes";
import rehearsalRoutes from "./modules/rehearsal/rehearsal.routes";
import organizationRoutes from "./modules/organization/organization.routes";
import interviewRoutes from "./modules/interview/interview.routes";
import ttsRoutes from "./modules/tts/tts.routes";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { authenticateToken } from "./middleware/auth.middleware";
import { errorHandler } from "./middleware/error.middleware";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { checkDb, closeDb } from "./db";

const port: number = env.PORT;
const app: Express = express();

// Traefik terminates TLS in front of us, so without this express-rate-limit
// sees no client IP and every caller shares one bucket (it warns about this
// in the logs and then 429s the whole fleet from a single user).
app.set("trust proxy", 1);

// CORS — allow the configured client URL plus any allow-listed origins
const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : [env.CLIENT_URL || "http://localhost:5173", "http://localhost:3000"];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: !allowedOrigins.includes("*"),
}));

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
}));

// Strip prototype-pollution keys from query/params/body. The old Mongo
// operator-key stripping is gone: there is no document query layer to poison.
// Mutates in place because Express 5 exposes req.query/req.params as read-only getters.
function sanitizeInPlace(value: unknown): void {
    if (Array.isArray(value)) {
        value.forEach(sanitizeInPlace);
        return;
    }
    if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
            if (key === "__proto__" || key === "constructor" || key === "prototype") {
                delete obj[key];
            } else {
                sanitizeInPlace(obj[key]);
            }
        }
    }
}
app.use((req: Request, res: Response, next: NextFunction) => {
    sanitizeInPlace(req.query);
    sanitizeInPlace(req.params);
    sanitizeInPlace(req.body);
    next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_WINDOW_MS || "900000"),
    max: parseInt(process.env.RATE_MAX || "1000"),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
    skip: (req) => req.method === "OPTIONS",
});
app.use(generalLimiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS || "900000"),
    max: parseInt(process.env.AUTH_RATE_MAX || "10"),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many authentication attempts, please try again later." },
    skip: (req) => req.method === "OPTIONS",
});

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/rehearsal", rehearsalRoutes);
app.use("/api/org", organizationRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/tts", ttsRoutes);

// Uniform fleet health contract (standards/platform.md#health): exactly
// GET /health -> { status, service, version, checks }. Postgres is the
// critical dependency: down means 503. No /ready alias.
app.get("/health", async (_req: Request, res: Response) => {
    const database = (await checkDb()) ? "up" : "down";
    const status = database === "up" ? "ok" : "down";
    res.status(status === "down" ? 503 : 200).json({
        status,
        service: "rehearse-api",
        version: process.env.APP_VERSION || "unknown",
        checks: { database },
    });
});

// Global error handler
app.use(errorHandler);

connectDB()
    .then((): void => {
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((error: unknown): void => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });

process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    try {
        await closeDb();
    } catch (err) {
        console.error("Error closing Postgres pool:", err);
    }
    process.exit(0);
});