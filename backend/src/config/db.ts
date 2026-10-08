import { env } from "./env";
import { db, pool } from "../db";

/**
 * Verifies the database is reachable before the server accepts traffic.
 * Mongoose auto-connected lazily; Postgres has an explicit contract.
 */
export const connectDB = async (): Promise<void> => {
    try {
        await pool.query("SELECT 1");
        console.log("Connected to Postgres");
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error("Error connecting to Postgres", message);
        process.exit(1);
    }
};

export { db };
