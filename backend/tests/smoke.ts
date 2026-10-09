/**
 * End-to-end smoke test against a real Postgres.
 *
 * Requires DATABASE_URL to point at a database with migrations applied.
 * Exercises the paths that the MongoDB rewrite touched most: auth, orgs,
 * interviews, invite-token hashing, candidate claiming, GDPR, and consent.
 *
 *   DATABASE_URL=... bun tests/smoke.ts
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:9100";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
    if (condition) {
        passed++;
        console.log(`  PASS  ${name}`);
    } else {
        failed++;
        console.log(`  FAIL  ${name}`);
        if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`);
    }
}

async function api(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
    let json: any = null;
    try {
        json = await res.json();
    } catch {
        json = null;
    }
    return { status: res.status, json };
}

/** Asserts a Mongoose-style document: `id` present and mirrored as `_id`. */
function hasIdShape(obj: any): boolean {
    return (
        obj != null &&
        typeof obj.id === "string" &&
        obj.id.length > 0 &&
        obj._id === obj.id
    );
}

const stamp = Date.now();
const recEmail = `smoke-rec-${stamp}@example.com`;
const candEmail = `smoke-cand-${stamp}@example.com`;

async function main(): Promise<void> {
    console.log(`Smoke test against ${BASE}\n`);

    console.log("health");
    const health = await api("GET", "/health");
    check("GET /health returns ok", health.status === 200 && health.json?.status === "ok", health.json);

    check(
        "GET /health reports database up",
        health.status === 200 && health.json?.checks?.database === "up",
        health.json,
    );

    console.log("\nauth");
    const signup = await api("POST", "/api/auth/signup", {
        body: {
            name: "Smoke Recruiter",
            email: recEmail,
            password: "Passw0rd!123",
            role: "recruiter",
            consentGiven: true,
            consentVersion: "1.0",
        },
    });
    check("recruiter signup 201", signup.status === 201, signup.json);
    check("signup user has id/_id mirror", hasIdShape(signup.json?.user), signup.json?.user);

    const dupe = await api("POST", "/api/auth/signup", {
        body: { name: "Dupe", email: recEmail, password: "Passw0rd!123" },
    });
    check("duplicate signup rejected 400", dupe.status === 400, dupe.json);

    const login = await api("POST", "/api/auth/login", {
        body: { email: recEmail, password: "Passw0rd!123" },
    });
    check("login 200", login.status === 200, login.json);
    const recToken: string = login.json?.token ?? "";

    const badLogin = await api("POST", "/api/auth/login", {
        body: { email: recEmail, password: "wrong" },
    });
    check("wrong password rejected", badLogin.status === 400, badLogin.json);

    const noAuth = await api("GET", "/api/org");
    check("unauthenticated org list is 401", noAuth.status === 401, noAuth.json);

    console.log("\norganizations");
    const org = await api("POST", "/api/org", { token: recToken, body: { name: "Smoke Org" } });
    check("create org 201", org.status === 201, org.json);
    check("org has id/_id mirror", hasIdShape(org.json?.organization), org.json?.organization);
    check("creator is admin member", org.json?.organization?.members?.[0]?.role === "admin", org.json?.organization?.members);
    check("member user populated", hasIdShape(org.json?.organization?.members?.[0]?.user), org.json?.organization?.members?.[0]?.user);
    const orgId: string = org.json?.organization?.id ?? "";

    const orgList = await api("GET", "/api/org", { token: recToken });
    check("list orgs 200", orgList.status === 200 && orgList.json?.total === 1, orgList.json);
    check("listed org has id/_id", hasIdShape(orgList.json?.data?.[0]), orgList.json?.data?.[0]);

    const orgGet = await api("GET", `/api/org/${orgId}`, { token: recToken });
    check("get org 200", orgGet.status === 200, orgGet.json);

    const badOrgId = await api("GET", "/api/org/not-a-uuid", { token: recToken });
    check("invalid org id rejected 400", badOrgId.status === 400, badOrgId.json);

    console.log("\ninterviews");
    const interview = await api("POST", "/api/interviews", {
        token: recToken,
        body: {
            organizationId: orgId,
            title: "Smoke Interview",
            targetRole: "Backend Engineer",
            interviewType: "behavioral",
            questions: ["Question one?", "Question two?"],
            expiresAt: "2030-01-01T00:00:00Z",
            status: "active",
        },
    });
    check("create interview 201", interview.status === 201, interview.json);
    check("interview has id/_id", hasIdShape(interview.json?.interview), interview.json?.interview);
    check("interview organization populated", hasIdShape(interview.json?.interview?.organization), interview.json?.interview?.organization);
    const interviewId: string = interview.json?.interview?.id ?? "";

    const ivList = await api("GET", "/api/interviews", { token: recToken });
    check("list interviews 200", ivList.status === 200 && ivList.json?.total === 1, ivList.json);
    check("listed interview has id/_id", hasIdShape(ivList.json?.data?.[0]), ivList.json?.data?.[0]);

    const ivGet = await api("GET", `/api/interviews/${interviewId}`, { token: recToken });
    check("get interview 200", ivGet.status === 200, ivGet.json);
    check("get interview has id/_id", hasIdShape(ivGet.json?.interview), ivGet.json?.interview);
    check("interview creator populated", hasIdShape(ivGet.json?.interview?.createdBy), ivGet.json?.interview?.createdBy);

    const ivUpdate = await api("PUT", `/api/interviews/${interviewId}`, {
        token: recToken,
        body: { title: "Smoke Interview Updated" },
    });
    check("update interview 200", ivUpdate.status === 200, ivUpdate.json);

    const candidateBlocked = await api("GET", "/api/interviews", {
        token: (await api("POST", "/api/auth/signup", {
            body: { name: "Blocked", email: `smoke-blk-${stamp}@example.com`, password: "Passw0rd!123" },
        })).json?.token,
    });
    check("candidate cannot list recruiter interviews", candidateBlocked.status === 403, candidateBlocked.json);

    console.log("\ninvites (token hashing)");
    const invite = await api("POST", `/api/interviews/${interviewId}/invite`, {
        token: recToken,
        body: { candidateEmail: candEmail },
    });
    check("generate invite 201", invite.status === 201, invite.json);
    const rawToken: string = invite.json?.inviteToken ?? "";
    check("invite returns a raw token", rawToken.length === 64, rawToken.length);

    const dupInvite = await api("POST", `/api/interviews/${interviewId}/invite`, {
        token: recToken,
        body: { candidateEmail: candEmail },
    });
    check("duplicate invite rejected 400", dupInvite.status === 400, dupInvite.json);

    const badAccept = await api("GET", "/api/interviews/candidate/accept/deadbeef");
    check("invalid invite token 404", badAccept.status === 404, badAccept.json);

    const accept = await api("GET", `/api/interviews/candidate/accept/${rawToken}`);
    check("accept invite 200", accept.status === 200, accept.json);
    check("accepted invite has id/_id", hasIdShape(accept.json?.invite), accept.json?.invite);
    check("invite marked started", accept.json?.invite?.status === "started", accept.json?.invite?.status);
    check("interview populated on accept", hasIdShape(accept.json?.interview), accept.json?.interview);
    const candToken: string = accept.json?.token ?? "";

    const reAccept = await api("GET", `/api/interviews/candidate/accept/${rawToken}`);
    check("re-accept resumes (200)", reAccept.status === 200, reAccept.json);

    console.log("\nplaceholder claim");
    const claim = await api("POST", "/api/auth/signup", {
        body: { name: "Real Candidate", email: candEmail, password: "CandPass1!", consentGiven: true },
    });
    check("candidate claims placeholder 201", claim.status === 201, claim.json);
    check(
        "claim reuses the placeholder user id",
        claim.json?.user?.id === accept.json?.invite?.candidateId,
        { claimed: claim.json?.user?.id, invited: accept.json?.invite?.candidateId },
    );

    console.log("\ncandidate views");
    const myInterviews = await api("GET", "/api/interviews/candidate/my-interviews", { token: candToken });
    check("candidate lists own interviews", myInterviews.status === 200 && myInterviews.json?.total === 1, myInterviews.json);
    check("candidate invite has id/_id", hasIdShape(myInterviews.json?.data?.[0]), myInterviews.json?.data?.[0]);
    check(
        "nested interview has id/_id",
        hasIdShape(myInterviews.json?.data?.[0]?.interview),
        myInterviews.json?.data?.[0]?.interview,
    );
    check(
        "nested organization populated",
        myInterviews.json?.data?.[0]?.interview?.organization?.name === "Smoke Org",
        myInterviews.json?.data?.[0]?.interview?.organization,
    );

    console.log("\nGDPR + consent");
    const consent = await api("GET", "/api/users/consent", { token: candToken });
    check("consent readable", consent.status === 200 && consent.json?.consentGiven === true, consent.json);

    const revoke = await api("POST", "/api/users/consent", {
        token: candToken,
        body: { consentGiven: false, consentVersion: "2.0" },
    });
    check("consent revoke recorded", revoke.status === 200 && revoke.json?.consent?.consentGiven === false, revoke.json);

    const exportRes = await api("POST", "/api/users/export-data", { token: candToken });
    check("export 200", exportRes.status === 200, exportRes.json);
    check("export contains user email", exportRes.json?.user?.email === candEmail, exportRes.json?.user);
    check(
        "export invite has id/_id",
        hasIdShape(exportRes.json?.candidateInvites?.[0]),
        exportRes.json?.candidateInvites?.[0],
    );
    check(
        "export invite interview populated",
        // The old Mongo projection selected only these fields, so the export
        // deliberately omits the full record. The title reflects the earlier
        // update, which is what proves the reference resolved.
        exportRes.json?.candidateInvites?.[0]?.interview?.title === "Smoke Interview Updated",
        exportRes.json?.candidateInvites?.[0]?.interview,
    );

    const badDelete = await api("DELETE", "/api/users/delete-account", {
        token: candToken,
        body: { password: "wrong" },
    });
    check("account delete needs correct password", badDelete.status === 400, badDelete.json);

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("smoke test crashed:", err);
    process.exit(1);
});
