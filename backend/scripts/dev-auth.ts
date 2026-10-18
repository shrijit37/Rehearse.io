#!/usr/bin/env bun
/**
 * Local dev auth service — a stand-in for the shared Better Auth instance
 * (auth.shrijit.tech) so sign-in works against a localhost API.
 *
 * Why this exists: the real session cookie is scoped to `.shrijit.tech`, and a
 * browser never sends that cookie to `localhost:9000`. The API authenticates
 * every request by forwarding the browser's cookie to
 * `$AUTH_URL/api/auth/get-session` (src/middleware/auth.middleware.ts), so
 * local dev needs an auth service that lives on localhost and answers that
 * call. Cookies ignore ports, so the one cookie set here for `localhost`
 * reaches the API on :9000 and this service on :4000 alike.
 *
 * Implemented surface — exactly what frontend/src/lib/auth-client.ts calls:
 *   GET  /api/auth/get-session    -> { session, user } or `null`
 *   POST /api/auth/sign-in/email  -> sets better-auth.session_token
 *   POST /api/auth/sign-up/email  -> creates a local account (no verification mail)
 *   POST /api/auth/sign-out       -> clears the session
 *   POST /api/auth/update-user    -> renames the account (the profile page's
 *                                    display-name write-through)
 *   POST /api/auth/sign-in/social -> refused: no OAuth provider in dev
 *   GET  /__dev/health            -> readiness for scripts/dev
 *
 * Accounts and sessions persist in .dev/ (git-ignored) so a stack restart does
 * not sign you out. The seeded accounts are local-only: never create
 * `<role>@shrijit.tech` on the shared auth service.
 *
 * Run through `./scripts/dev local`; standalone: `bun run dev-auth`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEV_ACCOUNTS, DEV_PASSWORD } from "./dev-accounts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const PORT = Number(process.env.DEV_AUTH_PORT ?? 4000);
const PASSWORD = DEV_PASSWORD;
const STATE_DIR = process.env.DEV_STATE_DIR ?? join(REPO_ROOT, ".dev");
const ACCOUNTS_FILE = join(STATE_DIR, "auth-accounts.json");
const SESSIONS_FILE = join(STATE_DIR, "auth-sessions.json");
const COOKIE = "better-auth.session_token";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Account {
    /** The `auth_id` the API stores on its own user row. Stable across runs. */
    id: string;
    email: string;
    name: string;
    passwordHash: string;
}

interface Session {
    token: string;
    accountId: string;
    expiresAt: number;
}

/** The two roles the app authorizes on; ids are pinned so seeds can match. */
const SEED_ACCOUNTS = DEV_ACCOUNTS;

mkdirSync(STATE_DIR, { recursive: true });

/** Reads a JSON state file, moving a corrupt one aside instead of dying. */
function readJson<T>(path: string, fallback: T): T {
    let raw: string;
    try {
        raw = readFileSync(path, "utf8");
    } catch {
        return fallback;
    }
    try {
        return JSON.parse(raw) as T;
    } catch {
        renameSync(path, `${path}.corrupt-${Date.now()}`);
        console.warn(`[dev-auth] ${path} was corrupt; moved it aside and started fresh`);
        return fallback;
    }
}

/** write-then-rename so a crash never leaves a half-written state file. */
function writeJson(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, path);
}

const accounts: Account[] = readJson<Account[]>(ACCOUNTS_FILE, []);
const sessions = new Map<string, Session>(
    readJson<Session[]>(SESSIONS_FILE, []).map((session) => [session.token, session]),
);

const normalize = (email: string): string => email.trim().toLowerCase();
const findAccount = (email: string): Account | undefined =>
    accounts.find((account) => account.email === normalize(email));

// Re-hash on every boot: the password stays whatever `DEV_AUTH_PASSWORD` holds
// — the value `./scripts/dev` exports and prints — and `.dev/auth-accounts.json`
// never holds a stale seed hash.
for (const seed of SEED_ACCOUNTS) {
    const existing = findAccount(seed.email);
    const passwordHash = await Bun.password.hash(PASSWORD);
    if (existing) {
        Object.assign(existing, { id: seed.id, name: seed.name, passwordHash });
        continue;
    }
    accounts.push({ ...seed, passwordHash });
}
writeJson(ACCOUNTS_FILE, accounts);

