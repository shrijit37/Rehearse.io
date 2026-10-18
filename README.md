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

Prerequisites: Bun, Node 22+, Python 3.11+, and a reachable PostgreSQL
(the shared laptop instance is the convention: `createdb rehearse_io_dev`).

```bash
make setup                       # install all three services + create .env files
export DATABASE_URL=postgresql://postgres@localhost:5432/rehearse_io_dev
export JWT_SECRET=$(openssl rand -hex 32)
make migrate                     # create/update tables
make dev                         # backend :9000, frontend :5173, ai :8000
```

Service URLs: backend `http://localhost:9000`, frontend
`http://localhost:5173`, AI `http://localhost:8000`.

Health: backend `GET /health` (the fleet contract; Postgres is the critical
check, `503` when down — there is no `/ready` route);
AI `GET /health` (reports STT/TTS availability).

## Make targets

`make setup | dev | test | lint | build | migrate | health` — each maps 1:1 to
a script in `scripts/`. CI calls these too, never framework commands directly.

## Tests

```bash
make migrate
(cd backend && bun src/server.ts) &
SMOKE_BASE_URL=http://127.0.0.1:9000 make test
```

`backend/tests/smoke.ts` covers auth, orgs, interviews, invite-token hashing,
placeholder claiming, GDPR export, and consent against a real Postgres.

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
