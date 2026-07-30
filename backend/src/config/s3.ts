import {
    S3Client,
    HeadBucketCommand,
} from "@aws-sdk/client-s3";

import { env } from "./env";

/**
 * Optional S3 client. PII (resume/photo/audio) is stored base64 in MongoDB
 * (optionally encrypted with ENCRYPTION_KEY); S3 is a best-effort companion.
 * When AWS credentials are missing (local dev / docker) the client is null
 * and connectS3() logs a warning instead of crashing the process.
 */
function createClient(): S3Client | null {
    if (!env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_BUCKET_NAME) {
        return null;
    }
    return new S3Client({
        region: env.AWS_REGION,
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
    });
}

export const s3Client = createClient();

export async function connectS3(): Promise<void> {
    if (!s3Client) {
        console.warn("S3 not configured — skipping. Set AWS_* env vars to enable.");
        return;
    }
    try {
        const res = await s3Client.send(new HeadBucketCommand({
            Bucket: env.AWS_BUCKET_NAME!,
        }));
        console.log(`Connected to S3 successfully: ${res.BucketArn}`);
    } catch (error) {
        console.error("Failed to connect to S3 (continuing without it):", error);
    }
}
