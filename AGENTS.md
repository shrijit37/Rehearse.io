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
make dev        # migrate + run all three dev servers
make test       # backend typecheck + smoke test (needs running server + DB)
make lint       # frontend eslint
make build      # backend typecheck + frontend build + ai compileall
make migrate    # drizzle-kit migrate against DATABASE_URL
make health     # polls $APP_URL/health until status ok (600s budget)
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
- **Candidate profile** (`/profile`): the candidate's own record — resume,
  headshot, voice sample, and the structured profile (headline, location, skills,
  roles, qualifications) that a practice round is generated from.
  `GET /api/users` returns it *without* the sealed blobs; each file is fetched on
  demand from `GET /api/users/profile/media/:kind`, owner only, never inlined.
  `PATCH /api/users/profile` writes one plate at a time. The display name is
  owned by the auth service, so the page writes `POST /api/auth/update-user`
  first and mirrors locally second — `resolveSessionUser` rebuilds the name from
  every session, so a local-only edit would be reverted at next sign-in.
- **Resume read**: `POST /api/users/profile/parse-resume` **previews by default
  and writes nothing**; `apply: true` with `sections: [...]` writes only what the
  candidate accepted, so re-reading can never silently undo their corrections.
  Replacing the resume clears `resume_parsed_at`. The text a round actually
  reads is built by `src/utils/profileText.ts` and shown verbatim on the page.
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
  `ENCRYPTION_KEY` is set. S3 is not wired up at all. **Set it for local dev
  too**: a blob sealed under one key is unreadable once the key changes or is
  removed, and the resume read then fails with "ENCRYPTION_KEY is missing or has
  changed" — `decryptField` returns `""` rather than throwing, so the symptom is
  an empty resume, not a crash. A blob recorded under an unknown key has to be
  replaced (`/profile` → Replace resume).
- Reading a resume also needs a working text endpoint in `ai-service/.env`
  (`LLM_BASE_URL` + `LLM_MODEL` + a real `LLM_API_KEY`). `scripts/dev` prints
  "DSA enabled (ai-service has an LLM endpoint)" when those two names are merely
  non-empty, so the banner is **not** proof that inference works; with a missing
  key the read answers 5xx and `/profile` says the reading service could not
  answer. `tests/smoke.ts` therefore asserts that a preview leaves the record
  unchanged rather than that it succeeds, and reports when the read is
  unavailable in that environment.
- Resume must be a valid PDF or rehearsal start fails with a 500. A headshot
  must be a JPEG or PNG.
- Sign-in is delegated to the shared auth service (`auth.shrijit.tech`, Better
  Auth). `users` has `auth_id` (unique) and a nullable `password`; there is no
  local login endpoint. Frontend 401s drop the cached user and redirect.
- `JWT_SECRET` now only signs the recruiter interview-invite token (2d), which
  is still the candidate's only credential before they sign in.
- `docker-compose.yml` is **local dev only** (ai-service + backend). It does
  not define Postgres.
- Secrets live in Doppler (`platform`/`prd`, `REHEARSE_*`). `.env.example`
  documents names only.
