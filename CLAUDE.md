# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rehearse.io is an enterprise B2B platform for conducting automated first-round interviews. Recruiters create structured interview sessions and invite candidates. Candidates complete asynchronous audio interviews. AI evaluates every answer with transcription, scoring, and feedback. Three services in a monorepo: Express.js backend, React frontend, FastAPI AI service.

GDPR/CCPA compliant: cookie consent, data export, account deletion, consent management, audit logging.

Reference docs:
- [`DESIGN.md`](./DESIGN.md) — Design system (The Verge-inspired: dark canvas, acid-mint/ultraviolet accents, pill corners, PolySans typeface, shadcn/ui components)
- [`PRODUCT.md`](./PRODUCT.md) — Product vision, brand personality, design principles (professional, unbiased, WCAG AA)
- [`AGENTS.md`](./AGENTS.md) — Supplementary agent instructions (partially overlaps this file; some info may be stale)
- [`openspec/`](./openspec/) — OpenChange specs system for planning feature changes (each change has `design.md`, `proposal.md`, `specs/`, `tasks.md`)

## Quick Start

```bash
npm install          # Install root devDependencies (concurrently)
npm run setup        # Install all service dependencies (backend + frontend + ai-service)
npm run setup:env    # Copy backend/example.env → backend/.env
npm run dev          # Start MongoDB (Docker) + all three services concurrently
```

Prerequisites: Node.js 20, Python 3.11+, MongoDB on port 27017 (or use `npm run dev:db`).

## Per-Service Commands

### Backend (`/backend`)
```bash
npm start            # nodemon index.js (auto-reload, port 9000)
```
No test suite exists. No lint script. There are Playwright-based e2e tests in `/e2e/` (not integrated into CI).

### Frontend (`/frontend`)
```bash
npm run dev          # Vite dev server (SWC fast refresh, port 5173)
npm run build        # tsc -b && vite build (typecheck + bundle)
npm run lint         # ESLint
npm run preview      # Preview production build
```

### AI Service (`/ai-service`)
```bash
cd ai-service/app && uvicorn main:app --reload   # FastAPI, port 8000
```

### Docker Compose (full stack)
```bash
docker compose up --build    # MongoDB + ai-service + backend + frontend (nginx)
```
All services share `rehearse-network` bridge network. MongoDB data persists via `mongo_data` named volume.

### E2E Tests
```bash
# Playwright tests in /e2e/ — requires full stack running
# (no package.json runner configured; run with npx playwright test or similar)
```

## Architecture

### Service Communication Flow

```
Browser → Express backend (:9000) → FastAPI ai-service (:8000) → LLM (litellm)
                                       ↓
                                  Speech-to-Text (Groq Whisper or OpenAI Whisper)
```

- Frontend calls backend via `VITE_API_URL` (defaults to `http://localhost:9000`).
- Backend calls AI service via `AI_SERVICE_URL` (defaults to `http://localhost:8000`).
- Backend can optionally send `x-api-key` header for backend→AI auth via `AI_SERVICE_API_KEY` env.
- All inter-service calls use the same ports in Docker as in local dev.

### Backend (Express 5, ES Modules)

- **Entry**: `backend/index.js` — connects MongoDB, registers routes, security middleware, global error handler, SIGTERM graceful shutdown.
- **Security**: helmet (HTTP headers), express-rate-limit (15 req/15min on auth, 1000 req/15min general by default), CORS whitelist via `ALLOWED_ORIGINS` env, `mongo-sanitize` (NoSQL injection: strips `$` from body/query/params globally), `helmet`.
- **Auth**: JWT-based with role-based access control. Routes at `/api/auth/*` → `controller/authController.js`. Token passed as `Bearer` in `Authorization` header.
- **Roles**: `recruiter` and `candidate`. Enforced via `authorize()` middleware from `backend/middleware/authorize.js`.
- **Middleware**:
  - `protect` — JWT verification, attaches `req.user` (password excluded by default via `select: false`).
  - `authorize(...roles)` — role-based access control, must be used after `protect`.
  - `asyncHandler` — wraps async route handlers.
  - `logAudit()` — writes to AuditLog collection.
  - `requireOnboarded` — checks user has completed onboarding (has resume).
- **Models** (in `backend/db/`):
  - `User` — name, email, bcrypt password (select:false), role (recruiter|candidate), organization ref, consent fields (consentGiven, consentDate, consentVersion), soft delete (isDeleted, deletedAt). Resume/photo/audio stored as base64 strings.
  - `Organization` — name, slug (unique), members (user + role), createdBy.
  - `InterviewSession` — organization, createdBy, title, targetRole, questions array, status (draft|active|closed), expiresAt.
  - `CandidateInvite` — interview ref, candidate ref, inviteToken (unique), status (pending|started|completed), results array (question, transcription, score, feedback).
  - `RehearsalSession` — legacy practice sessions (user, targetRole, results).
  - `AuditLog` — user, action (enum, 17 values), details, metadata, ipHash (SHA-256, never raw IP).
