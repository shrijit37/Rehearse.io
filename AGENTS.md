# Rehearse.io - Agent Instructions

> Honest repo state lives in [STATE.md](./STATE.md). Read it first.
> Production is live (API `GET /health` returns `checks.database: up`, frontend on
> Cloudflare Pages); verify live URLs before trusting them, and note that
> `GEMINI_API_KEY` and the `LLM_*` text-inference endpoint are not yet in prod.

## Project structure

Monorepo with three services:

```text
├── backend/     # Bun + Express 5 + TypeScript + Drizzle/Postgres, port 9000
├── frontend/    # React 19 + TypeScript + Vite 7 + TailwindCSS 4 (static SPA)
└── ai-service/  # FastAPI (Python 3.11+) — text inference (scenario/DSA), port 8000
```

Database is **shared PostgreSQL** (not in this repo). One DB per env:
`rehearse_io_prod`, `rehearse_io_dev`.

## Developer commands

Everything goes through the root `Makefile` (`make <target>` → `scripts/<target>`).
CI calls the same targets.

```bash
make setup      # install backend (bun) + frontend (npm) + ai-service deps, create .env
make dev        # mode 1 (local): migrate + seed + dev auth + backend + ai-service + web
make dev MODE=prod  # mode 2: web dev server against the deployed API (via a local relay)
make stop       # stop whichever mode is running
make test       # backend typecheck + smoke test (needs running server + DB)
make lint       # frontend eslint
make build      # backend typecheck + frontend build + ai compileall
make migrate    # drizzle-kit migrate against DATABASE_URL
make health     # polls $APP_URL/health until status ok (600s budget)
```

`./scripts/dev` owns both modes (`--fresh`, `--no-ai`, `--stop`, `--help`;
ports via `WEB_PORT`/`API_PORT`/`AI_PORT`/`DEV_AUTH_PORT`/`DEV_RELAY_PORT`;
logs in `.dev/logs/`, state in `.dev/` — both git-ignored). Sign-in is delegated
to the shared auth service, whose `.shrijit.tech` cookie never reaches
`localhost`, so each mode substitutes for it:

- **local** runs `backend/scripts/dev-auth.ts` (a localhost stand-in for
  `auth.shrijit.tech`) and `backend/scripts/seed-dev.ts` creates two test
  accounts — `candidate@shrijit.tech` and `recruiter@shrijit.tech`, both
  `admin123`, candidate pre-onboarded, recruiter in org "Dev Org". They exist
  **only** in the local dev database and dev auth service; never create them on
  the shared auth service. Open the SPA at `http://127.0.0.1:5173` — a
  `localhost` page is a different site from a `127.0.0.1` API, so the session
  cookie cannot flow (the dev auth service refuses it with that explanation).
- **prod** runs `backend/scripts/dev-relay.ts`, which signs in against the real
  auth service, keeps the session server-side in `.dev/prod-session.json`, and
  injects it into proxied API calls. Writes go to production data; Google/GitHub
  sign-in and `/ws/live` do not work through it.

### Backend (`/backend`, Bun)

```bash
bun install
bun src/server.ts            # or `bun run serve`
bun run typecheck
bun run migrate:generate     # after editing src/db/schema.ts
```

### Frontend (`/frontend`, npm + Vite)

```bash
npm ci
npm run dev        # Vite dev server, port 5173
npm run build      # tsc -b && vite build
npm run lint
```

`VITE_API_URL` is baked at build time. If unset the app falls back to
`http://localhost:9000` — this is exactly how production broke.

### AI service (`/ai-service`, Python 3.11+)

```bash
pip install -r requirements.txt
cd app && uvicorn main:app --reload --port 8000
```

`LLM_BASE_URL` + `LLM_MODEL` (any OpenAI-compatible endpoint) for text
inference. `API_KEY` must match backend `AI_SERVICE_API_KEY` (empty disables
auth — dev only).

## Key architecture notes

- **Backend entrypoint**: `backend/src/server.ts` — Express 5, helmet, rate
  limiting, prototype-pollution guard, JSON 10 MB limit.
- **Health**: `GET /health` is the fleet contract — `{status, service, version,
  checks}` with a real Postgres check (503 when the DB is down). There is no
  `/ready` alias; CI and Dokploy gate on `scripts/health`, which polls `/health`.
