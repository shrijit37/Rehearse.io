# Rehearse.io - Agent Instructions

> Honest repo state lives in [STATE.md](./STATE.md). Read it first.
> Production is broken; do not assume the live URLs work.

## Project structure

Monorepo with three services:

```text
├── backend/     # Bun + Express 5 + TypeScript + Drizzle/Postgres, port 9000
├── frontend/    # React 19 + TypeScript + Vite 7 + TailwindCSS 4 (static SPA)
└── ai-service/  # FastAPI (Python 3.11+) — AI evaluation + STT + TTS, port 8000
```

Database is **shared PostgreSQL** (not in this repo). One DB per env:
`rehearse_io_prod`, `rehearse_io_dev`.

## Developer commands

Everything goes through the root `Makefile` (`make <target>` → `scripts/<target>`).
CI calls the same targets.

```bash
make setup      # install backend (bun) + frontend (npm) + ai-service deps, create .env
make dev        # migrate + run all three dev servers
make test       # backend typecheck + smoke test (needs running server + DB)
make lint       # frontend eslint
make build      # backend typecheck + frontend build + ai compileall
make migrate    # drizzle-kit migrate against DATABASE_URL
make health     # hits $APP_URL/health then /ready
```

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

`GROQ_API_KEY` required for STT/TTS/LLM. `API_KEY` must match backend
`AI_SERVICE_API_KEY` (empty disables auth — dev only).

## Key architecture notes

- **Backend entrypoint**: `backend/src/server.ts` — Express 5, helmet, rate
  limiting, prototype-pollution guard, JSON 10 MB limit.
- **Health**: `GET /health` = liveness (no DB check). `GET /ready` = Postgres
  reachable (503 otherwise). CI and Dokploy gate on `/ready`.
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
  (recruiter CRUD + candidate invite flow), `/api/tts` (auth, Groq proxy).
- **AI integration**: backend `src/utils/aiClient.ts` calls FastAPI at
  `AI_SERVICE_URL` — JSON for generation/evaluation, multipart for audio.
  Shared-secret `Authorization: Bearer`.
- **Invite tokens**: raw token returned once at creation, sha256-hashed at
  rest; lookup hashes again (`findInviteByRawToken`). Never store raw tokens.
- **Frontend entrypoint**: `src/main.tsx` → `App.tsx`, React Router with flat
  routes.
- **Frontend auth**: token + user JSON in `localStorage`; `ProtectedRoute`
  (`role`, `requireOnboarded` props).
- **Frontend API**: shared client in `src/lib/api.ts` (`api.get/post/put/
  patch/delete`), `VITE_API_URL` base with localhost fallback, Bearer
  injection, 401 clears session and redirects to `/signup`.
- **TTS**: `useSpeak` hook — browser SpeechSynthesis by default, Groq Orpheus
  via `/api/tts` when `useGroqTts` is passed, automatic fallback.

## Conventions

- **Backend**: ES modules, Express 5, zod validation (`*.validation.ts`),
  service layer returns `{ status, message, data }`, controllers translate to
  HTTP.
- **Frontend**: TypeScript strict, `@/` → `src/` alias, ESLint with
  react-hooks + react-refresh plugins.
- **AI service**: FastAPI, pydantic models, LiteLLM for LLM calls, Groq
  OpenAI-compatible client for Whisper STT and Orpheus TTS.
- **No shared config** — each service owns its dependencies and env files.

## Gotchas

- Backend has no unit tests; `tests/smoke.ts` is the end-to-end suite and needs
  a running server plus a migrated database.
- PII (resume/photo/audio) is base64 **in Postgres**, encrypted when
  `ENCRYPTION_KEY` is set. S3 is not wired up at all.
- Resume must be a valid PDF or rehearsal start fails with a 500.
- JWTs expire in 1 day; frontend 401s wipe the session and redirect.
- `bcrypt` (native) and `bcryptjs` are both deps; code uses `bcryptjs`.
- `docker-compose.yml` is **local dev only** (ai-service + backend). It does
  not define Postgres.
- Secrets live in Infisical (`REHEARSE_*`). `.env.example` documents names
  only.
