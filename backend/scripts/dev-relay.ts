#!/usr/bin/env bun
/**
 * Prod-mode dev relay — what makes `./scripts/dev prod` (local SPA, deployed
 * API) able to sign in at all.
 *
 * The deployed stack authenticates with a `.shrijit.tech` session cookie, and a
 * browser never sends that cookie to a localhost API: same-site stops it, and
 * localhost is a different site entirely. So the relay keeps the session where
 * a browser cannot interfere — server-side:
 *
 *   browser (:5173) → relay (:4100) → auth.shrijit.tech | api.rehearse.io.shrijit.tech
 *
 *   - `/api/auth/sign-in/email` is forwarded to the shared auth service with a
 *     trusted `Origin`; the `better-auth.session_token` it answers with is
 *     captured here (never sent to the browser) and persisted in `.dev/`.
 *   - Everything else (`/api/*`, `/health`) goes to the deployed API with that
 *     cookie injected, so the SPA is signed in as the account used to sign in.
 *
 * Deliberate limits, all reported loudly: social sign-in cannot complete
 * through a relay (the OAuth callback lands on the real auth domain), and
 * `/ws/live` is not proxied — voice is not provisioned in prod anyway.
 *
 * Run through `./scripts/dev prod`; standalone: `bun run dev-relay`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const PORT = Number(process.env.DEV_RELAY_PORT ?? 4100);
const API_URL = (process.env.DEV_API_URL ?? "https://api.rehearse.io.shrijit.tech").replace(/\/+$/, "");
const AUTH_URL = (process.env.DEV_AUTH_URL ?? "https://auth.shrijit.tech").replace(/\/+$/, "");
/** An origin the shared auth service trusts; it rejects unknown ones with INVALID_ORIGIN. */
const AUTH_ORIGIN = process.env.DEV_AUTH_ORIGIN ?? "https://rehearse.io.shrijit.tech";
const STATE_DIR = process.env.DEV_STATE_DIR ?? join(REPO_ROOT, ".dev");
const SESSION_FILE = join(STATE_DIR, "prod-session.json");
const COOKIE = "better-auth.session_token";
const UPSTREAM_TIMEOUT_MS = 60_000;
/** Paths that belong to the shared auth service rather than to the API. */
const AUTH_PATHS = /^\/api\/auth\/(get-session|sign-in\/|sign-up\/|sign-out)/;
/** Auth paths that hand out a session: a cookie in their response *is* the session.
 * Sign-up counts: the shared service signs the new account in as it answers. */
const SESSION_ESTABLISHING_PATHS = /^\/api\/auth\/(sign-in|sign-up)\//;

for (const [name, url] of [
    ["DEV_API_URL", API_URL],
    ["DEV_AUTH_URL", AUTH_URL],
] as const) {
    const { protocol, hostname } = new URL(url);
    const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (protocol !== "https:" && !loopback) {
        console.error(`[dev-relay] refusing ${name}=${url}: only https (or a loopback fake) is allowed`);
        process.exit(1);
    }
}

/** The session cookies the API looks for: `better-auth.session_token` is the one
 * that matters, `session_data` is the cookie cache Better Auth adds next to it.
 * Prod uses the `__Secure-`-prefixed names (`useSecureCookies: true`), the dev
 * service the plain ones; both must be captured or the API sees no session. */
const SESSION_COOKIE_NAME = /^(__Secure-)?better-auth\.(session_token|session_data)$/;

function sessionPairs(response: Response): string[] {
    const pairs: string[] = [];
    for (const header of response.headers.getSetCookie()) {
        const pair = (header.split(";")[0] ?? "").trim();
        const name = pair.split("=")[0] ?? "";
        if (SESSION_COOKIE_NAME.test(name) && pair.includes("=") && !pair.endsWith("=")) pairs.push(pair);
    }
    return pairs;
}

/** The account email in a sign-in/sign-up payload, read as untrusted data: a
 * shape this is not (or one without an email) reports as "unknown" rather than
 * failing to capture the session that came with it. */
function accountEmail(payload: unknown): string {
    if (!payload || typeof payload !== "object" || !("user" in payload)) return "unknown";
    const { user } = payload;
    if (!user || typeof user !== "object" || !("email" in user)) return "unknown";
    return typeof user.email === "string" ? user.email : "unknown";
}

interface StoredSession {
    cookie: string;
    email: string;
    savedAt: number;
}

