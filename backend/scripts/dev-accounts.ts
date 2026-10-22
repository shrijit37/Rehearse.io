#!/usr/bin/env bun
/**
 * The local dev test accounts — one per role the app authorizes on.
 *
 * Single source of truth: `dev-auth.ts` mints sessions for these ids, and
 * `seed-dev.ts` creates the matching `users` rows. The session id must equal
 * the row's `auth_id` — the API refuses a session whose id is bound to a
 * different row (src/modules/auth/auth.service.ts).
 *
 * These accounts exist in the local dev database and the local dev auth
 * service only. Never create them on the shared auth service.
 */
export interface DevAccount {
    /** Becomes `users.auth_id`; also the id `dev-auth` returns for the session. */
    id: string;
    email: string;
    name: string;
    role: "candidate" | "recruiter";
    /** Seeded onboarding state, so role-gated features are testable at once. */
    onboarded: boolean;
}

/**
 * The password the seeded accounts are given. It comes from the environment
 * rather than a literal here: the value is a local-only fixture for accounts
 * that exist nowhere else, and `./scripts/dev` is what puts it in the
 * environment (and what prints it). Missing means the stack was not started
 * through that script, so say so instead of minting a second password that the
 * printed credentials would then misdescribe.
 */
function requireDevPassword(): string {
    const password = process.env.DEV_AUTH_PASSWORD;
    if (!password) {
        throw new Error(
            "DEV_AUTH_PASSWORD is not set — start the stack with ./scripts/dev, or export it yourself.",
        );
    }
    return password;
}

export const DEV_PASSWORD = requireDevPassword();

export const DEV_ACCOUNTS: DevAccount[] = [
    { id: "dev-candidate", email: "candidate@shrijit.tech", name: "Test Candidate", role: "candidate", onboarded: true },
    { id: "dev-recruiter", email: "recruiter@shrijit.tech", name: "Test Recruiter", role: "recruiter", onboarded: false },
];

/** The recruiter needs a membership: interview creation requires one. */
export const DEV_ORG = { name: "Dev Org", slug: "dev-org" };
