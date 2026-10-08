# STATE.md — Rehearse.io honest state

Last verified: 2026-10-09 (probes + code read; no prod shell access).
This file is the truth. If any other doc disagrees, this file wins.

## One-line status

Production is **broken**: the live frontend calls `localhost:9000` and the
live API domain returns `404 page not found` on every route including
`/health`. Dokploy reports the compose app as `done`, so the failure is in
routing/config, not in code failing to build.

## Live endpoints (probed 2026-10-09)

| Endpoint | Result | Meaning |
|---|---|---|
| `https://rehearseio.triptribe.info/` | `200`, `server: Netlify`, DNS CNAME `*.netlify.app` | Frontend is served by **Netlify**, not Dokploy/VPS. |
| Live JS bundle `assets/index-DLDTAD3Y.js` | Contains `localhost:9000`, contains **no** `rehearse` API URL | Netlify build had **no `VITE_API_URL` set**, so the live app calls localhost. Login/signup/interviews cannot work in prod. |
| `https://api.rehearseio.triptribe.info/` | `404 page not found` (plain text) | Domain resolves to VPS `130.210.29.215` but no Express app answers. Express 404s look different, so this is the proxy/host, not the backend. |
| `https://api.rehearseio.triptribe.info/health` | `404 page not found` | Same: backend unreachable through this domain. |
| `POST /api/auth/login` on the API domain | `404 page not found` | Same. |

Unknown (needs Dokploy/Traefik inspection or server access): the compose
service's configured domains, container health, and env vars.

## What this project is

Enterprise async interview platform: candidates rehearse (voice + DSA coding)
with AI scoring; recruiters create interviews (behavioral / DSA-only / mixed),
send invite links, and review per-candidate results.

Monorepo, three services plus MongoDB:

```text
backend/    Bun runtime + Express 5 + TypeScript + Mongoose 8, port 9000
frontend/   React 19 + Vite 7 + TypeScript + TailwindCSS 4, nginx :80 in Docker
ai-service/ FastAPI (Python 3.11+), port 8000, Groq-only (STT/TTS/LLM)
mongo       mongo:7.0 (docker-compose only), localhost-bound, volume mongo_data
```

## Feature truth table

| Feature | State | Notes |
|---|---|---|
| Signup / login (JWT, 1d expiry) | Implemented | `POST /api/auth/signup`, `/login`. Placeholder-claim flow for invited emails works in code. |
| RBAC (`recruiter` / `candidate`) | Implemented | `authenticateToken` → `authorize(...)` middleware chain. |
| Candidate onboarding (resume/photo/audio) | Implemented | Files stored as base64 **in MongoDB**, optionally encrypted with `ENCRYPTION_KEY`. Requires valid PDF resume. |
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
| S3 file storage | **Not implemented** | Only a `HeadBucket` connectivity check at boot. Nothing ever uploads to S3; PII lives in Mongo. `AWS_*` vars are optional and inert. |
| Rate limiting | Implemented | General + stricter auth limiter, env-tunable. |
| Input sanitization | Implemented | Strips `$`/operator keys for Mongo injection; name HTML-tag strip. |
| Health endpoints | Shallow | Backend `GET /health` returns `{status:"ok"}` **without checking Mongo**. AI `GET /health` reports STT/TTS availability. Frontend has no health endpoint (static nginx). No `/ready` anywhere. |
| Tests | **None** | Backend has no test script. Frontend has lint+build only. AI has import check only. Root `test` script is an echo. `e2e-test.ts` exists in backend but is not wired to any script. |

## Data layer truth

- MongoDB 7 via Mongoose. Six collections: `users`, `organizations`,
  `interviewsessions`, `candidateinvites`, `rehearsalsessions`, `auditlogs`.
- No migrations framework. Schemas evolve by code deploy.
- PII (resume/photo/audio) is base64 inside user docs, not in object storage.
- No known backups. Prod data existence/value is **unknown** (compose volume
  `mongo_data` on the VPS; never inspected this session).
- Platform standard wants shared Postgres. **No Postgres work has started.**
  This is the biggest migration risk: 6 models + services + invite-token logic.

