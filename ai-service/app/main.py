import os
import json
import re
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
import litellm
from openai import OpenAI

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Rehearse.io AI API",
    version="1.0.0"
)

# CORS — configurable allowlist, not wildcard
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Maximum file upload size: 25MB (matches OpenAI Whisper limit)
MAX_AUDIO_SIZE = int(os.getenv("MAX_AUDIO_SIZE_MB", "25")) * 1024 * 1024
ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/wav", "audio/mpeg", "audio/mp3",
    "audio/m4a", "audio/ogg", "audio/flac", "audio/mp4",
}

MODEL_NAME = os.getenv("LITELLM_MODEL", "gpt-4o-mini")

# Speech-to-Text via Groq
from stt_provider import create_stt_provider

stt_provider = None
try:
    stt_provider = create_stt_provider()
    if stt_provider:
        logger.info("STT provider initialized with Groq")
except Exception as exc:
    logger.warning("STT provider failed to initialize: %s", exc)
    logger.warning("Transcription will be unavailable until GROQ_API_KEY is set.")

# TTS via Groq
groq_api_key = os.getenv("GROQ_API_KEY")
tts_client = None
if groq_api_key:
    try:
        tts_client = OpenAI(
            api_key=groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        logger.info("Groq TTS client initialized")
    except Exception as exc:
        logger.warning("Groq TTS client failed to initialize: %s", exc)

# Shared API key for backend→AI authentication
API_KEY = os.getenv("API_KEY", "")

if not API_KEY:
    logger.warning("WARNING: API_KEY is not set. The AI service is running without authentication!")
    if os.environ.get("NODE_ENV") == "production":
        logger.error("CRITICAL: Running in production without API_KEY is a security risk!")



# ---------------------------------------------------------------------------
# Simple in-memory rate limiter
# ---------------------------------------------------------------------------

class RateLimiter:
    """In-memory sliding-window rate limiter per client IP."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clients: dict[str, list[float]] = defaultdict(list)

    def check(self, request: Request) -> bool:
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self.window_seconds

        # Prune old entries
        self._clients[ip] = [t for t in self._clients[ip] if t > window_start]

        if len(self._clients[ip]) >= self.max_requests:
            return False

        self._clients[ip].append(now)
        return True


# Apply rate limiting — 60 requests per minute per IP
rate_limiter = RateLimiter(max_requests=60, window_seconds=60)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path in ("/", "/health"):
        # Skip rate limiting for health/root endpoints
        return await call_next(request)

    if not rate_limiter.check(request):
        return Response(
            content=json.dumps({"detail": "Rate limit exceeded. Try again later."}),
            status_code=429,
            media_type="application/json",
        )

    return await call_next(request)


async def verify_api_key(authorization: str = Header(None)):
    """Simple shared-secret auth for backend→AI service calls."""
    if not API_KEY:
        # If no API key configured, skip auth (dev mode)
        return
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "").strip()
    if token != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


def clean_json_string(raw_text: str) -> str:
    """Scrubs out markdown wrappers, whitespace, and metadata tags from a raw LLM response."""
    if not raw_text:
        return ""
    # Strip markdown block wrappers like ```json ... ``` or ``` ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()

def parse_json_safely(raw_text: str, default_fallback: dict) -> dict:
    """Parses a raw LLM response as JSON safely, using cleanup regexes and falling back to a default dict."""
    cleaned = clean_json_string(raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            # Fallback parsing strategy: extract content enclosed within first '{' and last '}'
            start_idx = cleaned.find('{')
            end_idx = cleaned.rfind('}')
            if start_idx != -1 and end_idx != -1:
                return json.loads(cleaned[start_idx:end_idx+1])
        except Exception:
            pass
        return default_fallback

class ScenarioRequest(BaseModel):
    resume_text: str
    target_role: str


@app.get("/")
def root():
    return {"message": "Welcome to Rehearse.io AI API 🚀"}


@app.post("/api/generate-scenario")
def generate_scenario(payload: ScenarioRequest, _auth=Depends(verify_api_key)):
    try:
        # Truncate inputs to prevent abuse
        resume_text = payload.resume_text[:10000]
        target_role = payload.target_role[:200]

        prompt = (
            f"You are an expert interviewer. Read the candidate's resume below and generate exactly 3 "
            f"highly specific, tailored interview/rehearsal questions for the target role: '{target_role}'.\n\n"
            f"Candidate Resume:\n{resume_text}\n\n"
            f"Return your response strictly in the following JSON format:\n"
            f"{{\n"
            f"  \"questions\": [\n"
            f"    \"Tailored question 1...\",\n"
            f"    \"Tailored question 2...\",\n"
            f"    \"Tailored question 3...\"\n"
            f"  ]\n"
            f"}}"
        )

        response = litellm.completion(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a professional HR assistant that outputs JSON format only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            timeout=30,
        )

        content = response.choices[0].message.content or ""
        default_fallback = {
            "questions": [
                f"Can you explain your experience as it relates to the '{target_role}' role?",
                "Tell me about a challenging technical project you worked on and how you resolved it.",
                "Why are you interested in this position, and what unique value do you bring?"
            ]
        }

        parsed_response = parse_json_safely(content, default_fallback)
        if "questions" not in parsed_response or not isinstance(parsed_response["questions"], list):
            parsed_response = default_fallback

        return parsed_response
    except Exception as e:
        logger.exception("Error generating scenario")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating the scenario"
        )


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "stt_available": stt_provider is not None,
        "stt_backend": "groq" if stt_provider else None,
        "tts_available": tts_client is not None,
        "tts_backend": "groq" if tts_client else None,
    }


@app.post("/api/evaluate-audio")
async def evaluate_audio(
    audio: UploadFile = File(...),
    question: str = Form(...),
    _auth=Depends(verify_api_key),
):
    try:
        # Validate content type
        if audio.content_type and audio.content_type not in ALLOWED_AUDIO_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid audio type: {audio.content_type}. Allowed: {', '.join(ALLOWED_AUDIO_TYPES)}"
            )

        # Read and validate file size
        audio_bytes = await audio.read()
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Audio file too large. Maximum size is {MAX_AUDIO_SIZE // (1024*1024)}MB"
            )
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        if not stt_provider:
            raise HTTPException(
                status_code=503,
                detail="STT service not configured. Set GROQ_API_KEY."
            )

        # Perform STT transcription using the configured provider
        try:
            transcription_text = stt_provider.transcribe(
                audio_bytes,
                audio.content_type or "audio/webm"
            )
        except Exception:
            logger.exception("STT transcription failed")
            raise HTTPException(
                status_code=503,
                detail="Speech-to-text processing failed. Please try again with clearer audio.",
            )

        # Truncate transcription to prevent abuse
        transcription_text = transcription_text[:5000]
        question_text = question[:500]

        prompt = (
            f"You are a professional HR interviewer conducting a job interview rehearsal.\n"
            f"Evaluate the candidate's answer below against the interview question provided.\n\n"
            f"Interview Question:\n{question_text}\n\n"
            f"Candidate's Transcribed Answer:\n{transcription_text}\n\n"
            f"Provide your feedback strictly in the following JSON format:\n"
            f"{{\n"
            f"  \"score\": <an integer between 1 and 10>,\n"
            f"  \"feedback\": \"<a concise 2-3 sentence evaluation of the answer, highlighting strengths and areas of improvement>\"\n"
            f"}}"
        )

        response = litellm.completion(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a professional HR assistant that outputs JSON format only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            timeout=30,
        )

        content = response.choices[0].message.content or ""
        default_fallback = {
            "score": 7,
            "feedback": "Answer recorded successfully. The evaluation model returned an unconventional response format, but your response contains solid elements."
        }

        parsed_response = parse_json_safely(content, default_fallback)
        if "score" not in parsed_response or "feedback" not in parsed_response:
            parsed_response = default_fallback

        # Validate score range
        try:
            score = int(parsed_response["score"])
            parsed_response["score"] = max(1, min(10, score))
        except (ValueError, TypeError):
            parsed_response["score"] = 7

        parsed_response["transcription"] = transcription_text
        return parsed_response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error evaluating audio")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during audio evaluation"
        )


@app.post("/api/tts")
async def text_to_speech(
    text: str = Form(...),
    voice: str = Form("alloy"),
    _auth=Depends(verify_api_key),
):
    """
    Convert text to speech using Groq's TTS API.
    
    Returns audio/mpeg bytes.
    Voices: alloy, echo, fable, onyx, nova, shimmer
    """
    if not tts_client:
        raise HTTPException(
            status_code=503,
            detail="TTS service not configured. Set GROQ_API_KEY."
        )

    if not text or len(text) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Text must be between 1 and 5000 characters."
        )

    allowed_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    if voice not in allowed_voices:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice. Must be one of: {', '.join(allowed_voices)}"
        )

    try:
        response = tts_client.audio.speech.create(
            model="whisper-large-v3",
            voice=voice,
            input=text,
        )

        audio_bytes = response.content

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=\"speech.mp3\"",
                "Content-Length": str(len(audio_bytes)),
            }
        )
    except Exception as e:
        logger.exception("TTS generation failed")
        raise HTTPException(
            status_code=500,
            detail="Text-to-speech generation failed."
        )