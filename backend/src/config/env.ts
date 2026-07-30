import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envConfig = () => {
    const schema = z.object({
        // MongoDB — accept either MONGODB_URI (new) or MONGO_URI (legacy/docker-compose)
        MONGODB_URI: z.string().min(1),
        JWT_SECRET: z.string().min(1),
        PORT: z.coerce.number().default(9000),
        APP_ENV: z.string().min(1).default("development"),
        CLIENT_URL: z.string().min(1).optional(),
        // Optional S3 — the app stores PII base64 in MongoDB (encrypted); S3 is
        // a best-effort backup store and must never block startup in docker/local.
        AWS_REGION: z.string().optional(),
        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_BUCKET_NAME: z.string().optional(),
        ENCRYPTION_KEY: z.string().optional(),
        AI_SERVICE_URL: z.string().optional().default("http://localhost:8000"),
        AI_SERVICE_API_KEY: z.string().optional(),
        ALLOWED_ORIGINS: z.string().optional(),
    });

    // Normalize legacy MONGO_URI -> MONGODB_URI before validation
    const raw: Record<string, string | undefined> = { ...process.env };
    if (!raw.MONGODB_URI && raw.MONGO_URI) {
        raw.MONGODB_URI = raw.MONGO_URI;
    }

    const result = schema.safeParse(raw);

    if (!result.success) {
        console.error("Invalid environment variables:");
        console.error(z.prettifyError(result.error));
        process.exit(1);
    }

    return result.data;
};

export const env = envConfig();