function saveSessions(): void {
    writeJson(SESSIONS_FILE, [...sessions.values()]);
}
saveSessions();

const publicUser = (account: Account) => ({
    id: account.id,
    email: account.email,
    name: account.name,
    emailVerified: true,
});

/** localhost origins on any port; the SPA may run on a port of its own. */
function originAllowed(origin: string | null): boolean {
    if (!origin) return false;
    try {
        const { hostname } = new URL(origin);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    } catch {
        return false;
    }
}

/** Origins explicitly tolerated by DEV_AUTH_ALLOWED_ORIGINS despite being cross-site. */
const EXTRA_ORIGINS = (process.env.DEV_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const warnedOrigins = new Set<string>();

/**
 * The dev stack serves the API and this service on 127.0.0.1, so a page served
 * from `localhost` is a *different site*: the SameSite=Lax session cookie can
 * neither be stored by it nor sent to the API. Left alone that reads as
 * "sign-in silently does nothing", so it is refused with the fix instead.
 */
function crossSiteMessage(origin: string): string {
    const suggested = origin.replace("://localhost", "://127.0.0.1");
    return `This page is on ${origin}, but the local dev stack serves the API on 127.0.0.1 — different site, so the session cookie cannot flow. Open ${suggested} instead (the dev script prints the exact URL). To allow this origin deliberately, set DEV_AUTH_ALLOWED_ORIGINS=${origin}.`;
}

function isLoopbackName(hostname: string): boolean {
    return hostname === "localhost" || hostname.endsWith(".localhost");
}

function isLoopbackAddress(hostname: string): boolean {
    return hostname === "::1" || hostname.startsWith("127.") || hostname === "[::1]";
}

function corsHeaders(origin: string | null): Record<string, string> {
    const headers: Record<string, string> = { Vary: "Origin" };
    if (originAllowed(origin)) {
        headers["Access-Control-Allow-Origin"] = origin as string;
        headers["Access-Control-Allow-Credentials"] = "true";
    }
    return headers;
}

function json(
    body: unknown,
    status: number,
    origin: string | null,
    extra: Record<string, string> = {},
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...corsHeaders(origin), ...extra },
    });
}

const sessionCookie = (token: string, maxAgeSeconds: number): string =>
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

/** Exact-match cookie lookup; a missing cookie is not an error. */
function cookieValue(req: Request, name: string): string | null {
    const header = req.headers.get("cookie");
    if (!header) return null;
    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return rest.join("=");
    }
    return null;
}

/** The live session behind a request's cookie, or null. Expired tokens are dropped. */
function sessionForRequest(req: Request): { account: Account; session: Session } | null {
    const token = cookieValue(req, COOKIE);
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
        sessions.delete(session.token);
        saveSessions();
        return null;
    }
    const account = accounts.find((entry) => entry.id === session.accountId);
    return account ? { account, session } : null;
}

