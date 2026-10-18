#!/usr/bin/env bun
/**
 * Seeds the local dev database with the test accounts `./scripts/dev local`
 * prints: one candidate and one recruiter, plus the organization the recruiter
 * needs (interview creation requires an org membership —
 * src/modules/interview/interview.service.ts).
 *
 * Idempotent: a re-run keeps the rows, re-asserts the identity fields the dev
 * script promises (role, email, auth id) and leaves run state alone (onboarding
 * progress, sessions the dev created through the UI).
 *
 * Refuses to touch anything that is not obviously a dev database.
 *
 * Run through `./scripts/dev local`; standalone: `bun run seed:dev`.
 */
import { DEV_ACCOUNTS, DEV_ORG, type DevAccount } from "./dev-accounts";
import {
    addMember,
    createOrganizationRow,
    findMembership,
    findOrganizationRowBySlug,
} from "../src/db/repositories/organizations";
import { createUser, findUserByAuthId, findUserByEmail, setUserOrganization, updateUser } from "../src/db/repositories/users";
import { closeDb } from "../src/db";

/** The version the frontend records for the storage notice (frontend/src/lib/consent.ts). */
const CONSENT_VERSION = "2026-10";

function databaseName(url: string): string {
    try {
        return new URL(url).pathname.replace(/^\//, "");
    } catch {
        return "";
    }
}

function isLocalHost(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "";
    } catch {
        return false;
    }
}

const target = process.env.DATABASE_URL ?? "";
const dbName = databaseName(target);
// Two independent signals, either is enough: a loopback host, or the `_dev`
// database-name suffix the platform convention uses (rehearse_io_dev).
if (!isLocalHost(target) && !dbName.endsWith("_dev")) {
    console.error(
        `refusing to seed ${dbName || target}: not a dev database (host must be loopback or the name must end in _dev).`,
    );
    console.error("Set SEED_ALLOW_ANY_DB=1 to override deliberately.");
    if (process.env.SEED_ALLOW_ANY_DB !== "1") process.exit(1);
}

/** Creates or reconciles one seeded account; returns what changed. */
async function seedAccount(account: DevAccount): Promise<string> {
    const byAuthId = await findUserByAuthId(account.id);
    const existing = byAuthId ?? (await findUserByEmail(account.email));

    if (!existing) {
        const created = await createUser({
            name: account.name,
            email: account.email,
            authId: account.id,
            role: account.role,
            consentGiven: true,
            consentDate: new Date(),
            consentVersion: CONSENT_VERSION,
        });
        if (!created) throw new Error(`could not create user ${account.email}`);
        // Only on creation: a dev is free to walk the onboarding flow afterwards.
        if (account.onboarded) await updateUser(created._id, { onboardingCompleted: true });
        return "created";
    }

    // Identity fields are re-asserted every run so the printed credentials stay
    // true; run state (onboarding, uploaded PII) is not touched.
    const changed =
        existing.authId !== account.id ||
        existing.email !== account.email ||
        existing.role !== account.role ||
        existing.name !== account.name ||
        !existing.consentGiven ||
        existing.isDeleted;
    if (changed) {
        await updateUser(existing._id, {
            authId: account.id,
            email: account.email,
            role: account.role,
            name: account.name,
            consentGiven: true,
            consentDate: existing.consentDate ?? new Date(),
            consentVersion: existing.consentVersion ?? CONSENT_VERSION,
            isDeleted: false,
            deletedAt: null,
        });
    }
    return changed ? "updated" : "kept";
}

async function main(): Promise<void> {
    const notes: string[] = [];
    const ids = new Map<string, string>();

    for (const account of DEV_ACCOUNTS) {
        notes.push(`  ${account.role.padEnd(9)} ${account.email.padEnd(24)} ${await seedAccount(account)}`);
        const row = await findUserByAuthId(account.id);
        if (row) ids.set(account.role, row._id);
    }

    // The recruiter's org: interview creation answers 400 without one and 403
    // without a membership, so both the row and the membership are seeded.
    const recruiterId = ids.get("recruiter");
    if (recruiterId) {
        const existingOrg = await findOrganizationRowBySlug(DEV_ORG.slug);
        const org = existingOrg ?? (await createOrganizationRow({ name: DEV_ORG.name, slug: DEV_ORG.slug, createdBy: recruiterId }));
        if (!org) throw new Error(`could not create organization ${DEV_ORG.slug}`);
        if (!(await findMembership(org.id, recruiterId))) {
            await addMember(org.id, recruiterId, "admin");
            notes.push(`  org       ${DEV_ORG.name} (${DEV_ORG.slug}): recruiter joined as admin`);
        } else {
            notes.push(`  org       ${DEV_ORG.name} (${DEV_ORG.slug}): membership kept`);
        }
        await setUserOrganization(recruiterId, org.id);
    }

    console.log(`seeded ${dbName}:\n${notes.join("\n")}`);
}

try {
    await main();
} finally {
    await closeDb();
}
