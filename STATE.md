# STATE.md — Rehearse.io honest state

Last verified: 2026-10-09 (HTTP/DNS/TLS probes, code read, plus direct
Dokploy/Infisical/Postgres/GitHub API verification of the infra created
this session). This file is the truth. If any other doc disagrees, this file
wins.

## One-line status

**Code is standardized and verified; infrastructure is provisioned but the
first deploy has not run.** The backend is Postgres/Drizzle (48 smoke
assertions passing against a real database), platform files and CI exist,
repo hygiene is clean, and the production infrastructure now exists: the
`rehearse_io_prod` database, the `REHEARSE_*` Infisical secrets, the
Dokploy application `IcMHdaM_nevmNlv8mP4q4`, and the
`api.rehearseio.triptribe.info` **router is now attached** (that was the
root cause of the 404). What is missing is the *first image and first
deploy*: the GHCR image does not exist yet, so the app is still `idle` and
the live host still serves the old Traefik 404 until a deploy happens.
Prod has never worked; this is not a regression.

## Infrastructure provisioned (2026-10-09)

| Thing | Value | Verified by |
|---|---|---|
| Dokploy project | `rehearse.io` (`3bYAquVbbcw_wYDoa5VTZ`), env `pkw9Y6NLJzRzQgVpe4944` | `project.all` |
| Dokploy application | `IcMHdaM_nevmNlv8mP4q4`, name `rehearse-api` | `application.one` |
| Domain (the 404 fix) | `api.rehearseio.triptribe.info` → port 9000, Let's Encrypt, `ch9_26Krv2lgNFbgRLr1Z` | `domain.byApplicationId` |
| Container image | `ghcr.io/shrijit37/Rehearse.io:6ce55c1…`, registry `ghcr.io` | `application.one` |
| Prod database | `rehearse_io_prod`, owner/user `rehearse_io` on the shared Postgres | `psql` connect + `\l` |
| Database isolation | `REVOKE ALL … FROM PUBLIC`; only `rehearse_io` may connect | `datacl` = `rehearse_io=CTc/rehearse_io` |
| Infisical (prod) | `REHEARSE_DATABASE_URL`, `REHEARSE_DATABASE_URL_EXTERNAL`, `REHEARSE_JWT_SECRET`, `REHEARSE_ENCRYPTION_KEY`, `REHEARSE_AI_SERVICE_API_KEY` | `infisical export` |
| GitHub repo vars | `APP_URL`, `DOKPLOY_APPLICATION_ID`, `DOKPLOY_URL`, `INFISICAL_DOMAIN`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_SECRET_PREFIX=REHEARSE`, `PAGES_PROJECT`, `VITE_API_URL` | `gh variable list` |
| GitHub repo secret | `DOKPLOY_API_KEY` (copied from Infisical, auth-checked first) | `project.all` → 200 |

The old `rehease.io` compose (typo in the name) still exists in the same
Dokploy project and still owns the broken router's sibling services. It is
the last Mongo-based artifact and should be removed once the new app serves
traffic.

## Live endpoints (probed 2026-10-09)

| Endpoint | Result | Meaning |
|---|---|---|
| `https://rehearseio.triptribe.info/` | `200`, `server: Netlify`, DNS CNAME `*.netlify.app` | Frontend is served by **Netlify**, not Dokploy/VPS. |
| Live JS bundle `assets/index-DLDTAD3Y.js` | Contains `localhost:9000`, contains **no** `rehearse` API URL | Netlify build had **no `VITE_API_URL` set**, so the live app calls localhost. Signup, login and every authenticated flow cannot work in prod. |
| `https://api.rehearseio.triptribe.info/health` | `404 page not found`, 19 bytes, `text/plain`, no router headers | **Traefik's unmatched-router 404.** No router is bound to this hostname. |
| `http://130.210.29.215/` (bare IP, no Host) | **Identical** 19-byte 404 body | Proves the 404 comes from Traefik itself, not from a routed backend. |
| `POST /api/auth/login` on the API domain | `404 page not found` | Same; even a dead container would give 502, never 404. |
| TLS cert on API host | Valid LE cert, `CN=api.rehearseio.triptribe.info`, issued 2026-09-02 | A router **did** exist and got its cert; it has since been deleted. |
| `https://rehearse.io` / `www` | **GoDaddy parked, for sale.** Redirects to `forsale.godaddy.com` | The product's namesake domain is **not yours**. Real estate is the `triptribe.info` subdomains. |

Because the API 404 is Traefik's, not the app's, the failure is **not**
recoverable from the repo. It cannot be fixed in code or compose; only
Dokploy UI config (Domains tab) can restore a router.

## What this project is

