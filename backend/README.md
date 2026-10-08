# backend

Bun runtime + Express 5 + TypeScript API for Rehearse.io. MongoDB via
Mongoose 8, JWT auth, RBAC, rate limiting, helmet.

> Honest repo state: [STATE.md](../STATE.md). Production API domain
> currently 404s on every route.

## Install and run

```bash
bun install                  # bun.lock is the lockfile
cp example.env .env          # then set JWT_SECRET (required) + MONGODB_URI
bun --watch src/server.ts    # dev with reload, port 9000 (also `npm start`)
```

Typecheck (what CI runs): `bunx tsc --noEmit`.
Production: `bun src/server.ts` (see `Dockerfile`).

## Environment

Required: `MONGODB_URI` (or legacy `MONGO_URI`), `JWT_SECRET` (no default,
fails fast). Defaults: `PORT=9000`, `AI_SERVICE_URL=http://localhost:8000`.

Optional: `AI_SERVICE_API_KEY` (must match ai-service `API_KEY`),
`ENCRYPTION_KEY` (PII encryption, `openssl rand -hex 32`), `CLIENT_URL` /
`ALLOWED_ORIGINS` (CORS), `AUTH_RATE_MAX` / `RATE_MAX` + window tunables,
`MAX_AUDIO_SIZE_MB` (keep in sync with ai-service). `AWS_*` vars only feed a
boot-time bucket check; S3 is never used for storage.

## API map

```text
GET  /health                                  shallow, no DB check

POST /api/auth/signup   POST /api/auth/login  public, strict rate limit

/api/users            (all require auth)
  GET /               PATCH /profile          profile
  POST /onboard                               resume/photo/audio upload
  GET /consent        POST /consent            consent state
  POST /export-data                           GDPR export
  DELETE /delete-account                      soft delete

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

## Data models (Mongoose)

`User` (auth, PII base64, consent, onboarding, soft delete),
`Organization` (members admin/recruiter), `InterviewSession` (behavioral /
dsa / mixed, embedded DSA problems), `CandidateInvite` (hashed token,
behavioral → dsa → done rounds, results), `RehearsalSession` (practice
history), `AuditLog` (write-only security events).

No migrations framework; schemas evolve by deploy. Invite tokens are
sha256-hashed at rest; look up via `findByRawToken`.

## Gotchas

- No test suite. `e2e-test.ts` exists but no script runs it.
- Password is `select: false`; login uses `.select("+password")`.
- Resume must be a valid PDF or `/rehearsal/start` returns 500.
- Both `bcrypt` and `bcryptjs` are installed; code uses `bcryptjs`.
- Startup requires Mongo; S3 failure only logs a warning.
