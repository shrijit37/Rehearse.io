# Rehearse.io AI Service

FastAPI service that powers Rehearse.io's AI features. All LLM/STT/TTS calls
use **Groq**. No database; stateless per request.

> Honest repo state: [STATE.md](../STATE.md).

## Endpoints

- `POST /api/generate-scenario` — tailored interview questions from resume
  text (`resume_text`, `target_role`)
- `POST /api/evaluate-audio` — Whisper STT + LLM scoring (`audio` file +
  `question` form fields, 25 MB max)
- `POST /api/tts` — Groq Orpheus speech synthesis (`text`, `voice` form
  fields)
- `POST /api/generate-dsa-problems` — role/difficulty-tailored DSA problems
- `POST /api/evaluate-dsa` — static LLM code review (correctness / quality /
  complexity; **no code execution sandbox**)
- `GET /health` — `{ status, stt_available, tts_available, ... }`
- `GET /` — welcome message

All `/api/*` routes require `Authorization: Bearer <API_KEY>` unless no key
is configured (dev only; logs a warning, and a critical error if
`NODE_ENV=production`).

## Setup

```bash
cp .env.example .env   # then fill in GROQ_API_KEY and API_KEY
pip install -r requirements.txt
cd app && uvicorn main:app --reload --port 8000
```

Requires Python 3.11+.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Powers STT, TTS, and LLM (via litellm). Without it, STT/TTS report unavailable and audio evaluation returns 503. |
| `API_KEY` | Prod | empty | Shared secret for backend→AI auth. Must match the backend's `AI_SERVICE_API_KEY`. Also accepts `AI_SERVICE_API_KEY`. Empty disables auth (dev only). |
| `LITELLM_MODEL` | No | `groq/llama-3.3-70b-versatile` | LLM used for generation/evaluation. |
| `STT_MODEL` | No | `whisper-large-v3` | Groq Whisper model. |
| `TTS_MODEL` | No | `canopylabs/orpheus-v1-english` | Groq Orpheus TTS model. Requires accepting model terms in the Groq console; until then TTS fails and the frontend falls back to browser speech. |
| `TTS_VOICE` | No | `tara` | Default TTS voice (`tara`, `leah`, `jess`, `leo`, `dan`, `mia`, `zac`, `zoe`). |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | CORS allowlist (comma-separated). |
| `MAX_AUDIO_SIZE_MB` | No | `25` | Max audio upload size. Keep in sync with backend. |

## Notes

- CORS allows only `GET`/`POST`.
- Audio types restricted to webm/wav/mp3/m4a/ogg/flac/mp4.
- Rate limiting via `utils/rate_limiter` middleware.
