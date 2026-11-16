import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

/**
 * Single shared Supabase client for server-side data + auth access.
 *
 * Raw Postgres is private to the Coolify network, so every query goes through
 * the public HTTP gateway (PostgREST / GoTrue). The service-role key bypasses
 * RLS and MUST stay server-side — never ship it to the browser. Session
 * persistence is disabled: this client only ever acts on behalf of the API.
 */
export const supabase: SupabaseClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    },
);

/** Backwards-compatible alias used by the repository layer. */
export const db = supabase;

export type Db = typeof db;

/** supabase-js is stateless (HTTP fetch); there is no pool to drain. */
export async function closeDb(): Promise<void> {
    // Intentionally empty — kept so callers (SIGTERM handler) do not change.
}

/** Cheap dependency probe used by GET /health. */
export async function checkDb(): Promise<boolean> {
    try {
        const { error } = await supabase.from("organizations").select("id").limit(1);
        if (error) {
            console.error("Supabase readiness check failed:", error.message);
            return false;
        }
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("Supabase readiness check failed:", message);
        return false;
    }
}
