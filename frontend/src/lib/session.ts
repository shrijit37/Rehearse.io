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
 * `localStorage.getItem`, which throws outright when storage is disabled (private
 * browsing) rather than answering null — so every read is guarded on its own.
 */
function readKey(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function clearKey(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage blocked: there is no cache to drop.
	}
}

/**
 * A record that cannot be parsed is dropped — that one record only, so a corrupt
 * cache never takes a readable one down with it — and reads as no session.
 */
function parseUser(raw: string, key: string): User | null {
	try {
		return JSON.parse(raw) as User;
	} catch {
		clearKey(key);
		return null;
	}
}

/**
 * Read the cached user, or null when there is none (or it cannot be read).
 *
 * A session cached under the unversioned key is adopted into the versioned one on
 * first read, so adding the version does not sign anyone out. The adoption writes
 * the new record before dropping the old one, so a write that fails — quota, or
 * storage that only reads — leaves the session that is still readable in place for
 * the next read to try again.
 */
export function readStoredUser(): User | null {
	const versioned = readKey(SESSION_USER_KEY);
	if (versioned) return parseUser(versioned, SESSION_USER_KEY);
	const unversioned = readKey(UNVERSIONED_SESSION_USER_KEY);
	if (!unversioned) return null;
	const adopted = parseUser(unversioned, UNVERSIONED_SESSION_USER_KEY);
	if (!adopted) return null;
	try {
		localStorage.setItem(SESSION_USER_KEY, unversioned);
	} catch {
		return adopted;
	}
	clearKey(UNVERSIONED_SESSION_USER_KEY);
	return adopted;
}

/** Cache the user a sign-in, an onboarding, or a profile edit just returned. */
export function writeStoredUser(user: AuthUser | User): void {
	localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

/** Drop the cached user. The session itself ends at the auth service. */
export function clearStoredUser(): void {
	clearKey(SESSION_USER_KEY);
	clearKey(UNVERSIONED_SESSION_USER_KEY);
}
