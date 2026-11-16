import { checkDb, db } from "../db";

/**
 * Verifies Supabase is reachable before the server accepts traffic.
 * All data access goes through the public HTTP gateway (the service-role key
 * is server-only); raw Postgres is not reachable from the app container.
 */
export const connectDB = async (): Promise<void> => {
    try {
        if (!(await checkDb())) throw new Error("Supabase readiness probe failed");
        console.log("Connected to Supabase");
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error("Error connecting to Supabase", message);
        process.exit(1);
    }
};

export { db };