- **Data layer**: Drizzle ORM. Schema `backend/src/db/schema.ts`, migrations
  `backend/drizzle/`, queries `backend/src/db/repositories/*`. Services never
  query `db` directly.
- **IDs**: UUIDs. Rows reach HTTP with both `id` and `_id`; nested references
  are populated explicitly (no ORM `populate()`). The frontend depends on this.
- **Auth chain**: `authenticateToken` → `authorize(...roles)` →
  `requireOnboarded` (candidate practice routes) → handler. Keep this order.
- **Routes**: `/api/auth` (public, strict rate limit), `/api/users`
  (auth all), `/api/rehearsal` (candidate practice), `/api/org`
  (auth all, recruiter for create/invite), `/api/interviews`
  (recruiter CRUD + candidate invite flow), `/api/live` (spoken session
  tickets; the socket is `wss://<host>/ws/live`).
- **AI integration**: backend `src/utils/aiClient.ts` calls FastAPI at
  `AI_SERVICE_URL` — JSON only (the multipart audio path went with the batch
  interview flow). Shared-secret `Authorization: Bearer`.
- **Invite tokens**: raw token returned once at creation, sha256-hashed at
  rest; lookup hashes again (`findInviteByRawToken`). Never store raw tokens.
- **Frontend entrypoint**: `src/main.tsx` → `App.tsx`, React Router with flat
  routes.
- **Frontend auth**: token + user JSON in `localStorage`; `ProtectedRoute`
  (`role`, `requireOnboarded` props).
- **Frontend API**: shared client in `src/lib/api.ts` (`api.get/post/put/
  patch/delete`), `VITE_API_URL` base with localhost fallback, Bearer
  injection, 401 clears session and redirects to `/signup`.
- **TTS**: `useSpeak` hook — browser `SpeechSynthesis` only (the Groq
  `/api/tts` branch was deleted with the batch audio path). The coach's voice
  in a spoken session comes from the Live socket, never from here.
- **Spoken interview provider**: `gemini-3.8-live` over the Google AI Studio
  Live API (WebSocket) — one socket transcribes the candidate and speaks the
  reply, relayed by the backend (`/ws/live`). Implemented on this branch and
  the only conversation transport (the batch audio path was retired
  2026-10-18). Read [VOICE.md](./VOICE.md) before touching voice code — it
  carries the working setup frame, the measured latency, the 4-concurrent-session
  ceiling, and the traps. Two constraints shaped it: the browser cannot hold the
  API key (ephemeral tokens do not authenticate the socket on their own), and the
  backend is the only service this repo deploys — ai-service is not.

## Conventions

- **Backend**: ES modules, Express 5, zod validation (`*.validation.ts`),
  service layer returns `{ status, message, data }`, controllers translate to
  HTTP.
- **Frontend**: TypeScript strict, `@/` → `src/` alias, ESLint with
  react-hooks + react-refresh plugins.
- **AI service**: FastAPI, pydantic models, OpenAI SDK pointed at an
  env-configured OpenAI-compatible endpoint (`LLM_BASE_URL`/`LLM_MODEL`) for
  text inference. It holds no audio code and no Groq client.
- **No shared config** — each service owns its dependencies and env files.

## Gotchas

- Backend has no unit tests; `tests/smoke.ts` is the end-to-end suite and needs
  a running server plus a migrated database.
- PII (resume/photo/audio) is base64 **in Postgres**, encrypted when
  `ENCRYPTION_KEY` is set. S3 is not wired up at all.
- Resume must be a valid PDF or rehearsal start fails with a 500.
- Sign-in is delegated to the shared auth service (`auth.shrijit.tech`, Better
  Auth). `users` has `auth_id` (unique) and a nullable `password`; there is no
  local login endpoint. Frontend 401s drop the cached user and redirect.
- `JWT_SECRET` now only signs the recruiter interview-invite token (2d), which
  is still the candidate's only credential before they sign in.
- `docker-compose.yml` is **local dev only** (ai-service + backend). It does
  not define Postgres.
- Secrets live in Doppler (`platform`/`prd`, `REHEARSE_*`). `.env.example`
  documents names only.
