# STATE.md — Rehearse.io honest state

Last verified: 2026-10-09 (HTTP/DNS/TLS probes + code read; no prod shell
access). This file is the truth. If any other doc disagrees, this file wins.

## One-line status

Production is **broken and always was**: the live frontend bundle calls
`localhost:9000`, and `api.rehearseio.triptribe.info` has **no Traefik
router at all**, so every path 404s including `/health`. Prod has never
worked; this is not a regression. No router means not a container
problem, so Dokploy's `done` status is consistent, not contradictory.

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

- Dokploy project `rehearse.io` (`3bYAquVbbcw_wYDoa5VTZ`), env `production`
  (`pkw9Y6NLJzRzQgVpe4944`), compose `rehease.io` (`nzPkuLqdeC91WWtPNyuH8`,
  name typo is real), appName `rehearseio-reheaseio-otwu83`, status `done`.
  Compose file builds all four services with health checks and
  localhost-bound ports. Domains are **not** in the compose file, so they
  live in Dokploy UI config (uninspected — owner pasting values 2026-10-09).
  Because the API hostname returns Traefik's own 404, the compose Domains
  tab currently has **no router** for `api.rehearseio.triptribe.info`.
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

Decided 2026-10-09 by owner:

1. Data layer: **migrate Mongo → shared Postgres now** (platform standard).
   6 models + services + invite-token logic. Prod data: start empty.
2. Frontend target: **Cloudflare Pages** (platform standard for static).
3. Sequence: originally "fix live routing first, then standardize".
   **Superseded 2026-10-09** once the root cause proved to be a missing
   Traefik router on a stack that gets replaced anyway: owner chose to
   **fold routing into a single cutover** (build → deploy once → attach
   domain). Prod is already fully non-functional, so there is no working
   site to preserve.
4. Prod data: **start empty, ignore old volume** (never inspected).
5. `GROQ_API_KEY` for prod: owner supplied a key this session. It is
   **compromised-once** (appeared in chat logs) and must be rotated in the
   Groq console. Never commit it; it belongs in Infisical.
6. PM2/Netlify remnants: remove after cutover (implied by 2+3).
7. IDs: switch Mongo ObjectIds → **UUIDs**. Frontend only consumes the
   `_id` string key and Mongoose `populate()` shapes, so both are
   reproduced in the Postgres layer rather than breaking the UI.