Enterprise async interview platform: candidates rehearse (voice + DSA coding)
with AI scoring; recruiters create interviews (behavioral / DSA-only / mixed),
send invite links, and review per-candidate results.

Monorepo, three services. The database is **shared PostgreSQL** (not in
this repo):

```text
backend/    Bun runtime + Express 5 + TypeScript + Drizzle ORM, port 9000
frontend/   React 19 + Vite 7 + TypeScript + TailwindCSS 4 (static SPA)
ai-service/ FastAPI (Python 3.11+), port 8000, Groq-only (STT/TTS/LLM)
postgres    shared instance, one DB per env (rehearse_io_prod / _dev)
```

## Feature truth table

| Feature | State | Notes |
|---|---|---|
| Signup / login (JWT, 1d expiry) | Implemented | `POST /api/auth/signup`, `/login`. Placeholder-claim flow for invited emails works in code. |
| RBAC (`recruiter` / `candidate`) | Implemented | `authenticateToken` → `authorize(...)` middleware chain. |
| Candidate onboarding (resume/photo/audio) | Implemented | Files stored as base64 **in Postgres**, optionally encrypted with `ENCRYPTION_KEY`. Requires valid PDF resume. |
| Consent + GDPR (export / delete / consent version) | Implemented | `consentGiven/consentDate/consentVersion`, `POST /api/users/export-data`, `DELETE /api/users/delete-account` (soft delete). |
| Voice rehearsal (behavioral) | Implemented, needs `GROQ_API_KEY` | Resume-tailored questions → record → Whisper STT → LLM score/feedback. |
| DSA practice | Implemented, needs `GROQ_API_KEY` | AI-generated problems → code submit → correctness/quality/complexity eval. No code execution sandbox; LLM judges statically. |
| Recruiter interviews (behavioral/dsa/mixed) | Implemented | CRUD + expiry + status draft/active/closed, DSA problem embedding. |
| Candidate invite links | Implemented | `POST /:id/invite` mints token, sha256-hashed at rest; `GET /candidate/accept/:token` is public. |
| Candidate interview flow (voice then coding) | Implemented | `behavioral` → `dsa` → `done` rounds tracked on the invite. |
| Results dashboards (candidate + recruiter) | Implemented | History endpoints + `CandidateResults` / `RecruiterDashboard` pages. |
| Organizations + member invites | Implemented | `Organization` with admin/recruiter members. |
| Audit log | Write-only | `AuditLog` written on signup/login/onboard/interview/org/profile actions. **No API reads it.** No viewer UI. |
| TTS | Dual mode | Browser `SpeechSynthesis` default; Groq Orpheus (`canopylabs/orpheus-v1-english`, voice `tara`) opt-in per call with automatic fallback. Orpheus needs Groq-console terms accepted. |
| S3 file storage | **Not implemented** | The boot-time `HeadBucket` check was **removed** 2026-10-09 (dead code). Nothing uploads to S3; PII lives in Postgres. `AWS_*` vars are optional and inert. |
| Rate limiting | Implemented | General + stricter auth limiter, env-tunable. |
| Input sanitization | Implemented | Strips prototype-pollution keys (`__proto__`, `constructor`, `prototype`); name HTML-tag strip. The old Mongo operator-key stripping was removed with the data layer. |
| Health endpoints | **Fixed 2026-10-09** | Backend `GET /health` = liveness (no DB check, by design). **`GET /ready` added**: `200` only when Postgres answers, `503` otherwise. CI and Dokploy gate on it via `scripts/health`. AI `GET /health` reports STT/TTS availability. Frontend is static (no health endpoint). |
| Tests | **Smoke suite only** | `backend/tests/smoke.ts`: 48 end-to-end assertions against a live server + real Postgres. Wired into `make test` (runs when `SMOKE_BASE_URL` is set) and CI. No unit tests, no coverage. Frontend still has lint+build only. |

## Data layer truth

**Migrated to PostgreSQL on 2026-10-09** (commit `5f67c82`). MongoDB is gone
from the codebase; `grep -ri mongoose backend/src` returns nothing.

- **PostgreSQL via Drizzle ORM** (`drizzle-orm` + `pg`, node-postgres driver).
- Seven tables (was six Mongo collections):
  `users`, `organizations`, `organization_members`, `interview_sessions`,
  `candidate_invites`, `rehearsal_sessions`, `audit_logs`.
- `organization_members` is **new**: the old `members` array was embedded in
  the organization document. Normalized so membership is indexed and
  FK-enforced.
- **IDs are UUIDs**, not ObjectIds. Every row reaches HTTP with both `id` and
  `_id` because the React frontend reads `_id`. Mongoose `populate()` shapes
  are reproduced explicitly in the service layer, so **no frontend change was
  needed**.
