import { supabase } from "@/lib/supabase";

export interface SessionUser {
    id: string;
    email: string;
    name?: string | null;
}

function toSessionUser(user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
} | null): SessionUser | null {
    if (!user?.email) return null;
    const meta = user.user_metadata ?? {};
    const name =
        typeof meta.name === "string"
            ? meta.name
            : typeof meta.full_name === "string"
                ? meta.full_name
                : null;
    return { id: user.id, email: user.email, name };
}

/** Null when there is no valid Supabase session (the sign-in form is shown). */
export async function getSession(): Promise<{ user: SessionUser | null; session: unknown } | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return { user: toSessionUser(data.session.user), session: data.session };
}

export async function signOut(): Promise<void> {
    await supabase.auth.signOut();
}

/**
 * Renames the signed-in account. Supabase Auth owns the name — the app's own
 * row is rebuilt from the session on every sign-in — so a name change has to
 * land here first, or it disappears the next time the candidate signs in.
 */
export async function updateAccountName(name: string) {
    const { data, error } = await supabase.auth.updateUser({ data: { name } });
    if (error) throw new Error(error.message);
    const user = toSessionUser(data.user);
    if (!user) throw new Error("Could not update your name");
    return { user };
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
}

export async function signUpWithEmail(
    email: string,
    password: string,
    name: string,
): Promise<void> {
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
    });
    if (error) throw new Error(error.message);
}

export async function signInWithProvider(provider: "google" | "github") {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    return { url: data.url };
}

export async function signInWithProviderRedirect(provider: "google" | "github") {
    const { url } = await signInWithProvider(provider);
    if (url) window.location.href = url;
}