- **Routes**:
  - `/api/auth/*` — signup (with role + consent), login, getUser, onboard, consent, export-data, delete-account.
  - `/api/rehearsal/*` — legacy practice flow (start, evaluate, session, history).
  - `/api/org/*` — organization CRUD, member invites (recruiter only).
  - `/api/interviews/*` — interview session CRUD, candidate invite generation, candidate answer submission.
- **Important**: Data rights routes (`consent`, `export-data`, `delete-account`) are mounted BEFORE the auth rate limiter — they're authenticated but shouldn't consume brute-force quota.
- **Utilities** (in `backend/`):
  - `config/constants.js` — `MAX_AUDIO_SIZE_MB` (default 25 MB), `MAX_AUDIO_SIZE` in bytes.
  - `utils/pdfParser.js` — `extractTextFromBase64Pdf(base64String)` extracts text from base64-encoded PDF using `pdf-parse` (CommonJS via `createRequire`).
- **Health check**: `GET /health` returns `{ status: "connected"|"disconnected", timestamp }`. Returns 200 or 503. Also `/test` in non-production only.

### Frontend (React 19, TypeScript, Vite 7)

- **Path alias**: `@/` maps to `src/`.
- **Styling**: TailwindCSS 4 (Vite plugin, not PostCSS) + `tw-animate-css` (animation utilities). Design tokens via CSS custom properties in `index.css` (oklch, light/dark). shadcn/ui "new-york" style in `src/components/ui/`.
- **UI libraries**: Radix UI (Label, Progress, Separator, Slot), Lucide icons, class-variance-authority, clsx, tailwind-merge.
- **Build**: `@vitejs/plugin-react-swc` (SWC-based fast refresh, not Babel).
- **Routing** (in `App.tsx`):
  - `/` — Hero landing page.
  - `/signup` — Auth with role selection (recruiter/candidate) + consent checkbox.
  - `/onboarding` — Candidate profile setup (resume, photo, audio).
  - `/dashboard` — Candidate interview history + analytics.
  - `/rehearsal` — Legacy practice room.
  - `/recruiter` — Recruiter dashboard (org, interviews, candidates).
  - `/recruiter/interviews/new` — Create interview session.
  - `/recruiter/interviews/:id` — View candidate results.
  - `/interview/accept/:token` — Candidate interview room (invite link).
  - `/account` — Account settings (export data, consent, delete account).
  - `/privacy` — Privacy policy.
  - `/terms` — Terms of service.
- **Route protection**: `ProtectedRoute` component wraps authenticated pages. Checks `localStorage.getItem("user")` for auth. Optional `requireOnboarded` prop redirects to `/onboarding` if user hasn't completed it.
- **Shared API client**: `src/lib/api.ts` provides `api.get/post/put/delete<T>()` with:
  - Auto-attaches `Authorization: Bearer` from localStorage.
  - JSON or FormData body (FormData detected automatically).
  - 401 responses auto-clear localStorage and redirect to `/signup`.
  - `raw: true` option returns raw Response (for blob downloads).
  - `tokenOverride` option for invite-token-based auth.
- **State**: Auth token + user JSON in `localStorage`. Navbar listens for `storage` events for cross-tab sync.
- **Docker**: Multi-stage build (node:20-alpine build → nginx:alpine serve). Nginx config uses `try_files $uri $uri/ /index.html` for SPA routing. Frontend served on port 3000 (Docker) or 5173 (dev server).

### AI Service (FastAPI, Python)

- Uses `litellm` for LLM completions (configurable via `LITELLM_MODEL` env, defaults to `gpt-4o-mini`).
- Uses Groq Whisper (`whisper-large-v3`) for STT when `GROQ_API_KEY` is set, otherwise falls back to OpenAI Whisper.
- Two endpoints: `POST /api/generate-scenario` (resume → questions) and `POST /api/evaluate-audio` (audio + question → score + feedback + transcription).
- Robust JSON parsing with markdown-fenced response cleanup and bracket extraction fallback.
- Optional backend→AI auth via `x-api-key` header matching `API_KEY` env.

## Privacy & Compliance (GDPR/CCPA)

### Consent Flow
- User consents at signup via checkbox (required to create account).
- Consent version + timestamp stored on User model.
- `POST /api/auth/consent` — update consent (accept/revoke).
- `GET /api/auth/consent` — get current consent status.
- Cookie consent banner (`CookieConsent.tsx`) manages localStorage preferences.

### Data Rights
- `POST /api/auth/export-data` — returns all user data as JSON (GDPR Article 20).
- `DELETE /api/auth/delete-account` — soft-deletes user, anonymizes all data, deletes sessions. Requires password confirmation.
- Account settings page (`/account`) provides UI for both.

