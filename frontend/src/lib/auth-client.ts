// Shared Better Auth service (auth.shrijit.tech). No SDK: a plain fetch keeps
// the cookie jar, which is all we need — the session cookie lives on
// .shrijit.tech and the browser attaches it automatically.
const AUTH_URL = import.meta.env.VITE_AUTH_URL || "https://auth.shrijit.tech";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Sign-in failed");
  return data as T;
}

export const getSession = () =>
  call<{ user: SessionUser | null; session: unknown } | null>("/api/auth/get-session");

export const signOut = () => call("/api/auth/sign-out", {});

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