- Migrations: real versioned SQL in `backend/drizzle/` via
  `bun run migrate:generate` / `bun run migrate`. Idempotent; verified by
  re-running (table count stayed at 7).
- Invite tokens still sha256-hashed at rest; raw token returned exactly once.
  Verified in tests: stored hash equals `sha256(raw)`.
- PII (resume/photo/audio) is base64 in Postgres, encrypted when
  `ENCRYPTION_KEY` is set. Still not object storage.
- Prod data: **starting empty** by owner decision. The old `mongo_data`
  compose volume on the VPS was never inspected and is being ignored.

### Verified against a real Postgres

Migrations were applied and the API exercised end-to-end on Postgres 16.15
(`backend/tests/smoke.ts`): **48 assertions passing** covering auth, orgs,
interviews, invite-token hashing, placeholder claiming, populated references,
GDPR export, and consent. This suite found two real `_id` bugs that are now
fixed. Run it with `SMOKE_BASE_URL=... make test`.

## Secrets truth

Required in prod: `DATABASE_URL` (new), `JWT_SECRET`, `GROQ_API_KEY`,
`AI_SERVICE_API_KEY` (= ai-service `API_KEY`), `ENCRYPTION_KEY`
(recommended), `VITE_API_URL` (build-time), `CLIENT_URL` / `ALLOWED_ORIGINS`.
`MONGO_USERNAME`/`MONGO_PASSWORD` are **no longer used**.

- Where prod values live today: **unknown** (probably Dokploy compose env
  and/or `.env` files on the server from the PM2 era). Nothing is in Infisical
  yet; no `REHEARSE_*` entries exist. The old Mongo volume may still hold
  credentials but is not part of the new stack.
- `.env` files are git-ignored; `example.env` / `.env.example` /
  `backend/example.env` are templates only. No live secrets in the repo.
- **Security note:** a `GROQ_API_KEY` was pasted into chat on 2026-10-09 and
  is therefore compromised-once. It must be rotated in the Groq console and
  the replacement stored only in Infisical.

## Deploy truth

- Dokploy project `rehearse.io` (`3bYAquVbbcw_wYDoa5VTZ`), env `production`
  (`pkw9Y6NLJzRzQgVpe4944`), compose `rehease.io` (`nzPkuLqdeC91WWtPNyuH8`,
  name typo is real), appName `rehearseio-reheaseio-otwu83`, status `done`.
  Compose file builds all four services with health checks and
  localhost-bound ports. Domains are **not** in the compose file, so they
  live in Dokploy UI config (uninspected — owner pasting values 2026-10-09).
  Because the API hostname returns Traefik's own 404, the compose Domains
  tab currently has **no router** for `api.rehearseio.triptribe.info`.
- Frontend prod is on **Netlify**, not Dokploy, and is misconfigured
  (missing `VITE_API_URL`). The old compose `frontend` service is gone from
  `docker-compose.yml`; Pages is the target now.
- `ecosystem.rehearse.config.cjs` (legacy PM2) and
  `scripts/deploy-on-server.sh` have been **deleted**.
- CI: `ci.yml` validates on PRs (backend typecheck + migrations against a real
  Postgres, frontend lint+build, AI compileall+import, compose config).
  `deploy-backend.yml` and `deploy-frontend.yml` implement the real pipelines
  but have **never run** — they need the GitHub vars listed below.
- Branch: `main`. Standardization branch: `platform/standardize`
  (4 commits ahead of main; not yet merged or pushed).

## Repo hygiene truth (fixed 2026-10-09)

All of the following are **resolved** in commit `e26cf31`:

- `.pnpm-store/` (2,448 committed files) untracked, deleted, and ignored.
- `nohup.out` (Node crash log) deleted and ignored.
- Competing root lockfiles removed. Root `package.json` no longer carries
  stray `mongoose` deps; per-service locks are authoritative
  (`backend/bun.lock`, `frontend/package-lock.json`, `ai-service/uv.lock`).
- `frontend/vercel.json` deleted (dead config).
- `ecosystem.rehearse.config.cjs` (legacy PM2, `/home/ubuntu` paths) deleted.
- `scripts/deploy-on-server.sh` (deliberate exit-1 stub) deleted.
- `backend/CLAUDE.md` rewritten; it previously contradicted the stack.
- All `.md` files rewritten for the Postgres stack and the scripts contract.
- Tracked files: **2,595 → 149**.

## Platform standardization status

Done (2026-10-09):

