# Backend agent notes

Backend is **Bun + Express 5 + TypeScript + Mongoose 8**. Entry:
`src/server.ts`. Package manager: `bun` (`bun.lock` is the lockfile).

> A previous version of this file told agents not to use Express/Vite.
> That was wrong — this project **is** Express + Vite. It was rewritten
> 2026-10-09. Honest state: [STATE.md](../STATE.md).

## Commands

```bash
bun install              # install deps
bun --watch src/server.ts  # dev (`npm start` does the same)
bunx tsc --noEmit        # typecheck (what CI runs)
```

Bun auto-loads `.env`, but this project also calls `dotenv.config()`
explicitly — both work. No test suite exists; `e2e-test.ts` is not wired up.

## Stack (do not fight it)

- HTTP: Express 5. Auth: `authenticateToken` → `authorize(...roles)` →
  `requireOnboarded`, in that order.
- DB: MongoDB via Mongoose. Password is `select: false`.
- Validation: zod `*.validation.ts` files.
- AI calls: `src/utils/aiClient.ts` (fetch JSON + FormData to the FastAPI
  service).
- Env: `src/config/env.ts` (zod-validated, fails fast on missing
  `MONGODB_URI`/`JWT_SECRET`).

If you want Bun-native APIs (`Bun.serve`, `Bun.sql`) that is a rewrite
proposal, not a drive-by refactor. The platform direction is shared Postgres,
which is tracked as a decision in STATE.md.