### Security Features
- **JWT_SECRET required** — server crashes on startup if not set (no hardcoded fallback).
- **Password hashing** — bcrypt with cost factor 12.
- **Password field** — excluded from queries by default (`select: false`).
- **Input validation** — name (2-100 chars), email regex, password (8-128 chars), role enum.
- **Rate limiting** — configurable window and max via `AUTH_RATE_MAX`, `AUTH_RATE_WINDOW_MS`, `RATE_MAX`, `RATE_WINDOW_MS`. Defaults: auth 10 req/15min, general 1000 req/15min.
- **CORS** — whitelist via `ALLOWED_ORIGINS` env (defaults to localhost:5173 and :3000).
- **Security headers** — helmet.js (CSP, HSTS, X-Frame-Options, etc.).
- **NoSQL injection** — `mongo-sanitize` strips `$`-prefixed keys from body, query, and params globally.
- **Audit logging** — all significant actions logged to AuditLog with SHA-256 hashed IPs.

## Environment Variables

### Backend (`.env`, copy from `backend/example.env`)
| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_SECRET` | **Yes** | none (crashes without it) | JWT signing key |
| `MONGO_URI` | No | `mongodb://localhost:27017/rehearse` | MongoDB connection |
| `PORT` | No | `9000` | Express server port |
| `NODE_ENV` | No | `development` | Controls error stack in responses |
| `AI_SERVICE_URL` | No | `http://localhost:8000` | FastAPI service URL |
| `AI_SERVICE_API_KEY` | No | empty | Shared secret sent as `x-api-key` to AI service |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | CORS whitelist (comma-separated) |
| `AUTH_RATE_MAX` | No | `10` | Auth endpoint rate limit max requests per window |
| `AUTH_RATE_WINDOW_MS` | No | `900000` (15 min) | Auth rate limit window |
| `RATE_MAX` | No | `1000` | General rate limit max requests per window |
| `RATE_WINDOW_MS` | No | `900000` (15 min) | General rate limit window |

### AI Service (passed via Docker env or shell)
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key (for Whisper fallback) |
| `GROQ_API_KEY` | Groq API key (preferred for STT) |
| `ANTHROPIC_API_KEY` | Anthropic API key (for litellm Claude models) |
| `LITELLM_MODEL` | Model name (default: `gpt-4o-mini`) |
| `STT_MODEL` | Speech-to-text model (default: `whisper-large-v3` with Groq) |
| `API_KEY` | Shared secret — backend sends this as `x-api-key` header to authenticate |

### Frontend (Vite build-time)
| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend URL (default: `http://localhost:9000`; Docker default: `http://backend:9000`) |

### Root-level env file
A consolidated `.env.example` is at the repo root with all env vars from all three services in one place, useful for deployment.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:
- **frontend-check**: `npm ci` → lint → build
- **backend-check**: `npm install` only (no tests)
- **ai-service-check**: `pip install -r requirements.txt` only

## Key Gotchas

- Backend uses Express **5** (not 4) and ES modules (`"type": "module"`). Import paths require `.js` extensions.
- TailwindCSS **4** is used via the Vite plugin — there is no `tailwind.config.js` file. Theme customization is done via CSS custom properties in `src/index.css`.
- Resume, photo, and audio are stored as base64 strings in MongoDB (not file uploads to disk/object storage). Max audio upload is 25 MB (configurable in `backend/config/constants.js`).
- The `pdf-parse` package uses `createRequire` since it's CommonJS-only.
- `npm test` at root and in backend are placeholders that exit with error. Real e2e tests exist in `/e2e/` but aren't integrated into the npm lifecycle.
- `JWT_SECRET` must be set before starting the backend — it will crash on startup without it.
- Password field has `select: false` on the User model — use `.select("+password")` when you need to read it (e.g., login).
- Auto-created candidate accounts (from recruiter invites) have random passwords — candidates log in via the invite link flow, not email/password.
- Frontend Docker image serves via nginx on port 80 (mapped to 3000). The nginx config handles SPA routing via `try_files`.
- **Dead dependencies**: `@react-three/fiber`, `@react-three/drei`, `framer-motion`, and `react-dropzone` are in `frontend/package.json` but not imported anywhere in source code. `express-validator` is in `backend/package.json` but never imported.

### Backend Error-Handling Inconsistency

Two patterns coexist in controllers:
- **asyncHandler wrapper** (auth, interviewSession, organization controllers): `asyncHandler(async (req, res) => { ... })` — thrown errors auto-forward to global handler.
- **Manual try/catch** (rehearsalController): bare `async (req, res, next) => { try { ... } catch(err) { next(err); } }`.

When adding new routes, prefer `asyncHandler` (the dominant pattern). The `interviewSessionController` also reuses `evaluateAnswer` from `rehearsalController.js` — avoid duplicating the AI evaluation logic.

### Backend Route Organization Note

Data rights routes (`dataRights.js`) are mounted at `/api/auth` **before** the auth rate limiter in `index.js`. This prevents legitimate data-rights requests (consent, export, delete) from consuming brute-force throttle quota. New auth-related routes that aren't login-attempt targets should follow the same pattern.

### Frontend API Client Usage

`src/lib/api.ts` is the standard way to call the backend from all pages. It handles:
- Automatic token attachment from localStorage (or `tokenOverride` for invite links).
- 401 auto-redirect to `/signup` with token/user cleanup.
- FormData passthrough (for audio uploads).
- Set `raw: true` for blob/file downloads.