| Item | State |
|---|---|
| `platform.yaml` + `frontend/platform.yaml` | Added |
| `Makefile` + `scripts/{setup,dev,test,lint,build,migrate,health}` | Added, all verified |
| `backend/Dockerfile` | Rewritten: multi-stage, non-root, typechecks in build |
| `backend/.dockerignore` | Added |
| `.env.example` | Rewritten to the canonical platform shape |
| `deploy-backend.yml` | Added (GHCR SHA → Trivy → Infisical OIDC → Dokploy → health gate) |
| `deploy-frontend.yml` | Added (Pages, `dist/`, localhost guard) |
| `ci.yml` | Updated: runs migrations against a real Postgres |
| MongoDB removal | Complete |

**Not verified:** the backend Docker image was never built — Docker is
unavailable in this environment. CI is the first real build.

## What still needs the owner

Items 1–4 of the original list (Dokploy app + domain, prod DB/user, Infisical
secrets, GitHub vars) are **done** — see the table above. What actually blocks
the first deploy:

1. **Infisical machine identity for Dokploy.** The app's env uses
   `${{vault.infisical-prod.…}}` references, which resolve only through a
   Dokploy *secrets provider*. **No provider exists** (`vaultProvider.all` →
   0), and creating one needs an Infisical machine identity that can read the
   `platform` project. The 26 identities in
   `~/.local/state/infisical-deploy/identities.json` were each checked: every
   one authenticates, but **none can see `platform-y58-d`**. So
   `JWT_SECRET`, `ENCRYPTION_KEY`, `AI_SERVICE_API_KEY` and `DATABASE_URL`
   will inject as unresolved references until an identity is granted access
   to `platform` and a provider is created.
   Until then the container will fail `env.ts` validation and exit.
2. **Merge `platform/standardize` into `main`.** `deploy-backend.yml` only
   fires on pushes to `main`, so the GHCR image
   (`ghcr.io/shrijit37/Rehearse.io:<full-sha>`) **does not exist yet**
   (confirmed 404 from GHCR). First merge → first build → first deploy.
3. **`REHEARSE_GROQ_API_KEY`.** Not created, on purpose: the only key
   available was pasted into this chat and is compromised-once. Rotate in
   Groq, then store the replacement in Infisical prod.
4. **Cloudflare Pages project + credentials.** `PAGES_PROJECT` is set to
   `rehearse-io` as a name, but **no Cloudflare project exists** and
   `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are **not set** (I have
   no Cloudflare credentials). The frontend deploy is blocked until you
   create the project and add an API token with Pages edit permission.
5. **Rotate `GROQ_API_KEY`** (same as 3).
6. **Superseded env vars.** `deploy-backend.yml` header still documents
   `vars.DOKPLOY_API_KEY`; the job body correctly reads
   `secrets.DOKPLOY_API_KEY`. Cosmetic, but worth fixing in the next commit.
7. **`INFISICAL_IDENTITY_ID` is still unset** (needed by the CI migration
   step). Same blocker as 1: it is the shared `github-actions` OIDC identity,
   which does not exist yet.

## What works locally (verified 2026-10-09)

- `make setup`, `make lint`, `make build` all pass.
- `make migrate` applies migrations to a real Postgres 16.15 and is
  idempotent.
- `make test` with `SMOKE_BASE_URL` set: **48 passed, 0 failed**.
- The AI service was **not** run this session (no `GROQ_API_KEY` in env, and
  its deps are not installed locally). It degrades honestly: missing
  `GROQ_API_KEY` disables STT/TTS with 503s and `false` health flags; missing
  `API_KEY` disables backend→AI auth with a warning (dev only).
- `docker compose config` validates, but **no container was built or run** —
  Docker is unavailable in this environment.

## Decisions (all resolved 2026-10-09)

1. Data layer: **migrate Mongo → shared Postgres now** (platform standard).
   Prod data: start empty. **Done** in `5f67c82`.
2. Frontend target: **Cloudflare Pages** (platform standard for static).
   Pipeline written; needs CF credentials to run.
3. Sequence: originally "fix live routing first, then standardize".
   **Superseded** once the root cause proved to be a missing Traefik router
   on a stack being replaced anyway: owner chose to **fold routing into a
   single cutover**. Prod was already fully non-functional, so there was no
   working site to preserve.
4. Prod data: **start empty, ignore old volume** (never inspected).
5. `GROQ_API_KEY`: owner supplied a key, but it is **compromised-once** (it is
   in this chat transcript). Rotate it; store the replacement only in
   Infisical.
6. PM2/Netlify remnants: remove after cutover. PM2 config and dead deploy
   stub already **deleted**.
7. IDs: Mongo ObjectIds → **UUIDs**. The frontend consumes only the `_id`
   string key and Mongoose `populate()` shapes, so both are reproduced in
   the Postgres layer. **Done**.

No decisions are currently blocking the code work. The remaining blockers are
all owner-side infrastructure actions, listed under **What still needs the
owner** above.
