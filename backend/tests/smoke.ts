/**
 * Smoke test for the deployed (or locally booted) API.
 *
 * Every app-specific flow now authenticates with the shared Better Auth
 * session cookie, so these checks:
 *   - refuse anonymous access (401)
 *   - sign in through the shared auth service with SMOKE_EMAIL / SMOKE_PASSWORD
 *     and carry that cookie through the whole run
 *   - claim a profile for the signed-in visitor (role + consent)
 *   - prove the role from the claim is what the app authorizes on
 *   - reject a forged session cookie
 */
import { config } from "dotenv";
config();

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:9000";
const AUTH_URL = process.env.AUTH_URL ?? "https://auth.shrijit.tech";
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const RECRUITER_EMAIL = process.env.SMOKE_RECRUITER_EMAIL;
const RECRUITER_PASSWORD = process.env.SMOKE_RECRUITER_PASSWORD;

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ""): void {
    if (ok) {
        passed++;
        console.log(`  ok   ${name}`);
    } else {
        failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
        console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    }
}

let cookie = "";

async function api(path: string, init: RequestInit = {}, options: { token?: string; cookie?: string } = {}): Promise<{ status: number; body: any }> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const sentCookie = options.cookie ?? cookie;
    if (sentCookie) headers.set("Cookie", sentCookie);
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    const text = await res.text();
    let body: unknown = text;
    try {
        body = JSON.parse(text);
    } catch {
        /* non-JSON body */
    }
    return { status: res.status, body };
}

async function signIn(email: string, password: string): Promise<boolean> {
    const res = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        console.log(`  !! shared auth sign-in failed for ${email}: ${res.status} ${await res.text()}`);
        return false;
    }
    const setCookie = res.headers.get("set-cookie") ?? "";
    cookie = setCookie.split(";")[0] ?? cookie;
    return cookie.includes("better-auth.session_token");
}

async function main(): Promise<void> {
    console.log(`smoke: ${BASE} (auth ${AUTH_URL})`);

    const health = await api("/health");
    check("health 200", health.status === 200, `got ${health.status}`);

    const anon = await api("/api/auth/session", {}, { cookie: "" });
    check("anonymous /api/auth/session is 401", anon.status === 401, `got ${anon.status}`);

    const anonUsers = await api("/api/users/", {}, { cookie: "" });
    check("anonymous /api/users/ is 401", anonUsers.status === 401, `got ${anonUsers.status}`);

    if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
        throw new Error("SMOKE_EMAIL and SMOKE_PASSWORD are required for the shared-auth smoke test");
    }
    if (!(await signIn(SMOKE_EMAIL, SMOKE_PASSWORD))) throw new Error("could not sign in to the shared auth service");

    const session = await api("/api/auth/session");
    check("authenticated /api/auth/session is 200", session.status === 200, `got ${session.status}`);
    check("session returns the local profile", Boolean(session.body?.user?.email), JSON.stringify(session.body));

    const claim = await api("/api/auth/claim", {
        method: "POST",
        body: JSON.stringify({ role: "candidate", consentGiven: true, consentVersion: "1.0" }),
    });
    check("claim stores role + consent", claim.status === 200, `got ${claim.status}`);
    check("claim returns a public user with _id", Boolean(claim.body?.user?._id), JSON.stringify(claim.body));

    const badClaim = await api("/api/auth/claim", { method: "POST", body: JSON.stringify({ role: "wizard" }) });
    check("claim rejects an unknown role with 400", badClaim.status === 400, `got ${badClaim.status}`);

    const forged = await api("/api/users/", {}, { cookie: "better-auth.session_token=forged" });
    check("forged session cookie is 401", forged.status === 401, `got ${forged.status}`);

    const users = await api("/api/users/");
    check("authenticated /api/users/ is 200", users.status === 200, `got ${users.status}`);

    const org = await api("/api/org/");
    check("authenticated /api/org/ is 200", org.status === 200, `got ${org.status}`);

    const interviews = await api("/api/interviews/");
    check("claimed candidate is refused recruiter routes (403)", interviews.status === 403, `got ${interviews.status}`);

    if (RECRUITER_EMAIL && RECRUITER_PASSWORD) {
        const saved = cookie;
        cookie = "";
        if (await signIn(RECRUITER_EMAIL, RECRUITER_PASSWORD)) {
            const recInterviews = await api("/api/interviews/");
            check("recruiter reaches recruiter routes (200)", recInterviews.status === 200, `got ${recInterviews.status}`);
        } else {
            check("recruiter signs in to the shared auth service", false);
        }
        cookie = saved;
    } else {
        console.log("  --   skipping recruiter check (no SMOKE_RECRUITER_* credentials)");
    }

    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length) {
        for (const failure of failures) console.log(`  - ${failure}`);
        process.exit(1);
    }
}

await main();