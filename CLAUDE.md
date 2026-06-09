# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rehearse.io is an enterprise B2B platform for conducting automated first-round interviews. Recruiters create structured interview sessions and invite candidates. Candidates complete asynchronous audio interviews. AI evaluates every answer with transcription, scoring, and feedback. Three services in a monorepo: Express.js backend, React frontend, FastAPI AI service.

GDPR/CCPA compliant: cookie consent, data export, account deletion, consent management, audit logging.

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
No test suite exists. No lint script.

### Frontend (`/frontend`)
```bash
npm run dev          # Vite dev server
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

## Architecture

### Service Communication Flow

```
Browser → Express backend (:9000) → FastAPI ai-service (:8000) → LLM (litellm)
                                       ↓
                                  Speech-to-Text (Groq Whisper or OpenAI Whisper)
```

- Frontend calls backend via `VITE_API_URL` (defaults to `http://localhost:9000`).
- Backend calls AI service via `AI_SERVICE_URL` (defaults to `http://localhost:8000`).
- All inter-service calls use the same ports in Docker as in local dev.

### Backend (Express 5, ES Modules)

- **Entry**: `backend/index.js` — connects MongoDB, registers routes, security middleware, global error handler.
- **Security**: helmet (HTTP headers), express-rate-limit (15 req/15min on auth, 100 req/15min general), CORS whitelist via `ALLOWED_ORIGINS` env.
- **Auth**: JWT-based with role-based access control. Routes at `/api/auth/*` → `controller/authController.js`. Token passed as `Bearer` in `Authorization` header.
- **Roles**: `recruiter` and `candidate`. Enforced via `authorize()` middleware from `backend/middleware/authorize.js`.
- **Middleware**:
  - `protect` — JWT verification, attaches `req.user` (password excluded by default via `select: false`).
  - `authorize(...roles)` — role-based access control, must be used after `protect`.
  - `asyncHandler` — wraps async route handlers.
  - `logAudit()` — writes to AuditLog collection.
- **Models** (in `backend/db/`):
  - `User` — name, email, bcrypt password (select:false), role (recruiter|candidate), organization ref, consent fields (consentGiven, consentDate, consentVersion), soft delete (isDeleted, deletedAt). Resume/photo/audio stored as base64 strings.
  - `Organization` — name, slug (unique), members (user + role), createdBy.
  - `InterviewSession` — organization, createdBy, title, targetRole, questions array, status (draft|active|closed), expiresAt.
  - `CandidateInvite` — interview ref, candidate ref, inviteToken (unique), status (pending|started|completed), results array (question, transcription, score, feedback).
  - `RehearsalSession` — legacy practice sessions (user, targetRole, results).
  - `AuditLog` — user, action (enum), details, metadata, ipHash (SHA-256, never raw IP).
- **Routes**:
  - `/api/auth/*` — signup (with role + consent), login, getUser, onboard, consent, export-data, delete-account.
  - `/api/rehearsal/*` — legacy practice flow (start, evaluate, session, history).
  - `/api/org/*` — organization CRUD, member invites (recruiter only).
  - `/api/interviews/*` — interview session CRUD, candidate invite generation, candidate answer submission.

### Frontend (React 19, TypeScript, Vite 7)

- **Path alias**: `@/` maps to `src/`.
- **Styling**: TailwindCSS 4 (Vite plugin, not PostCSS) + `tw-animate-css`. Design tokens via CSS custom properties in `index.css` (oklch, light/dark). shadcn/ui "new-york" style in `src/components/ui/`.
- **UI libraries**: Radix UI, Lucide icons, class-variance-authority, tailwind-merge, Framer Motion, React Three Fiber/Drei.
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
- **Components**: `CookieConsent` (GDPR banner), role-aware `Navbar`, `HeroSection` (enterprise copy).
- **State**: Local component state with React hooks; auth token + user JSON in `localStorage`.

### AI Service (FastAPI, Python)

- Uses `litellm` for LLM completions (configurable via `LITELLM_MODEL` env, defaults to `gpt-4o-mini`).
- Uses Groq Whisper (`whisper-large-v3`) for STT when `GROQ_API_KEY` is set, otherwise falls back to OpenAI Whisper.
- Two endpoints: `POST /api/generate-scenario` (resume → questions) and `POST /api/evaluate-audio` (audio + question → score + feedback + transcription).
- Robust JSON parsing with markdown-fenced response cleanup and bracket extraction fallback.

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
- **Rate limiting** — 15 req/15min on auth endpoints, 100 req/15min general.
- **CORS** — whitelist via `ALLOWED_ORIGINS` env (defaults to localhost:5173 and :3000).
- **Security headers** — helmet.js (CSP, HSTS, X-Frame-Options, etc.).
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
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | CORS whitelist (comma-separated) |

### AI Service (passed via Docker env or shell)
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key (for Whisper fallback) |
| `GROQ_API_KEY` | Groq API key (preferred for STT) |
| `LITELLM_MODEL` | Model name (default: `gpt-4o-mini`) |
| `STT_MODEL` | Speech-to-text model (default: `whisper-large-v3` with Groq) |

### Frontend (Vite build-time)
| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend URL (default: `http://localhost:9000`) |

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:
- **frontend-check**: `npm ci` → lint → build
- **backend-check**: `npm install` only (no tests)
- **ai-service-check**: `pip install -r requirements.txt` only

## Key Gotchas

- Backend uses Express **5** (not 4) and ES modules (`"type": "module"`). Import paths require `.js` extensions.
- TailwindCSS **4** is used via the Vite plugin — there is no `tailwind.config.js` file. Theme customization is done via CSS custom properties in `src/index.css`.
- Resume, photo, and audio are stored as base64 strings in MongoDB (not file uploads to disk/object storage).
- The `pdf-parse` package uses `createRequire` since it's CommonJS-only.
- `npm test` at root and in backend are placeholders that exit with error.
- `JWT_SECRET` must be set before starting the backend — it will crash on startup without it.
- Password field has `select: false` on the User model — use `.select("+password")` when you need to read it (e.g., login).
- Auto-created candidate accounts (from recruiter invites) have random passwords — candidates log in via the invite link flow, not email/password.

### Backend Error-Handling Inconsistency

Two patterns coexist in controllers:
- **asyncHandler wrapper** (auth, interviewSession, organization controllers): `asyncHandler(async (req, res) => { ... })` — thrown errors auto-forward to global handler.
- **Manual try/catch** (rehearsalController): bare `async (req, res, next) => { try { ... } catch(err) { next(err); } }`.

When adding new routes, prefer `asyncHandler` (the dominant pattern). The `interviewSessionController` also reuses `evaluateAnswer` from `rehearsalController.js` — avoid duplicating the AI evaluation logic.

### Frontend Architecture Notes

- **No route guards**: There is no `<ProtectedRoute>` wrapper. Pages check auth ad-hoc in `useEffect` — some pages don't check at all. Unauthenticated users can navigate directly to `/dashboard` or `/recruiter`.
- **No shared API client**: Every page makes raw `fetch()` calls inline with `VITE_API_URL`. No centralized error interceptor, request wrapper, or token refresh logic. Auth tokens are read from `localStorage` at each call site.
- **No shared state**: Auth state lives only in `localStorage`. No React Context, Zustand, or Redux. The Navbar listens for `storage` events for cross-tab sync.
- **Dead dependencies**: `@react-three/fiber`, `@react-three/drei`, `framer-motion`, and `react-dropzone` are in `package.json` but not imported anywhere in the source code. `express-validator` is a backend dependency that is also unused.