## Secrets truth

Required in prod: `JWT_SECRET`, `MONGO_USERNAME`/`MONGO_PASSWORD`,
`GROQ_API_KEY`, `AI_SERVICE_API_KEY` (= ai-service `API_KEY`),
`ENCRYPTION_KEY` (recommended), `VITE_API_URL` (build-time), `CLIENT_URL` /
`ALLOWED_ORIGINS`.

- Where prod values live today: **unknown** (probably Dokploy compose env
  and/or `.env` files on the server from the PM2 era). Nothing is in Infisical
  yet; no `REHEARSE_*` entries exist.
- `.env` files are git-ignored; `example.env` / `.env.example` files are
  templates only. No live secrets were found in the repo.

## Deploy truth

- Dokploy project `rehearse.io`, compose `rehease.io` (name typo is real),
  status `done`. Compose file builds all four services with health checks and
  localhost-bound ports. Domains are **not** in the compose file, so they live
  in Dokploy UI config (uninspected).
- Frontend prod is on **Netlify**, not Dokploy, and is misconfigured
  (missing `VITE_API_URL`). The compose `frontend` service (port 3002
  loopback) may be running but is not what the public domain serves.
- `ecosystem.rehearse.config.cjs` is a legacy PM2 config (`/home/ubuntu`
  paths, ports 3025/3024/8000). Unknown whether PM2 still runs on the server.
- `scripts/deploy-on-server.sh` is a deliberate stub that exits 1.
- CI (`.github/workflows/ci.yml`) validates on PRs: backend `tsc --noEmit`,
  frontend lint+build, AI compileall+import, `docker compose config`. It never
  deploys. `deploy.yml` is a stub with no jobs. Deploys happen via Dokploy
  GitHub webhook (if configured).
- Branch: `main`. Standardization branch: `platform/standardize` (created
  2026-10-09, docs-only so far).

## Repo hygiene truth (problems to fix)

- `.pnpm-store/` (2,448 files) is **committed to git**. Pack is ~3.7 MiB.
  Must `git rm -r --cached` and ignore.
- `nohup.out` (a Node crash log) is **committed**. Must delete.
- Three competing root lockfiles (`bun.lock`, `package-lock.json`,
  `pnpm-lock.yaml`) plus per-service locks. Root `package.json` even carries
  `mongoose` deps that belong to the backend.
- `frontend/vercel.json` is dead config (frontend is on Netlify, target is
  Cloudflare Pages per platform standard).
- `backend/CLAUDE.md` contradicts the stack (says don't use Express/Vite;
  the project **is** Express+Vite). Rewritten 2026-10-09; verify before use.
- `backend/README.md` and `frontend/README.md` were tool templates; rewritten
  2026-10-09.
- `AGENTS.md` was stale (wrong entrypoint, wrong commands, false "no route
  guards / no API client / dead deps" claims); rewritten 2026-10-09.
- `ai-service/README.md` had stale TTS model/voice defaults; fixed 2026-10-09.
- Audit score before standardization: **4 pass / 11 fail** (no `platform.yaml`,
  `Makefile`, `scripts/*` contract, root Dockerfile policy undecided for a
  monorepo, possible hardcoded-secret warning to clear).

## What works locally (expected, not re-verified this session)

`npm run dev` (compose DB + three dev servers) should work given MongoDB,
`JWT_SECRET`, and `GROQ_API_KEY`. The AI service degrades honestly: missing
`GROQ_API_KEY` disables STT/TTS with 503s and `false` health flags; missing
`API_KEY` disables backend→AI auth with a warning (dev only).

## Decisions needed (blocking standardization)

1. Data layer: migrate Mongo → shared Postgres (platform standard, large
   rewrite) or keep Mongo (off-standard)?
2. Frontend target: Cloudflare Pages (platform standard for static) or keep
   Netlify/Dokploy?
3. Prod data: migrate existing Mongo volume, or start empty?
4. PM2/Netlify remnants: remove after cutover, or keep?
5. `GROQ_API_KEY` availability for staging/prod AI features.
