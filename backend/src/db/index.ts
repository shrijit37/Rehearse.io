import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

/**
 * Single shared pool. Drizzle owns the connection lifecycle; `pool` is exported
 * so GET /health can prove reachability and so shutdown can drain cleanly.
 */
export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    // Fail fast instead of queueing forever when Postgres is unreachable.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
    // An idle client blew up (e.g. server restart). Log and let pg recycle it.
    console.error("Unexpected Postgres pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;

export async function closeDb(): Promise<void> {
    await pool.end();
}

/** Cheap dependency probe used by GET /health. */
export async function checkDb(): Promise<boolean> {
    try {
        await pool.query("SELECT 1");
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("Postgres readiness check failed:", message);
        return false;
    }
}
