/**
 * Smoke test for the deployed (or locally booted) API.
 *
 * Every app-specific flow authenticates with a Supabase Auth access token
 * (Bearer), so these checks:
 *   - refuse anonymous access (401)
 *   - sign in through Supabase Auth with SMOKE_EMAIL / SMOKE_PASSWORD and carry
 *     that token through the whole run
 *   - claim a profile for the signed-in visitor (role + consent)
 *   - prove the role from the claim is what the app authorizes on
 *   - reject a forged token
 */
import { config } from "dotenv";
config();

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:9000";
const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
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

let token = "";

async function api(
    path: string,
    init: RequestInit = {},
    options: { token?: string } = {},
): Promise<{ status: number; body: any }> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const authToken = options.token ?? token;
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

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
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
        console.log("  !! SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are required");
        return false;
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        console.log(`  !! Supabase sign-in failed for ${email}: ${res.status} ${await res.text()}`);
        return false;
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return false;
    token = data.access_token;
    return true;
}

async function main(): Promise<void> {
    console.log(`smoke: ${BASE} (supabase ${SUPABASE_URL || "unset"})`);

    const health = await api("/health");
    check("health 200", health.status === 200, `got ${health.status}`);

    const anon = await api("/api/auth/session", {}, { token: "" });
    check("anonymous /api/auth/session is 401", anon.status === 401, `got ${anon.status}`);

    const anonUsers = await api("/api/users/", {}, { token: "" });
    check("anonymous /api/users/ is 401", anonUsers.status === 401, `got ${anonUsers.status}`);

    if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
        throw new Error("SMOKE_EMAIL and SMOKE_PASSWORD are required for the Supabase smoke test");
    }
    if (!(await signIn(SMOKE_EMAIL, SMOKE_PASSWORD))) throw new Error("could not sign in to Supabase Auth");

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

    const forged = await api("/api/users/", {}, { token: "forged" });
    check("forged token is 401", forged.status === 401, `got ${forged.status}`);

    const users = await api("/api/users/");
    check("authenticated /api/users/ is 200", users.status === 200, `got ${users.status}`);

    // The profile contract: the record is served without its sealed blobs, and
    // each blob is reachable only through its own owner-only endpoint.
    const profile = users.body?.data;
    check(
        "profile carries the record",
        typeof profile?.name === "string" && typeof profile?.email === "string",
        JSON.stringify(users.body),
    );
    check(
        "profile omits the sealed blobs",
        profile?.audio === undefined &&
            !JSON.stringify(profile).includes("enc:v1:") &&
            typeof profile?.resume.present === "boolean" &&
            typeof profile?.photo.present === "boolean" &&
            typeof profile?.voice.present === "boolean",
        JSON.stringify(profile),
    );
    check(
        "profile reports what is on record",
        profile?.resume !== undefined && typeof profile.resume.present === "boolean",
        JSON.stringify(profile?.resume),
    );
    check(
        "profile states what a round reads",
        ["profile", "resume", "none"].includes(profile?.roundSource?.kind),
        JSON.stringify(profile?.roundSource),
    );

    const anonMedia = await api("/api/users/profile/media/resume", {}, { token: "" });
    check("anonymous media fetch is 401", anonMedia.status === 401, `got ${anonMedia.status}`);

    const badMedia = await api("/api/users/profile/media/not-a-kind");
    check("unknown media kind is 400", badMedia.status === 400, `got ${badMedia.status}`);

    const readShape = (body: any): string => {
        const d = body?.data ?? {};
        return JSON.stringify({
            headline: d.headline,
            location: d.location,
            skills: d.skills,
            experience: d.experience,
            education: d.education,
            resumeParsedAt: d.resumeParsedAt,
            parsedFrom: d.resume?.parsedAt,
        });
    };
    const beforeRead = readShape((await api("/api/users/profile")).body);
    const preview = await api("/api/users/profile/parse-resume", {
        method: "POST",
        body: JSON.stringify({ apply: false }),
    });
    check(
        "a preview is never refused as malformed",
        ![400, 401, 403].includes(preview.status),
        `got ${preview.status}`,
    );
    const afterRead = readShape((await api("/api/users/profile")).body);
    check(
        "a preview changes nothing",
        beforeRead === afterRead,
        `${beforeRead}\n         vs ${afterRead}`,
    );
    if (preview.status === 200) {
        check(
            "a preview reports no changes applied",
            Array.isArray(preview.body?.changed) && preview.body.changed.length === 0,
            JSON.stringify(preview.body?.changed),
        );
    } else {
        console.log(
            `  --   read unavailable here (${preview.status}); the preview invariant still held`,
        );
    }

    const emptyPatch = await api("/api/users/profile", {
        method: "PATCH",
        body: JSON.stringify({}),
    });
    check("an empty profile patch is refused", emptyPatch.status === 400, `got ${emptyPatch.status}`);

    const org = await api("/api/org/");
    check("authenticated /api/org/ is 200", org.status === 200, `got ${org.status}`);

    const interviews = await api("/api/interviews/");
    check("claimed candidate is refused recruiter routes (403)", interviews.status === 403, `got ${interviews.status}`);

    if (RECRUITER_EMAIL && RECRUITER_PASSWORD) {
        const saved = token;
        token = "";
        if (await signIn(RECRUITER_EMAIL, RECRUITER_PASSWORD)) {
            const recInterviews = await api("/api/interviews/");
            check("recruiter reaches recruiter routes (200)", recInterviews.status === 200, `got ${recInterviews.status}`);
        } else {
            check("recruiter signs in to Supabase Auth", false);
        }
        token = saved;
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
