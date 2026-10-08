# Backend agent notes

Backend is **Bun + Express 5 + TypeScript + Drizzle ORM (PostgreSQL)**.
Entry: `src/server.ts`. Package manager: `bun` (`bun.lock` is the lockfile).

> Honest state: [STATE.md](../STATE.md). The earlier version of this file
> told agents not to use Express/Vite, which was wrong.

## Commands

```bash
bun install                # install deps
bun src/server.ts          # run (port 9000)
bun --watch src/server.ts  # dev with reload
bun run typecheck          # tsc --noEmit
bun run migrate            # drizzle-kit migrate against DATABASE_URL
bun run test:smoke         # end-to-end test (needs a running server + DB)
```

## Stack (do not fight it)

- HTTP: Express 5. Auth: `authenticateToken` → `authorize(...roles)` →
  `requireOnboarded`, in that order.
- DB: **PostgreSQL via Drizzle**. Schema: `src/db/schema.ts`. Queries live in
  `src/db/repositories/*`, not in services.
- IDs: **UUIDs**. Every row reaches HTTP with both `id` and `_id` (use
  `withId()` from `src/db/shape.ts`). The React frontend reads `_id`.
- Validation: zod `*.validation.ts` files.
- AI calls: `src/utils/aiClient.ts` (fetch JSON + FormData to the FastAPI
  service).
- Env: `src/config/env.ts` (zod-validated, exits on missing
  `DATABASE_URL`/`JWT_SECRET`).

## Rules that matter

- **Do not query `db` directly from a service or controller.** Add or extend a
  function in `src/db/repositories/`.
- **Do not return a raw DB row to a controller.** Wrap it so `_id` is present;
  the frontend breaks without it.
- Nested references are populated explicitly (there is no ORM `populate()`).
  Follow the existing `findOrganizations()` / `findUsersByIds()` batching
  helpers in `modules/interview/interview.service.ts`.
- Schema changes need a generated migration: `bun run migrate:generate`,
  then commit `drizzle/`.
- Invite tokens: hash on write, hash on lookup, never store or log the raw
  token.
