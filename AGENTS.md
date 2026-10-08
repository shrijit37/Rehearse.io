# Rehearse.io - Agent Instructions

> Honest repo state lives in [STATE.md](./STATE.md). Read it first.
> Production is currently broken; do not assume the live URLs work.

## Project structure

Monorepo with three services plus MongoDB (compose only):

```text
├── backend/     # Bun + Express 5 + TypeScript + Mongoose 8, port 9000
├── frontend/    # React 19 + TypeScript + Vite 7 + TailwindCSS 4 (static SPA)
├── ai-service/  # FastAPI (Python 3.11+) — AI evaluation + STT + TTS
└── mongo        # mongo:7.0 service in docker-compose.yml (local/prod data)
```

## Developer commands

### Root

```bash
npm run setup      # install backend + frontend + ai-service deps
npm run setup:env  # copy backend/example.env -> backend/.env
npm run dev:db     # docker compose up -d  (starts mongo; also builds app images — prefer `docker compose up -d mongo`)
npm run dev        # db + backend + frontend + ai-service together
npm run lint:frontend   # eslint
npm run build:frontend  # tsc -b && vite build
```

There is no root test suite; `npm test` is an echo placeholder.

### Backend (`/backend`, Bun runtime)

```bash
bun install          # install (bun.lock is the real lockfile)
bun --watch src/server.ts   # dev, via `npm start`, port 9000
bunx tsc --noEmit    # typecheck (what CI runs)
```

No test suite. `backend/e2e-test.ts` exists but is not wired to any script.

Environment: copy `example.env` to `.env`. Required: `MONGODB_URI`
(`MONGO_URI` also accepted), `JWT_SECRET` (fails fast if unset).
AI: `AI_SERVICE_URL` (default `http://localhost:8000`), `AI_SERVICE_API_KEY`
(must match ai-service `API_KEY`). Optional: `ENCRYPTION_KEY`
(`openssl rand -hex 32`), `AWS_*` (S3 is checked at boot but **never used**
— see STATE.md), rate-limit tunables.

### Frontend (`/frontend`, npm + Vite)

```bash
npm ci             # install (package-lock.json is the real lockfile)
npm run dev        # Vite dev server, port 5173
npm run build      # tsc -b && vite build (typecheck + build)
npm run lint       # eslint .
npm run preview    # preview production build
```

`VITE_API_URL` is baked at build time. If unset, the app falls back to
`http://localhost:9000` — this is exactly how production broke (see STATE.md).

### AI service (`/ai-service`, Python 3.11+)

```bash
pip install -r requirements.txt
cd app && uvicorn main:app --reload --port 8000
# or from root: npm run dev:ai
```

Environment: copy `.env.example` to `.env`. `GROQ_API_KEY` required for
STT/TTS/LLM. `API_KEY` must match backend `AI_SERVICE_API_KEY` (empty
disables auth — dev only, refused silently in prod with a logged warning).

## Key architecture notes

- **Backend entrypoint**: `backend/src/server.ts` — Express 5 app, helmet,
  rate limiting, Mongo query sanitization, JSON 10 MB limit.
- **Auth chain**: `authenticateToken` (JWT verify + user-not-deleted check)
  → `authorize(...roles)` (RBAC) → `requireOnboarded` (candidate practice
  routes) → handler. Keep this order.
- **Routes**: `/api/auth` (public, strict rate limit), `/api/users`
  (auth all), `/api/rehearsal` (candidate practice), `/api/org`
  (auth all, recruiter for create/invite), `/api/interviews`
  (recruiter CRUD + candidate invite flow), `/api/tts` (auth, Groq proxy).
  `GET /health` is shallow (no DB check). No `/ready` endpoint.
- **AI integration**: backend `src/utils/aiClient.ts` calls FastAPI at
  `AI_SERVICE_URL` — JSON for generation/evaluation, multipart FormData for
  audio. Shared-secret `Authorization: Bearer` header.
- **Invite tokens**: raw token returned once at creation, sha256-hashed with
  a `pre("save")` hook; lookup via `findByRawToken`. Never store raw tokens.
- **Frontend entrypoint**: `src/main.tsx` → `App.tsx`, React Router v7 with
  flat routes (see `App.tsx` for the full map).
- **Frontend auth**: token + user JSON in `localStorage`; route protection
  via `ProtectedRoute` (`role`, `requireOnboarded` props), role-mismatch
  redirects to the user's home area.
- **Frontend API**: shared client in `src/lib/api.ts` (`api.get/post/put/
  patch/delete`), `VITE_API_URL` base with localhost fallback, Bearer
  injection, 401 clears session and redirects to `/signup`.
- **TTS**: `useSpeak` hook — browser SpeechSynthesis by default, Groq
  Orpheus via `/api/tts` when `useGroqTts` is passed, automatic fallback.
- **Styling**: TailwindCSS 4 via Vite plugin (no tailwind.config.js).
  shadcn/ui "new-york" components in `src/components/ui/`.

## Conventions

- **Backend**: ES modules, Express 5, Mongoose 8, zod validation
  (`*.validation.ts`), service layer returns `{ status, message, data }`,
  controllers translate to HTTP. `asyncHandler` vs try/catch is mixed;
  prefer the existing per-module pattern.
- **Frontend**: TypeScript strict, `@/` → `src/` alias, ESLint with
  react-hooks + react-refresh plugins.
- **AI service**: FastAPI, pydantic models, LiteLLM for all LLM calls,
  Groq OpenAI-compatible client for Whisper STT and Orpheus TTS.
- **No shared config** — each service owns its dependencies and env files.

## Gotchas

- Backend has no tests; `e2e-test.ts` is not wired up. Do not run `npm test`
  in backend (no such script).
- PII (resume/photo/audio) is base64 **inside MongoDB user docs**, not S3.
- Resume must be a valid PDF or rehearsal start fails with a 500 asking to
  re-upload.
- Password field is `select: false` — use `.select("+password")` for login.
- JWTs expire in 1 day; frontend 401s wipe the session and redirect.
- `bcrypt` (native) and `bcryptjs` are both deps; code uses `bcryptjs`.
- Frontend `vercel.json` is dead config; live frontend is on Netlify
  (misconfigured — see STATE.md).
- Root has three competing lockfiles; per-service locks are authoritative:
  `backend/bun.lock`, `frontend/package-lock.json`, `ai-service/uv.lock`.
- `.pnpm-store/` and `nohup.out` are committed by accident (see STATE.md).
  Do not add to them.
- Dokploy compose name is `rehease.io` (typo) — match it exactly in UIs/APIs.
