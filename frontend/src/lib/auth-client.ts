// Shared Better Auth service (auth.shrijit.tech). No SDK: a plain fetch keeps
// the cookie jar, which is all we need — the session cookie lives on
// .shrijit.tech and the browser attaches it automatically.
const AUTH_URL = import.meta.env.VITE_AUTH_URL || "https://auth.shrijit.tech";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

async function call<T>(path: string, body?: unknown, fallbackMessage = "Sign-in failed"): Promise<T> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || fallbackMessage);
  return data as T;
}

export const getSession = () =>
  call<{ user: SessionUser | null; session: unknown } | null>("/api/auth/get-session");

export const signOut = () => call("/api/auth/sign-out", {});

/**
 * Renames the signed-in account. This service owns the name — the app's own row
 * is rebuilt from its session on every sign-in — so a name change has to land
 * here first, or it disappears the next time the candidate signs in.
 */
export const updateAccountName = (name: string) =>
  call<{ user: SessionUser }>("/api/auth/update-user", { name }, "Could not update your name");

export const signInWithEmail = (email: string, password: string) =>
  call("/api/auth/sign-in/email", { email, password });

export const signUpWithEmail = (
  email: string,
  password: string,
  name: string,
) => call("/api/auth/sign-up/email", { email, password, name });

export const signInWithProvider = (provider: "google" | "github") =>
  call<{ url: string }>("/api/auth/sign-in/social", {
    provider,
    callbackURL: window.location.origin,
});

export async function signInWithProviderRedirect(provider: "google" | "github") {
  const { url } = await signInWithProvider(provider);
  window.location.href = url;
}