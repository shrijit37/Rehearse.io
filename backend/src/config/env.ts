import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envConfig = () => {
    const schema = z.object({
        // Canonical platform var. Resolved from DATABASE_URL when unset so a
        // single Postgres URL can feed both internal and external callers.
        DATABASE_URL: z.string().min(1),
        DATABASE_URL_EXTERNAL: z.string().optional(),
        DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
        JWT_SECRET: z.string().min(1),
        PORT: z.coerce.number().default(9000),
        APP_ENV: z.string().min(1).default("development"),
        APP_URL: z.string().optional(),
        LOG_LEVEL: z.string().optional().default("info"),
        CLIENT_URL: z.string().min(1).optional(),
        // Optional S3. S3 is only ever a connectivity check today; PII lives in
        // Postgres as base64, encrypted when ENCRYPTION_KEY is set.
        AWS_REGION: z.string().optional(),
        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_BUCKET_NAME: z.string().optional(),
        ENCRYPTION_KEY: z.string().optional(),
        AI_SERVICE_URL: z.string().optional().default("http://localhost:8000"),
        AI_SERVICE_API_KEY: z.string().optional(),
        ALLOWED_ORIGINS: z.string().optional(),
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
