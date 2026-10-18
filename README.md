# Rehearse.io

Enterprise async interview platform with AI evaluation for **behavioral**
(voice) and **DSA coding** rounds.

Monorepo with three services:

- **backend**: Bun + Express 5 + TypeScript + **Drizzle/PostgreSQL**, JWT auth, port 9000
- **frontend**: React 19 + TypeScript + Vite 7 + TailwindCSS 4 (static SPA, Cloudflare Pages)
- **ai-service**: FastAPI (Python) — scenario generation, STT, TTS, DSA
  problem generation and code evaluation, port 8000

> Honest status lives in [STATE.md](./STATE.md). **Production is live**: the
> API answers `GET /health` (with `checks.database`) at `api.rehearseio.triptribe.info`,
> and the frontend is served by Cloudflare Pages at
> `https://rehearse.io.shrijit.tech/`. Read STATE.md before trusting any
> other doc. (Also: `rehearse.io` itself is a parked GoDaddy domain for
> sale, not this project's.)

## Features

- **Candidate practice**: voice rehearsal + DSA coding practice with AI scoring
- **Recruiter interviews**: behavioral, DSA-only, or mixed (voice then coding)
- **Invite links**: shareable candidate links with multi-round progress
- **AI evaluation**: spoken answers transcribed and scored live over a Gemini
  socket; correctness / quality / complexity for code (static LLM review, no
  sandbox)
- **Results dashboards**: per-candidate behavioral and DSA breakdowns
- **Organizations**: multi-recruiter orgs with member invites
- **Consent + GDPR**: consent versioning, data export, soft-delete account
- **Audit log**: security events recorded (write-only, no viewer yet)

Spoken sessions need `GEMINI_API_KEY` (Live API); text inference (scenario
generation, DSA) needs `LLM_BASE_URL` + `LLM_MODEL` pointing at any
OpenAI-compatible endpoint. Missing config returns honest 503s and `false`
health flags.

## Getting started (local dev)

Prerequisites: Bun, Node 22+, Python 3.11+, and a reachable PostgreSQL.
`make dev` uses `postgresql://postgres@localhost:5432/rehearse_io_dev`
(the shared laptop instance by convention; the dev script starts the repo's own
cluster at `~/.local/share/rehearse-pg` when it is down, and creates the
database if it is missing).

```bash
make setup                 # install all three services + create .env files
make dev                   # the whole stack on this machine
```

`./scripts/dev local` applies migrations, seeds the test accounts, then runs dev
auth :4000, ai-service :8000, API :9000 and web :5173. It prints both test
credentials when ready:

```text
candidate@shrijit.tech / admin123   candidate, onboarding already done
recruiter@shrijit.tech / admin123   recruiter, org "Dev Org"
```

Sign in at <http://127.0.0.1:5173/signup> → "Sign in". These two accounts exist
only in the local database and the local dev auth service — the shared auth
service has no such users, and they must never be created there.

Why a dev auth service exists at all: sign-in is delegated to
`auth.shrijit.tech`, whose session cookie is scoped to `.shrijit.tech` and is
never sent to `localhost`. The local stack replaces that service on localhost.
Details: `backend/scripts/dev-auth.ts`.

Other flags: `--fresh` (drop and re-seed the dev database), `--no-ai`, `--stop`,
`--help`. Ports are overridable (`WEB_PORT`, `API_PORT`, `AI_PORT`,
`DEV_AUTH_PORT`). Logs land in `.dev/logs/<service>.log`, and the terminal shows
them prefixed per service.

Health: backend `GET /health` (the fleet contract; Postgres is the critical
check, `503` when down — there is no `/ready` route);
AI `GET /health` (reports `llm_available`).

## Make targets

`make setup | dev | stop | test | lint | build | migrate | health` — each maps
1:1 to a script in `scripts/`. CI calls these too, never framework commands
directly. `make dev` takes `MODE=local` (the default).

## Tests

```bash
make dev &   # or ./scripts/dev local; smoke needs a live API + Postgres
cd backend && SMOKE_BASE_URL=http://127.0.0.1:9000 \
  AUTH_URL=http://127.0.0.1:4000 \
  SMOKE_EMAIL=candidate@shrijit.tech SMOKE_PASSWORD=admin123 \
  SMOKE_RECRUITER_EMAIL=recruiter@shrijit.tech SMOKE_RECRUITER_PASSWORD=admin123 \
  bun tests/smoke.ts
```

Those are the seeded dev credentials (see *Getting started*), so the suite runs
with no vault access. Against a deployed API, CI supplies real smoke accounts
from Doppler instead (`REHEARSE_SMOKE_EMAIL` / `REHEARSE_SMOKE_PASSWORD`).

`backend/tests/smoke.ts` covers auth, session resolution, role gating and the
org/interview surfaces against a live server and a real Postgres.

## Deployment
Deploy procedure (branches, workflows, secrets, gate failures) is in
[DEPLOY.md](./DEPLOY.md). Live status is in [STATE.md](./STATE.md).

- **backend** → GHCR (`:<sha>`) → Dokploy **compose app** (`rehearse-api`), port 9000, health `/health`
- **frontend** → static `dist/` → Cloudflare Pages
- **ai-service** → Dokploy, port 8000
- **secrets** → Doppler `platform` / `prd` (one flat namespace, `REHEARSE_` prefix), never in git
- **database** → shared Postgres, `rehearse_io_prod` / `rehearse_io_dev`

See `platform.yaml`, `frontend/platform.yaml`, and
[STATE.md](./STATE.md#deploy-truth) for current status.

## Docs

- [STATE.md](./STATE.md) — honest current state (read first)
- [DEPLOY.md](./DEPLOY.md) — how this repo deploys (read before deploying)
- [AGENTS.md](./AGENTS.md) — agent/dev instructions per service
- [PRODUCT.md](./PRODUCT.md) — product purpose and design principles
- [backend/README.md](./backend/README.md) — API reference
- [frontend/README.md](./frontend/README.md) — frontend guide
- [ai-service/README.md](./ai-service/README.md) — AI service reference
