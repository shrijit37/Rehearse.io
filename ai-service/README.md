# Rehearse.io AI Service

FastAPI service that powers Rehearse.io's text inference (scenario generation,
DSA problem generation, DSA code review) on any OpenAI-compatible endpoint
configured by env (`LLM_BASE_URL`/`LLM_MODEL`). The spoken interview does not
run here — it is a Gemini Live session relayed by the backend (`/ws/live`).
No database; stateless per request.

> Honest repo state: [STATE.md](../STATE.md).

## Endpoints

- `POST /api/generate-scenario` — tailored interview questions from resume
  text (`resume_text`, `target_role`)
- `POST /api/generate-dsa-problems` — role/difficulty-tailored DSA problems
- `POST /api/evaluate-dsa` — static LLM code review (correctness / quality /
  complexity; **no code execution sandbox**)
- `GET /health` — `{ status, llm_available, stt_available, tts_available, ... }`
- `GET /` — welcome message

All `/api/*` routes require `Authorization: Bearer <API_KEY>` unless no key
is configured (dev only; logs a warning). With a production signal
(`APP_ENV` or `NODE_ENV` set to `production`) the service refuses to start
without `API_KEY`.

## Setup

```bash
cp .env.example .env   # then fill in LLM_* (text inference) and API_KEY
pip install -r requirements.txt
cd app && uvicorn main:app --reload --port 8000
```

Requires Python 3.11+.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_ENV` | No | `development` | Runtime environment, same var the backend reads. `production` makes the service refuse to start when `API_KEY` is unset, instead of serving `/api/*` unauthenticated; `NODE_ENV=production` counts as a production signal too. |
| `LLM_BASE_URL` | Yes | — | Base URL of an OpenAI-compatible endpoint (a hosted API such as `https://api.groq.com/openai/v1`, or a self-hosted gateway). While it or `LLM_MODEL` is unset, text inference reports unavailable on `/health` and the inference endpoints answer 503. |
| `LLM_MODEL` | Yes | — | Model name the endpoint serves. |
| `LLM_API_KEY` | No | empty | Bearer token for the endpoint. Leave empty only when the endpoint requires none. |
| `API_KEY` | Prod | empty | Shared secret for backend→AI auth. Must match the backend's `AI_SERVICE_API_KEY`. Also accepts `AI_SERVICE_API_KEY`. Empty disables auth (dev only). |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | CORS allowlist (comma-separated). |

## Notes

- CORS allows only `GET`/`POST`.
- Rate limiting via `utils/rate_limiter` middleware.
- All requests are JSON; the spoken-audio endpoints were retired with the batch
  interview path (see `VOICE.md`).
