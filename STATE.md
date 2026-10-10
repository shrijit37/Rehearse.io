# STATE.md — Rehearse.io honest state

Last verified: 2026-10-09 (live HTTP probes of every endpoint below, GitHub
Actions run history, `gh variable/secret list`, and Cloudflare/Dokploy API
checks). This file is the truth. If any other doc disagrees, this file wins.

## One-line status

**Deployed and live.** The pipeline is green end-to-end on `main`
(test → lint → build → Trivy scan → Dokploy deploy → health gate, run
`37859186667`), the API answers `/health` and `/ready` (`database: up`) in
production, and the frontend is served by Cloudflare Pages at
`https://rehearse.io.shrijit.tech/` with the correct API URL baked in. What
remains is owner-side cleanup: rotate the Groq key, retire the old Netlify
frontend and the legacy compose stack, and recover server SSH access.

## Live endpoints (probed 2026-10-09)

| Endpoint | Result | Meaning |
|---|---|---|
| `https://api.rehearseio.triptribe.info/health` | `200` | Backend alive in prod (Traefik router + LE cert working). |
| `https://api.rehearseio.triptribe.info/ready` | `200` `{"status":"ready","database":"up"}` | Prod container is connected to `rehearse_io_prod` — vault refs resolved, migrations ran. |
| `https://rehearse.io.shrijit.tech/` | `200`, serves the Rehearse.io SPA | **Custom domain active** (Pages domain status `active`, CNAME → `rehearse-io.pages.dev`, DNS-only). |
| `https://rehearse-io.pages.dev/` | `200` | Pages project `rehearse-io` serving the latest frontend build. |
| Live JS bundle | Contains `https://api.rehearseio.triptribe.info` | `VITE_API_URL` was set at build time — no more localhost calls. |
| `https://rehearseio.triptribe.info/` | `200`, `server: Netlify` | **Old frontend still live on Netlify** — stale build, to be retired (owner). |
| `https://rehearse.io` / `www` | GoDaddy parked, for sale | The product's namesake domain is not yours. Real estate is `triptribe.info` + `shrijit.tech`. |

## Infrastructure provisioned (2026-10-09)

| Thing | Value | Verified by |
|---|---|---|
| Dokploy project | `rehearse.io` (`3bYAquVbbcw_wYDoa5VTZ`), env `pkw9Y6NLJzRzQgVpe4944` | `project.all` |
| Dokploy application | `IcMHdaM_nevmNlv8mP4q4`, name `rehearse-api`, type **docker** | `application.one` |
| Domain (API) | `api.rehearseio.triptribe.info` → port 9000, Let's Encrypt, `ch9_26Krv2lgNFbgRLr1Z` | router live + `/health` 200 |
| Container image | `ghcr.io/shrijit37/rehearse.io:<full-sha>` — **lowercase**, **multi-arch** `linux/amd64` + `linux/arm64` | GHCR manifest list + running container |
| Registry credentials | **none stored** — GHCR package is public, Dokploy pulls anonymously | `application.saveDockerProvider` cleared; anonymous `tags/list` 200 |
| Secrets provider | `infisical-prod` on Dokploy → resolves `${{vault.<provider>.<SECRET>}}` env refs | `/ready` shows `database: up` |
| OIDC identity | `github-actions` (`0a112be8-f02a-4fbc-b6f6-8792b40165e6`), subject `repo:shrijit37/Rehearse.io:*` (glob — job has `environment: prod`, which appends `:environment:prod` to the claim) | Infisical OIDC auth in CI run, plus `gh api repos/.../actions/oidc/customization/sub` |
| Prod database | `rehearse_io_prod`, owner/user `rehearse_io` on the shared Postgres, `REVOKE ALL … FROM PUBLIC` | `psql` connect + `datacl` |
| Infisical (prod) | `REHEARSE_DATABASE_URL`, `REHEARSE_DATABASE_URL_EXTERNAL`, `REHEARSE_JWT_SECRET`, `REHEARSE_ENCRYPTION_KEY`, `REHEARSE_AI_SERVICE_API_KEY` | `infisical export` + `/ready` 200 |
| GitHub repo vars | `APP_URL`, `DOKPLOY_APPLICATION_ID`, `DOKPLOY_URL`, `INFISICAL_DOMAIN`, `INFISICAL_IDENTITY_ID`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_SECRET_PREFIX=REHEARSE`, `PAGES_PROJECT`, `VITE_API_URL` | `gh variable list` |
| GitHub repo secrets | `DOKPLOY_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (+ legacy `DEPLOY_*`, `INFISICAL_CLIENT_*`) | `gh secret list` |
| Cloudflare token | `github-actions-rehearse-io-pages` (`e9a37a4d…`), **Pages Write only**, expires 2027-10-09, stored piped (never printed) | `cf tokens` + a real Pages API call with it |
| Pages project | `rehearse-io` → `rehearse-io.pages.dev` | deploy run `37856389973` |
| DNS (Cloudflare zone `shrijit.tech`) | wildcard `*.shrijit.tech` → A `130.210.29.215` DNS-only; `CNAME rehearse.io.shrijit.tech → rehearse-io.pages.dev` DNS-only | `cf dns records list` + `dig` |
| Pages custom domain | `rehearse.io.shrijit.tech`, status `active` | `cf pages domains list` + HTTPS 200 |

