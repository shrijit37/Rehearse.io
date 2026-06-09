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
import morgan from "morgan";
import cors from "cors";


dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// Sanitize data — prevent NoSQL injection via query params/body (e.g., ?key[$ne]=)
// mongo-sanitize strips keys starting with $ from objects
app.use((req, res, next) => {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) {
    const sanitized = sanitize({ q: req.query }).q;
    // Replace req.query properties (Express 5 makes query a getter, so we mutate its properties)
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, sanitized);
  }
  if (req.params) req.params = sanitize(req.params);
  next();
});

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." }
});
app.use(generalLimiter);

// Rate limiting - auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again later." }
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/rehearsal", rehearsalRoutes);
app.use("/api/auth", dataRightsRoutes);
app.use("/api/org", organizationRoutes);
app.use("/api/interviews", interviewSessionRoutes);

const PORT = process.env.PORT || 9000;

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/rehearse").then(() => {
    console.log("MongoDB connected");
}).catch((err) => {
    console.error("MongoDB connection error:", err);
});


app.get("/test", (req, res)=> {
    res.json({
        message: "api working"
    })
})

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

app.listen(PORT, ()=>{
    console.log(`Server running on ${PORT}`)
})
