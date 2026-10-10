# backend

Bun runtime + Express 5 + TypeScript API for Rehearse.io. **PostgreSQL via
Drizzle ORM**, shared-auth session verification, RBAC, rate limiting, helmet.

> Honest repo state: [STATE.md](../STATE.md). Production is live: the API
> domain serves `/health` and `/ready` (`database: up`) and the frontend is
> on Cloudflare Pages.

## Install and run

```bash
bun install                  # bun.lock is the lockfile
bun src/server.ts            # dev, port 9000
bun run typecheck            # tsc --noEmit (what CI runs)
bun run migrate              # apply migrations to DATABASE_URL
```

Local dev expects a Postgres you already have (the shared laptop instance):

```bash
createdb rehearse_io_dev
export DATABASE_URL=postgresql://postgres@localhost:5432/rehearse_io_dev
bun run migrate && bun src/server.ts
```

Production runs the same entrypoint from `Dockerfile` (multi-stage, non-root).

## Environment

Required (zod-validated, exits non-zero when missing):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs session JWTs |

Optional: `AUTH_URL` (default `https://auth.shrijit.tech`, where sessions are
verified), `ALLOWED_ORIGINS` (comma-separated CORS allow-list), `DATABASE_URL_EXTERNAL` (CI migrations), `DATABASE_POOL_MAX`
(default 10), `PORT=9000`, `APP_ENV`, `APP_URL`, `LOG_LEVEL`,
`AI_SERVICE_URL` (default `http://localhost:8000`), `AI_SERVICE_API_KEY`
(must match ai-service `API_KEY`), `ENCRYPTION_KEY` (PII encryption,
`openssl rand -hex 32`), `CLIENT_URL` / `ALLOWED_ORIGINS` (CORS),
`AUTH_RATE_MAX` / `RATE_MAX` + window tunables, `MAX_AUDIO_SIZE_MB`.

Secrets live in Infisical, never in the repo. See `../.env.example`.

## Health

| Endpoint | Meaning |
|---|---|
| `GET /health` | Liveness. Process is up; deliberately does **not** touch the database. |
| `GET /ready` | Readiness. `503` unless Postgres answers `SELECT 1`. CI and Dokploy gate on this. |

## API map

```text
GET  /health    GET /ready                     liveness + readiness

POST /api/auth/signup   POST /api/auth/login  public, strict rate limit

/api/users            (all require auth)
  GET /               PATCH /profile          profile
  POST /onboard                               resume/photo/audio upload
  GET /consent        POST /consent            consent state
  POST /export-data                           GDPR export
  DELETE /delete-account                      anonymize + purge dependents

/api/rehearsal        (candidate practice)
  GET /start?targetRole=     POST /evaluate (audio)   behavioral
  POST /session              GET /history             save + history
  POST /dsa/start            POST /dsa/evaluate       DSA practice

/api/org              (all require auth)
  POST /              GET /                 create + list mine
  GET /:id            PUT /:id              read + update
  POST /:id/invite                          recruiter only

/api/interviews
  recruiter: POST /  GET /  GET /:id  PUT /:id  POST /:id/invite
             POST /generate-dsa
  candidate: GET /candidate/my-interviews
             POST /candidate/evaluate (audio)  POST /candidate/submit
             POST /candidate/evaluate-dsa
  public:    GET /candidate/accept/:token     invite link

POST /api/tts          auth, multipart (text, voice) → Groq audio proxy
```

Auth chain: `authenticateToken` → `authorize(...roles)` →
`requireOnboarded` (practice routes) → handler.

## Data layer

Postgres via Drizzle. Schema in `src/db/schema.ts`, migrations in `drizzle/`
(generated with `bun run migrate:generate`).

| Table | Notes |
|---|---|
| `users` | Auth, PII base64 (encrypted when `ENCRYPTION_KEY` set), consent, onboarding, soft delete |
| `organizations` | Name + unique slug |
| `organization_members` | Membership (admin/recruiter). Was an embedded array; normalized so it is indexed and FK-enforced |
| `interview_sessions` | behavioral/dsa/mixed, questions array, DSA problems as JSONB |
| `candidate_invites` | sha256-hashed token, behavioral → dsa → done rounds, results as JSONB |
| `rehearsal_sessions` | Practice history |
| `audit_logs` | Write-only security events, IP stored as sha256 |

Repositories in `src/db/repositories/*`; queries live there, not in services.

**IDs are UUIDs**, exposed to HTTP as both `id` and `_id`. Nested references
are populated explicitly in the service layer (the frontend depends on those
shapes). `src/db/shape.ts` holds `withId()`.

## Tests

`tests/smoke.ts` runs a real end-to-end pass (auth, orgs, interviews, invite
token hashing, placeholder claiming, GDPR, consent) against a running server
and a migrated database:

```bash
DATABASE_URL=... bun run migrate
bun src/server.ts &
SMOKE_BASE_URL=http://127.0.0.1:9000 bun run test:smoke
```

## Gotchas

- Resume must be a valid PDF or `/rehearsal/start` returns 500.
- Invite tokens are sha256-hashed at rest; the raw token is returned exactly
  once at creation. `findInviteByRawToken()` does the hashing on lookup.
- Both `bcrypt` and `bcryptjs` are installed; code uses `bcryptjs`.
- The request sanitizer strips prototype-pollution keys only. The old Mongo
  operator-key stripping is gone because there is no document query layer.
- PII (resume/photo/audio) is base64 in Postgres, not object storage. S3 is
  not wired up at all.