The **`cf` CLI** is authenticated locally and is the only sanctioned DNS
tool (see `standards/platform.md`). Destructive `cf` commands need
`--force` non-interactively.

The old `rehease.io` compose (typo in the name) still exists in the same
Dokploy project with an exited `rehearse-backend` container. It is the last
Mongo-based artifact; remove it once the owner confirms the new app (teardown
needs server SSH or the Dokploy UI — see blockers).

## Deploy truth

- **PR #11** (`platform/standardize`) squashed-merged to `main`
  (`02f3587`, 2026-10-08 22:30). `platform/standardize` branch not deleted.
- Final green pipeline: run **`37859186667`** — test ✓ lint ✓ build ✓
  scan ✓ deploy-prod ✓ (health gate passed). Follow-up commits on `main`:
  `3945606`, `9af81e4`, `af675e0`, `3453348`, `ecaca14`.
- What the run history taught (each fix is in `standards/pipeline.md`):
  1. An empty workflow-dispatch-only `deploy.yml` failed every push → deleted.
  2. Lint job needed `npm ci`; `pull_request` trigger added; `packages: read`
     granted; migration failure made non-fatal (warn → redeploy anyway).
  3. GHCR rejects uppercase: image hardcoded to `ghcr.io/shrijit37/rehearse.io`.
  4. Infisical OIDC 403: the job's `environment: prod` claim made the sub
     `repo:…:environment:prod`, not the bound `ref:` → subject widened to the
     glob `repo:shrijit37/Rehearse.io:*`.
  5. Persistent 502, two stacked causes: stale `GITHUB_TOKEN` stored as
     registry creds (cleared — package is public), then the real one:
     **the server node is ARM64** (`oci-arch-a1`) and CI built `amd64`-only
     (`no matching manifest for linux/arm64/v8`) → QEMU +
     `platforms: linux/amd64,linux/arm64`.
  6. Health gate failed at 5s post-redeploy (image pull + boot) →
     `scripts/health` now retries `/health` for 120s at 5s intervals.
- **A "done" deployment status proves nothing.** Diagnose with:
  `GET /api/deployment.readLogs?deploymentId=&tail=`,
  `GET /api/docker.getServiceContainersByAppName?appName=` (task state,
  rejection reasons), `GET /api/docker.getContainers` (Dokploy REST API;
  these are GET with query params and are not exposed as MCP tools).
