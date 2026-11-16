import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envConfig = () => {
    const schema = z.object({
        // Supabase fleet project. DB + Auth both go through the public HTTP
        // gateway: raw Postgres is private to the Coolify network and is NOT
        // reachable from the API container. The service-role key is server-only.
        SUPABASE_URL: z.string().url(),
        SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
        SUPABASE_SECRET_KEY: z.string().min(1),
        // Still signs interview invite tokens, the one credential a
        // candidate holds before they have a session of their own.
        JWT_SECRET: z.string().min(1),
        PORT: z.coerce.number().default(9000),
        APP_ENV: z.string().min(1).default("development"),
        APP_URL: z.string().optional(),
        LOG_LEVEL: z.string().optional().default("info"),
        CLIENT_URL: z.string().min(1).optional(),
        // Optional S3. S3 is only ever a connectivity check today; PII lives in
        // Supabase as base64, encrypted when ENCRYPTION_KEY is set.
        AWS_REGION: z.string().optional(),
        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_BUCKET_NAME: z.string().optional(),
        ENCRYPTION_KEY: z.string().optional(),
        AI_SERVICE_URL: z.string().optional().default("http://localhost:8000"),
        AI_SERVICE_API_KEY: z.string().optional(),
        // Google AI Studio key for the Live voice sessions. Optional so an
        // unset key cannot stop the API booting; POST /api/live/session answers
        // 503 until it exists.
        GEMINI_API_KEY: z.string().optional(),
        // Signs the 60-second live-session tickets. Its own secret, never
        // JWT_SECRET, so a live ticket can never authenticate the REST API —
        // see live.service.ts. Optional like the key above: the feature answers
        // 503 until both exist.
        LIVE_TICKET_SECRET: z.string().optional(),
        // Default allow-list when unset: the local dev client plus the deployed Cloudflare Pages origins.
        ALLOWED_ORIGINS: z.string().optional().default(
            "http://localhost:5173,http://localhost:3000,https://rehearse.io.shrijit.tech,https://rehearse-io.pages.dev",
        ),
    });

    const raw: Record<string, string | undefined> = { ...process.env };

    const result = schema.safeParse(raw);

    if (!result.success) {
        console.error("Invalid environment variables:");
        console.error(z.prettifyError(result.error));
        process.exit(1);
    }

    return result.data;
};

export const env = envConfig();