mkdirSync(STATE_DIR, { recursive: true });

/** Loads the captured session; a corrupt file must not brick the relay. */
function loadSession(): StoredSession | null {
    let raw: string;
    try {
        raw = readFileSync(SESSION_FILE, "utf8");
    } catch {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as StoredSession;
        return parsed.cookie?.includes(COOKIE) ? parsed : null;
    } catch {
        renameSync(SESSION_FILE, `${SESSION_FILE}.corrupt-${Date.now()}`);
        console.warn(`[dev-relay] ${SESSION_FILE} was corrupt; moved it aside`);
        return null;
    }
}

function saveSession(session: StoredSession | null): void {
    current = session;
    if (!session) {
        try {
            writeFileSync(SESSION_FILE, "{}\n", { mode: 0o600 });
        } catch {
            /* the relay keeps working without a session file */
        }
        return;
    }
    const tmp = `${SESSION_FILE}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, SESSION_FILE);
}

let current = loadSession();

/** Origins a browser page may call this relay from. */
function originAllowed(origin: string | null): boolean {
    if (!origin) return false;
    try {
        const { hostname } = new URL(origin);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    } catch {
        return false;
    }
}

function corsHeaders(origin: string | null): Record<string, string> {
    const headers: Record<string, string> = { Vary: "Origin" };
    if (originAllowed(origin)) {
        headers["Access-Control-Allow-Origin"] = origin as string;
        headers["Access-Control-Allow-Credentials"] = "true";
    }
    return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...corsHeaders(origin) },
    });
}

/** Headers that must not be copied upstream: hop-by-hop, and the ones this relay owns. */
const STRIPPED_REQUEST_HEADERS = new Set([
    "host",
    "origin",
    "referer",
    "cookie",
    "content-length",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "accept-encoding",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
    "sec-fetch-user",
]);

/** Response headers worth relaying; the rest (CORS, encoding, cookies) is this relay's. */
const KEPT_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control", "etag"];

function upstreamHeaders(req: Request, extra: Record<string, string> = {}): Headers {
    const headers = new Headers();
    req.headers.forEach((value, key) => {
        if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
    return headers;
}

/** One upstream call; never throws — a network failure is a 502 the SPA can show. */
async function forward(
    url: string,
    method: string,
    headers: Headers,
    body: ArrayBuffer | null,
): Promise<{ response: Response | null; error: string | null }> {
    if (body) headers.set("content-length", String(body.byteLength));
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ?? undefined,
            redirect: "manual",
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        return { response, error: null };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        return { response: null, error: message };
    }
}

/** Streams an upstream response through with this relay's CORS headers. */
function relayResponse(upstream: Response, origin: string | null): Response {
    const headers = new Headers(corsHeaders(origin));
    for (const name of KEPT_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
}

async function readBody(req: Request): Promise<ArrayBuffer | null> {
    if (req.method === "GET" || req.method === "HEAD") return null;
    return await req.arrayBuffer();
}

const server = Bun.serve({
    port: PORT,
    hostname: "127.0.0.1",
    idleTimeout: 120,
    async fetch(req): Promise<Response> {
        const origin = req.headers.get("origin");
        const { pathname, search } = new URL(req.url);
        const started = performance.now();
        const method = req.method;

        const done = (response: Response, where: string): Response => {
            console.log(
                `[relay] ${method} ${pathname}${search} -> ${response.status} (${Math.round(performance.now() - started)}ms, ${where})`,
            );
            return response;
        };

        if (method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    ...corsHeaders(origin),
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "content-type, authorization",
                    "Access-Control-Max-Age": "600",
                },
            });
        }

        // Only pages on this machine may drive the relay; anything else is a
        // foreign origin and never gets a CORS grant.
        if (origin && !originAllowed(origin)) {
            return done(json({ message: `dev-relay: origin ${origin} is not allowed` }, 403, origin), "foreign-origin");
        }

        if (pathname === "/__dev/relay") {
            return done(
                json(
                    {
                        status: "ok",
                        service: "dev-relay",
                        api: API_URL,
                        auth: AUTH_URL,
                        signedIn: Boolean(current),
                        account: current?.email ?? null,
                    },
                    200,
                    origin,
                ),
                "status",
            );
        }

        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
            return done(
                json(
                    {
                        message:
                            "Live voice sessions are not proxied by the dev relay (and prod has no voice key provisioned). Use ./scripts/dev local for voice.",
                    },
                    501,
                    origin,
                ),
                "ws-refused",
            );
        }

        if (pathname === "/api/auth/sign-in/social" || pathname.startsWith("/api/auth/callback/")) {
            return done(
                json(
                    {
                        message:
                            "Google/GitHub sign-in cannot complete through the dev relay: the OAuth callback lands on the real auth domain, not here. Sign in with email and password (the account needs a password on the shared auth service).",
                    },
                    400,
                    origin,
                ),
                "social-refused",
            );
        }

        const body = await readBody(req);

        // --- The shared auth service: session establishment lives here. ---
        if (AUTH_PATHS.test(pathname)) {
            // The browser's own cookie is stripped (it cannot be the session —
            // that is the whole point of this relay); the captured one stands
            // in for it, so get-session and sign-out see the real session.
            const headers = upstreamHeaders(req, {
                origin: AUTH_ORIGIN,
                ...(current ? { cookie: current.cookie } : {}),
            });
            const { response, error } = await forward(`${AUTH_URL}${pathname}${search}`, method, headers, body);
            if (!response) {
                return done(json({ message: `auth service unreachable: ${error}` }, 502, origin), "auth-error");
            }

            const pairs = sessionPairs(response);
            const hasToken = pairs.some((pair) => pair.startsWith(`${COOKIE}=`) || pair.startsWith(`__Secure-${COOKIE}=`));
            // Any auth path that answers with a session cookie establishes one —
            // sign-up does, the shared service signs the new account in as it
            // answers — so the cookie is kept whatever produced it.
            const establishes = SESSION_ESTABLISHING_PATHS.test(pathname);
            if (establishes && response.ok && hasToken) {
                const payload: unknown = await response
                    .clone()
                    .json()
                    .catch(() => null as unknown);
                const email = accountEmail(payload);
                saveSession({ cookie: pairs.join("; "), email, savedAt: Date.now() });
                console.log(
                    `[relay] signed in as ${email} (${pairs.length} session cookie(s) stored in ${SESSION_FILE})`,
                );
            } else if (establishes && response.ok) {
                console.warn(
                    `[relay] ${pathname} succeeded but no session cookie was offered; the deployed auth service may have changed its cookie policy`,
                );
            }
            if (pathname === "/api/auth/sign-out") {
                saveSession(null);
                console.log("[relay] signed out; session cleared");
            }

            if (pathname === "/api/auth/get-session" && method === "GET" && response.ok) {
                // A get-session answer that says "no user" means the stored
                // cookie died server-side; drop it so the UI matches.
                const payload = await response
                    .clone()
                    .json()
                    .catch(() => null as unknown);
                const hasUser = Boolean(payload && typeof payload === "object" && (payload as { user?: unknown }).user);
                if (!hasUser && current) {
                    console.log("[relay] stored session is no longer valid upstream; cleared");
                    saveSession(null);
                }
            }

            return done(relayResponse(response, origin), "auth");
        }

        // --- The deployed API: everything the SPA calls, cookie injected. ---
        if (pathname.startsWith("/api/") || pathname === "/health") {
            const headers = upstreamHeaders(req, current ? { cookie: current.cookie } : {});
            const { response, error } = await forward(`${API_URL}${pathname}${search}`, method, headers, body);
            if (!response) {
                return done(json({ message: `deployed API unreachable: ${error}` }, 502, origin), "api-error");
            }
            if (response.status === 401 && current && req.headers.get("authorization") === null) {
                // Only a 401 to a call that carried no credential of its own
                // proves the injected cookie died. The SPA sends a request-scoped
                // Bearer for interview invite links (frontend/src/lib/api.ts), and
                // that route answers 401 for a bad invite token while the stored
                // session is perfectly alive.
                console.log("[relay] got 401 from the API; clearing the stored session");
                saveSession(null);
            }
            return done(relayResponse(response, origin), "api");
        }

        return done(json({ message: `dev-relay: ${method} ${pathname} is not proxied` }, 404, origin), "unrouted");
    },
});

console.log(`[dev-relay] listening on http://127.0.0.1:${server.port}`);
console.log(`[dev-relay] api: ${API_URL}`);
console.log(`[dev-relay] auth: ${AUTH_URL} (origin ${AUTH_ORIGIN})`);
console.log(
    current
        ? `[dev-relay] session for ${current.email} restored from ${SESSION_FILE}`
        : `[dev-relay] no session yet — sign in through the local frontend`,
);
