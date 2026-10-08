# Rehearse.io

Enterprise async interview platform with AI evaluation for **behavioral**
(voice) and **DSA coding** rounds.

Monorepo with three services plus MongoDB:

- **backend**: Bun + Express 5 + TypeScript + Mongoose, JWT auth, port 9000
- **frontend**: React 19 + TypeScript + Vite 7 + TailwindCSS 4 (static SPA)
- **ai-service**: FastAPI (Python) — scenario generation, STT, TTS, DSA
  problem generation and code evaluation, port 8000
- **mongo**: MongoDB 7 (docker-compose only)

> Honest status lives in [STATE.md](./STATE.md). Production is currently
> broken (live frontend calls `localhost:9000`, API domain 404s). Read that
> file before trusting any other doc.

## Features

- **Candidate practice**: voice rehearsal + DSA coding practice with AI scoring
- **Recruiter interviews**: behavioral, DSA-only, or mixed (voice then coding)
- **Invite links**: shareable candidate links with multi-round progress
- **AI evaluation**: Whisper transcription + LLM feedback for voice;
  correctness / quality / complexity for code (static LLM review, no sandbox)
- **Results dashboards**: per-candidate behavioral and DSA breakdowns
- **Organizations**: multi-recruiter orgs with member invites
- **Consent + GDPR**: consent versioning, data export, soft-delete account
- **Audit log**: security events recorded (write-only, no viewer yet)

All AI features need `GROQ_API_KEY` (STT + TTS + LLM via LiteLLM).

## Getting started (local dev)

1. `npm run setup` — installs backend, frontend, and AI-service dependencies.
2. `npm run setup:env` — copies `backend/example.env` to `backend/.env`.
   Fill in `JWT_SECRET` (required, no default).
3. Copy `ai-service/.env.example` to `ai-service/.env`, fill in
   `GROQ_API_KEY` (required for AI features) and `API_KEY` (must match the
   backend's `AI_SERVICE_API_KEY`).
4. Start MongoDB: `npm run dev:db` (uses `docker compose up -d` for the
   `mongo` service).
5. Start everything: `npm run dev` (DB + backend + frontend + AI service).

Service URLs: backend `http://localhost:9000`, frontend
`http://localhost:5173`, AI `http://localhost:8000`. Health: backend
`GET /health`, AI `GET /health`.

## Docs

- [STATE.md](./STATE.md) — honest current state (read first)
- [AGENTS.md](./AGENTS.md) — agent/dev instructions per service
- [PRODUCT.md](./PRODUCT.md) — product purpose and design principles
- [backend/README.md](./backend/README.md) — API reference
- [frontend/README.md](./frontend/README.md) — frontend guide
- [ai-service/README.md](./ai-service/README.md) — AI service reference