- `.github/workflows/server-debug.yml` — dispatch-only SSH diagnostics using
  `DEPLOY_*` secrets. First run failed (key rejected by the server); kept for
  a retry once SSH access is recovered.
- `ci.yml` validates on PRs; `deploy-frontend.yml` (Pages) and
  `deploy-backend.yml` (GHCR → Dokploy → health) both run and pass on `main`.
- Branch: `main`.

## Secrets truth

- Prod values live in **Infisical prod** under prefix `REHEARSE_` (5 secrets
  — see the infrastructure table). Dokploy resolves them at deploy time via
  the `infisical-prod` secrets provider; proven by `/ready` returning
  `database: up`.
- CI authenticates to Infisical by OIDC (no stored client credentials in the
  deploy job): `INFISICAL_IDENTITY_ID` = `0a112be8-…` per-repo variable.
- `CLOUDFLARE_API_TOKEN` (GitHub secret) is scoped Pages-Write-only for the
  `shrijit.tech` account; value was piped directly into `gh secret set` and
  never printed. Verify with
  `/accounts/10eb3a39a0105dc9bed75a7d34ac66f7/tokens/verify` (it is a `cfat_`
  token — `/user/tokens/verify` does not apply).
- `REHEARSE_GROQ_API_KEY` deliberately **not created**: the only key
  available was pasted into chat (compromised-once). Rotate in the Groq
  console, then store the replacement in Infisical prod.
- `.env` files are git-ignored; templates only in the repo. No live secrets
  in git.

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
| Signup / login | Implemented, delegated | Shared auth service at `auth.shrijit.tech` (Google + email, cookie on `.shrijit.tech`). Backend: `GET /api/auth/session`, `POST /api/auth/claim`; users carry `auth_id`. Recruiter invite tokens remain JWT (`JWT_SECRET`). |
| RBAC (`recruiter` / `candidate`) | Implemented | `authenticateToken` → `authorize(...)` middleware chain. |
| Candidate onboarding (resume/photo/audio) | Implemented | Files stored as base64 **in Postgres**, optionally encrypted with `ENCRYPTION_KEY`. Requires valid PDF resume. |
| Consent + GDPR (export / delete / consent version) | Implemented | `consentGiven/consentDate/consentVersion`, `POST /api/users/export-data`, `DELETE /api/users/delete-account` (soft delete). |
| Voice rehearsal (behavioral) | Implemented, needs `GROQ_API_KEY` | Resume-tailored questions → record → Whisper STT → LLM score/feedback. |
| DSA practice | implemented, needs `GROQ_API_KEY` | AI-generated problems → code submit → correctness/quality/complexity eval. No code execution sandbox; LLM judges statically. |
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
| Health endpoints | **Verified live in prod** | Backend `GET /health` = liveness (no DB check, by design). **`GET /ready`** = `200` only when Postgres answers, `503` otherwise — currently `200 database:up` in prod. CI and Dokploy gate on `scripts/health`. AI `GET /health` reports STT/TTS availability. Frontend is static (no health endpoint). |
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
  re-running (table count stayed at 7). CI applies them against a real
  Postgres; prod migrations ran during the deploy (non-fatal on failure —
  the deploy redeploys and the health gate re-checks).
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

Done and **verified running** (2026-10-09):

| Item | State |
|---|---|
| `platform.yaml` + `frontend/platform.yaml` | Added |
| `Makefile` + `scripts/{setup,dev,test,lint,build,migrate,health}` | Added, all verified |
| `backend/Dockerfile` | Rewritten: multi-stage, non-root, typechecks in build. Built in CI as a **multi-arch** (amd64+arm64) image — the arm64 manifest is what the ARM server actually runs. |
| `backend/.dockerignore` | Added |
| `.env.example` | Rewritten to the canonical platform shape |
| `deploy-backend.yml` | Runs green on `main`: GHCR SHA → Trivy → Infisical OIDC → Dokploy → 120s health gate |
| `deploy-frontend.yml` | Runs green: Pages `dist/` deploy with localhost guard |
| `ci.yml` | Runs on PRs: migrations against a real Postgres |
| MongoDB removal | Complete |
| PR #11 | Merged (`02f3587`) |

