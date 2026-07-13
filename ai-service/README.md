# Rehearse.io AI Service

FastAPI service that powers Rehearse.io's AI features:

- **Scenario generation** — tailored interview questions from a resume (`/api/generate-scenario`)
- **Audio evaluation** — speech-to-text (Groq Whisper) + LLM scoring (`/api/evaluate-audio`)
- **Text-to-speech** — Groq PlayAI voices (`/api/tts`)
- **DSA rounds** — problem generation and code evaluation (`/api/generate-dsa-problems`, `/api/evaluate-dsa`)

All LLM/STT/TTS calls use **Groq**.

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
| `GROQ_API_KEY` | Yes | — | Powers STT, TTS, and LLM (via litellm). |
| `API_KEY` | Prod | empty | Shared secret for backend→AI auth. Must match the backend's `AI_SERVICE_API_KEY`. Empty disables auth (dev only). Also accepts `AI_SERVICE_API_KEY`. |
| `LITELLM_MODEL` | No | `groq/llama-3.3-70b-versatile` | LLM used for generation/evaluation. |
| `STT_MODEL` | No | `whisper-large-v3` | Groq Whisper model. |
| `TTS_MODEL` | No | `playai-tts` | Groq PlayAI TTS model. |
| `TTS_VOICE` | No | `Fritz-PlayAI` | Default TTS voice. |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | CORS allowlist (comma-separated). |
| `MAX_AUDIO_SIZE_MB` | No | `25` | Max audio upload size. |

## Health check

`GET /health` reports STT/TTS availability.
