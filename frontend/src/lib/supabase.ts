import { createClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase Auth client. Only the publishable (anon) key is used —
 * the service-role key never leaves the backend. Defaults point at the fleet
 * project so a fresh checkout works; both values can be overridden at build
 * time via the VITE_* variables.
 */
const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL || "https://supabase.shrijit.tech/rjrynmjugsxuytpotfma";
const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_gB-4dti01NmMggaCj-o2cY-YsmWkw2_SxAiBHKaIoYQ_CyNbUZzt";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
