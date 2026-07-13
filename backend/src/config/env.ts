import dotenv from "dotenv";
import z from "zod";
dotenv.config();

const loadConfig = () => {
    const { MONGODB_URI, JWT_SECRET, PORT, APP_ENV } = process.env;

    if (!MONGODB_URI || !JWT_SECRET || !PORT || !APP_ENV) {
        throw new Error("Missing required environment variables");
    }
    return { MONGODB_URI, JWT_SECRET, PORT: parseInt(PORT), APP_ENV };
}


const validateConfig = (config: { MONGODB_URI: string, JWT_SECRET: string, PORT: number, APP_ENV: string }) => {
    const configSchema = z.object({
        MONGODB_URI: z.string(),
        JWT_SECRET: z.string(),
        PORT: z.number(),
        APP_ENV: z.string(),
    })
    const result = configSchema.safeParse(config);
    if (!result.success) {
        console.error("Invalid environment variables");
        process.exit(1);
    }
    return result.data;
}
export const env = validateConfig(loadConfig());