function openSession(account: Account): Session {
    const session: Session = {
        token: crypto.randomUUID().replaceAll("-", ""),
        accountId: account.id,
        expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(session.token, session);
    saveSessions();
    return session;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
    try {
        const body = (await req.json()) as unknown;
        return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

const readString = (body: Record<string, unknown>, key: string): string =>
    typeof body[key] === "string" ? (body[key] as string) : "";

const server = Bun.serve({
    port: PORT,
    hostname: "127.0.0.1",
    async fetch(req): Promise<Response> {
        const origin = req.headers.get("origin");
        const { pathname } = new URL(req.url);

        if (req.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    ...corsHeaders(origin),
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "content-type, authorization",
                    "Access-Control-Max-Age": "600",
                },
            });
        }

        if (pathname === "/__dev/health") {
            return json(
                { status: "ok", service: "dev-auth", accounts: accounts.map((account) => account.email) },
                200,
                origin,
            );
        }

        // A `localhost` page against a 127.0.0.1 stack (or the reverse) is
        // cross-site: say so here rather than let the SPA fail as "signed in,
        // then 401 on every call".
        if (origin && originAllowed(origin) && !EXTRA_ORIGINS.includes(origin)) {
            const { hostname } = new URL(origin);
            if (isLoopbackName(hostname) && !isLoopbackAddress(hostname)) {
                if (!warnedOrigins.has(origin)) {
                    warnedOrigins.add(origin);
                    console.warn(`[dev-auth] cross-site origin ${origin}: ${crossSiteMessage(origin)}`);
                }
                return json({ message: crossSiteMessage(origin) }, 400, origin);
            }
        }

        if (pathname === "/api/auth/get-session" && req.method === "GET") {
            const current = sessionForRequest(req);
            // `null` (not an empty object) is what Better Auth answers with no
            // session, and what the backend middleware treats as unauthenticated.
            if (!current) return json(null, 200, origin);
            return json(
                {
                    session: {
                        id: current.session.token,
                        userId: current.account.id,
                        token: current.session.token,
                        expiresAt: new Date(current.session.expiresAt).toISOString(),
                    },
                    user: publicUser(current.account),
                },
                200,
                origin,
            );
        }

        if (pathname === "/api/auth/sign-in/email" && req.method === "POST") {
            const body = await readBody(req);
            const account = findAccount(readString(body, "email"));
            const ok = account ? await Bun.password.verify(readString(body, "password"), account.passwordHash) : false;
            if (!account || !ok) {
                // One message for unknown email and wrong password, like the real service.
                return json({ message: "Invalid email or password" }, 401, origin);
            }
            const session = openSession(account);
            console.log(`[dev-auth] sign-in ${account.email} (${account.id})`);
            return json({ token: session.token, user: publicUser(account) }, 200, origin, {
                "set-cookie": sessionCookie(session.token, SESSION_TTL_MS / 1000),
            });
        }

        if (pathname === "/api/auth/sign-up/email" && req.method === "POST") {
            const body = await readBody(req);
            const email = normalize(readString(body, "email"));
            const password = readString(body, "password");
            const name = readString(body, "name").trim() || email;
            if (!email.includes("@")) return json({ message: "A valid email is required" }, 400, origin);
            if (password.length < 8) {
                return json({ message: "Password must be at least 8 characters" }, 400, origin);
            }
            if (findAccount(email)) return json({ message: "User already exists" }, 422, origin);
            const account: Account = {
                id: `dev-${crypto.randomUUID().slice(0, 8)}`,
                email,
                name,
                passwordHash: await Bun.password.hash(password),
            };
            accounts.push(account);
            writeJson(ACCOUNTS_FILE, accounts);
            // No cookie, deliberately: the real service mails a verification
            // link first, so the UI's "check your inbox" step stays real here.
            console.log(`[dev-auth] created account ${account.email} (${account.id}); verification skipped in dev`);
            return json({ user: publicUser(account) }, 200, origin);
        }

        if (pathname === "/api/auth/update-user" && req.method === "POST") {
            // The real Better Auth endpoint the profile page writes the display
            // name through; without it here, a name edit could not be verified
            // locally at all.
            const current = sessionForRequest(req);
            if (!current) return json({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401, origin);
            const name = readString(await readBody(req), "name").trim();
            if (name) {
                current.account.name = name;
                writeJson(ACCOUNTS_FILE, accounts);
                console.log(`[dev-auth] update-user ${current.account.email} -> name "${name}"`);
            }
            return json({ user: publicUser(current.account) }, 200, origin);
        }

        if (pathname === "/api/auth/sign-out" && req.method === "POST") {
            const token = cookieValue(req, COOKIE);
            if (token && sessions.delete(token)) saveSessions();
            return json({ success: true }, 200, origin, {
                "set-cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
            });
        }

        if (pathname === "/api/auth/sign-in/social") {
            return json(
                {
                    message:
                        "Social sign-in is not available in local dev. Sign in with a test account, or sign up with an email and password.",
                },
                400,
                origin,
            );
        }

        return json(
            {
                message: `dev-auth: ${req.method} ${pathname} is not implemented (local dev implements only the session endpoints the SPA calls)`,
            },
            404,
            origin,
        );
    },
});

console.log(`[dev-auth] listening on http://127.0.0.1:${server.port}`);
console.log(
    // The password itself is never printed: it is the value the caller set in
    // DEV_AUTH_PASSWORD (and `./scripts/dev`, which sets it, prints it with the
    // rest of the local stack summary).
    `[dev-auth] accounts: ${accounts.map((account) => account.email).join(", ")} — password: DEV_AUTH_PASSWORD (seeded accounts only)`,
);