## What still needs the owner

The original infra items are **done** (see tables above). What actually
remains:

1. **Server SSH access is lost.** Both known keys are rejected by
   `130.210.29.215` (the local `Downloads/id_ed25519.txt` pair mismatches its
   `.pub`, and the `DEPLOY_SSH_KEY` GitHub secret is also refused for
   `ubuntu`/`root`/`dokploy`), and no Dokploy UI credentials exist locally
   (default creds invalid). Everything above was therefore done through the
   Dokploy REST API, the `cf` CLI, and CI. To recover: put a fresh public
   key into `authorized_keys` (OCI console / any surviving access) or supply
   Dokploy UI credentials. `.github/workflows/server-debug.yml` is ready to
   re-dispatch once a working key is in `DEPLOY_SSH_KEY`.
2. **Rotate `GROQ_API_KEY`** in the Groq console, then create
   `REHEARSE_GROQ_API_KEY` in Infisical prod and add it to the Dokploy env
   (voice/DSA features return errors until this exists).
3. **Tear down the legacy stack**: compose `rehease.io` (`nzPkuLqdeC91WWtPNyuH8`,
   name typo is real) with its exited `rehearse-backend` container — the last
   Mongo-era artifact. Needs SSH or the Dokploy UI (blocked by 1).
4. **Retire the old Netlify frontend** (`rehearseio.triptribe.info`) — it
   serves a stale build with no `VITE_API_URL`. Point the real hostname at
   Pages or delete the Netlify site after the owner confirms.

No code changes are blocked. Items 1–4 are owner-side access/cleanup.

## What works locally (verified 2026-10-09)

- `make setup`, `make lint`, `make build` all pass.
- `make migrate` applies migrations to a real Postgres 16.15 and is
  idempotent.
- `make test` with `SMOKE_BASE_URL` set: **48 passed, 0 failed**.
- The AI service was **not** run this session (no `GROQ_API_KEY` in env, and
  its deps are not installed locally). It degrades honestly: missing
  `GROQ_API_KEY` disables STT/TTS with 503s and `false` health flags; missing
  `API_KEY` disables backend→AI auth with a warning (dev only).
- Docker is unavailable in this environment; the real image build happens in
  CI (and succeeded — multi-arch, deployed).

## Decisions (all resolved 2026-10-09)

1. Data layer: **migrate Mongo → shared Postgres now** (platform standard).
   Prod data: start empty. **Done** in `5f67c82`.
2. Frontend target: **Cloudflare Pages** (platform standard for static).
   **Done** — `rehearse-io.pages.dev` + `rehearse.io.shrijit.tech`.
3. Sequence: originally "fix live routing first, then standardize".
   **Superseded** once the root cause proved to be a missing Traefik router
   on a stack being replaced anyway: owner chose to **fold routing into a
   single cutover**. **Done** — API router attached and healthy.
4. Prod data: **start empty, ignore old volume** (never inspected).
5. `GROQ_API_KEY`: owner supplied a key, but it is **compromised-once** (it is
   in this chat transcript). Rotate it; store the replacement only in
   Infisical. **Still open — owner action.**
6. PM2/Netlify remnants: remove after cutover. PM2 config and dead deploy
   stub already **deleted**; Netlify site retirement **still open**.
7. IDs: Mongo ObjectIds → **UUIDs**. The frontend consumes only the `_id`
   string key and Mongoose `populate()` shapes, so both are reproduced in the
   Postgres layer. **Done**.
8. Domain pattern (platform standard): `<repo-name>.shrijit.tech` via the
   `cf` CLI and a wildcard DNS record. **Done for Rehearse.io.**
