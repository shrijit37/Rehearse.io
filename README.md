# Rehearse.io

Enterprise async interview platform with AI evaluation for **behavioral** and **DSA coding** rounds.

Monorepo with three services:
- **backend**: Express.js API with MongoDB and JWT auth
- **frontend**: React + TypeScript + Vite + TailwindCSS 4
- **ai-service**: FastAPI (Python) — scenario generation, STT, TTS, DSA problem generation & code evaluation

## Features

- **Candidate practice**: Voice rehearsal + DSA coding practice with AI scoring
- **Recruiter interviews**: Behavioral, DSA-only, or mixed (voice then coding) sessions
- **Invite links**: Shareable candidate links with multi-round progress
- **AI evaluation**: Transcription + feedback for voice; correctness / quality / complexity for code
- **Results dashboard**: Per-candidate behavioral and DSA breakdowns for recruiters

## Getting Started

1. Run `npm install` in the root.
2. Run `npm run setup` to install all Node dependencies.
3. Run `npm run setup:env` and fill in the `.env` variables in `/backend`.
4. Ensure MongoDB is running locally on port 27017 (or `npm run dev:db`).
5. Configure AI keys (`OPENAI_API_KEY` / LiteLLM model, optional `GROQ_API_KEY` for STT/TTS) for the AI service.
6. Start everything with `npm run dev`.