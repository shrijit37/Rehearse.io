import type { AuthUser, User } from "@/types";

/**
 * The cached signed-in user.
 *
 * The session itself is the auth cookie on `.shrijit.tech`; this blob is what the
 * UI renders from before its first API answer — name, email, role, onboarding.
 * Sign-in caches what the auth service returns (`AuthUser`), onboarding and a
 * profile edit cache the user record, and the readers below only use fields both
 * shapes carry.
 *
 * The key carries a version because that shape can change: a bump lets an older
 * bundle ignore a newer record instead of misreading it. It is spelled once here
 * so the readers and the writers cannot drift apart.
 */
export const SESSION_USER_KEY = "user:v1";

/** Where the session was cached before the key carried a version. */
const UNVERSIONED_SESSION_USER_KEY = "user";

/**
 * Read the cached user, or null when there is none (or it cannot be read).
 *
 * A session cached under the unversioned key is adopted into the versioned one
 * on first read, so adding the version does not sign anyone out; the old record
 * is dropped as it is adopted.
 */
export function readStoredUser(): User | null {
	try {
		const raw = localStorage.getItem(SESSION_USER_KEY);
		if (raw) return JSON.parse(raw) as User;
		const unversioned = localStorage.getItem(UNVERSIONED_SESSION_USER_KEY);
		if (!unversioned) return null;
		localStorage.removeItem(UNVERSIONED_SESSION_USER_KEY);
		localStorage.setItem(SESSION_USER_KEY, unversioned);
		return JSON.parse(unversioned) as User;
	} catch {
		// Storage blocked (private mode, disabled cookies) or the record is
		// unreadable. A cache that cannot be read means the visitor is treated as
		// signed out, which is also what a stale record has to mean.
		clearStoredUser();
		return null;
	}
}

/** Cache the user a sign-in, an onboarding, or a profile edit just returned. */
export function writeStoredUser(user: AuthUser | User): void {
	localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

/** Drop the cached user. The session itself ends at the auth service. */
export function clearStoredUser(): void {
	try {
		localStorage.removeItem(SESSION_USER_KEY);
		localStorage.removeItem(UNVERSIONED_SESSION_USER_KEY);
	} catch {
		// Storage blocked: there is no cache to drop.
	}
}
