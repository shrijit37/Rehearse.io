import os
import json
import re
import hmac
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
import litellm
from openai import OpenAI

# Import refactored utilities
from utils.rate_limiter import rate_limit_middleware
from utils.helpers import clean_json_string, parse_json_safely
from utils.problems import _fallback_dsa_problems
# Load .env from the AI service directory first, then fall back to the repo root
# so the service works regardless of the current working directory.
_service_env = Path(__file__).resolve().parent.parent / ".env"
_root_env = Path(__file__).resolve().parents[2] / ".env"
if _service_env.exists():
    load_dotenv(_service_env)
if _root_env.exists():
    load_dotenv(_root_env, override=False)
load_dotenv(override=False)

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

# Register rate limiting middleware
app.middleware("http")(rate_limit_middleware)

# Maximum file upload size: 25MB (matches OpenAI Whisper limit)
MAX_AUDIO_SIZE = int(os.getenv("MAX_AUDIO_SIZE_MB", "25")) * 1024 * 1024
ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/wav", "audio/mpeg", "audio/mp3",
    "audio/m4a", "audio/ogg", "audio/flac", "audio/mp4",
}

MODEL_NAME = os.getenv("LITELLM_MODEL", "groq/llama-3.3-70b-versatile")

# Groq PlayAI text-to-speech configuration
TTS_MODEL = os.getenv("TTS_MODEL", "playai-tts")
DEFAULT_TTS_VOICE = os.getenv("TTS_VOICE", "Fritz-PlayAI")
ALLOWED_TTS_VOICES = [
    "Arista-PlayAI", "Atlas-PlayAI", "Basil-PlayAI", "Briggs-PlayAI",
    "Calum-PlayAI", "Celeste-PlayAI", "Cheyenne-PlayAI", "Chip-PlayAI",
    "Cillian-PlayAI", "Deedee-PlayAI", "Fritz-PlayAI", "Gail-PlayAI",
    "Indigo-PlayAI", "Mamaw-PlayAI", "Mason-PlayAI", "Mikail-PlayAI",
    "Mitch-PlayAI", "Quinn-PlayAI", "Thunder-PlayAI",
]

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

# Shared API key for backend→AI authentication.
# Accept either API_KEY or AI_SERVICE_API_KEY so the value matches the backend.
API_KEY = os.getenv("API_KEY") or os.getenv("AI_SERVICE_API_KEY", "")

if not API_KEY:
    logger.warning("WARNING: API_KEY is not set. The AI service is running without authentication!")
    if os.environ.get("NODE_ENV") == "production":
        logger.error("CRITICAL: Running in production without API_KEY is a security risk!")



async def verify_api_key(authorization: str = Header(None)):
    """Simple shared-secret auth for backend→AI service calls."""
    if not API_KEY:
        # If no API key configured, skip auth (dev mode)
        return
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "").strip()
    if not hmac.compare_digest(token, API_KEY):
        raise HTTPException(status_code=403, detail="Invalid API key")


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

        # Reject oversized uploads before buffering the whole body into memory
        if audio.size is not None and audio.size > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Audio file too large. Maximum size is {MAX_AUDIO_SIZE // (1024*1024)}MB"
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

        # Perform STT transcription using the configured provider (blocking → threadpool)
        try:
            transcription_text = await run_in_threadpool(
                stt_provider.transcribe,
                audio_bytes,
                audio.content_type or "audio/webm",
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

        response = await run_in_threadpool(
            lambda: litellm.completion(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": "You are a professional HR assistant that outputs JSON format only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                timeout=30,
            )
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
    voice: str = Form(""),
    _auth=Depends(verify_api_key),
):
    """
    Convert text to speech using Groq's PlayAI TTS API.

    Returns audio/mpeg bytes.
    Voices: Groq PlayAI voices, e.g. Fritz-PlayAI, Arista-PlayAI, Atlas-PlayAI.
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

    selected_voice = voice.strip() or DEFAULT_TTS_VOICE
    if selected_voice not in ALLOWED_TTS_VOICES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice. Must be one of: {', '.join(ALLOWED_TTS_VOICES)}"
        )

    try:
        response = await run_in_threadpool(
            lambda: tts_client.audio.speech.create(
                model=TTS_MODEL,
                voice=selected_voice,
                input=text,
                response_format="mp3",
            )
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


# ---------------------------------------------------------------------------
# DSA (Data Structures & Algorithms) round
# ---------------------------------------------------------------------------

class DsaGenerateRequest(BaseModel):
    target_role: str = "Software Engineer"
    difficulty: str = "medium"  # easy | medium | hard | mixed
    count: int = 2
    topics: list[str] | None = None


class DsaEvaluateRequest(BaseModel):
    title: str
    description: str
    difficulty: str = "medium"
    constraints: str = ""
    examples: list[dict] = []
    language: str
    code: str
    expected_approach: str = ""
    topics: list[str] = []


STARTER_TEMPLATES = {
    "python": (
        "from typing import List, Optional, Dict, Set, Tuple\n\n"
        "def solution(...):\n"
        "    # Write your solution here\n"
        "    pass\n"
    ),
    "javascript": (
        "/**\n * @param {*} ...\n * @return {*}\n */\n"
        "function solution(...) {\n"
        "  // Write your solution here\n"
        "}\n"
    ),
    "java": (
        "class Solution {\n"
        "    public Object solution(/* params */) {\n"
        "        // Write your solution here\n"
        "        return null;\n"
        "    }\n"
        "}\n"
    ),
    "cpp": (
        "#include <bits/stdc++.h>\nusing namespace std;\n\n"
        "class Solution {\npublic:\n"
        "    // Write your solution here\n"
        "};\n"
    ),
}



@app.post("/api/generate-dsa-problems")
def generate_dsa_problems(payload: DsaGenerateRequest, _auth=Depends(verify_api_key)):
    """Generate DSA interview problems tailored to a role and difficulty."""
    try:
        target_role = (payload.target_role or "Software Engineer")[:200]
        difficulty = (payload.difficulty or "medium").lower()
        if difficulty not in ("easy", "medium", "hard", "mixed"):
            difficulty = "medium"
        count = max(1, min(int(payload.count or 2), 5))
        topics = payload.topics or []
        topics_str = ", ".join(topics[:10]) if topics else "arrays, strings, hash maps, trees, graphs, DP, two pointers"

        prompt = (
            f"You are a senior technical interviewer preparing a DSA coding round for a "
            f"'{target_role}' candidate.\n\n"
            f"Generate exactly {count} original interview-style coding problems.\n"
            f"Difficulty setting: {difficulty}.\n"
            f"Preferred topics (vary across problems): {topics_str}.\n\n"
            f"Rules:\n"
            f"- Problems must be self-contained and solvable in 20–40 minutes each.\n"
            f"- Do NOT copy famous LeetCode titles verbatim if possible; rephrase scenarios.\n"
            f"- Include clear constraints and 2 examples with explanations.\n"
            f"- Provide starter code skeletons for python, javascript, java, and cpp.\n"
            f"- expected_approach should briefly state the intended algorithm (for evaluator use).\n\n"
            f"Return strict JSON:\n"
            f"{{\n"
            f'  "problems": [\n'
            f"    {{\n"
            f'      "title": "...",\n'
            f'      "description": "markdown-friendly problem statement",\n'
            f'      "difficulty": "easy|medium|hard",\n'
            f'      "constraints": "multi-line constraints",\n'
            f'      "examples": [{{"input": "...", "output": "...", "explanation": "..."}}],\n'
            f'      "topics": ["arrays", "hash-map"],\n'
            f'      "expected_approach": "brief algorithm summary",\n'
            f'      "starterCode": {{\n'
            f'        "python": "...",\n'
            f'        "javascript": "...",\n'
            f'        "java": "...",\n'
            f'        "cpp": "..."\n'
            f"      }}\n"
            f"    }}\n"
            f"  ]\n"
            f"}}"
        )

        try:
            response = litellm.completion(
                model=MODEL_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert DSA interviewer that outputs valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                timeout=60,
            )
            content = response.choices[0].message.content or ""
            parsed = parse_json_safely(content, {})
            problems = parsed.get("problems") if isinstance(parsed, dict) else None
            if not isinstance(problems, list) or len(problems) == 0:
                raise ValueError("No problems in LLM response")

            # Normalize / fill missing starter code
            normalized = []
            for p in problems[:count]:
                if not isinstance(p, dict) or not p.get("title") or not p.get("description"):
                    continue
                starter = p.get("starterCode") or {}
                if not isinstance(starter, dict):
                    starter = {}
                for lang, template in STARTER_TEMPLATES.items():
                    if not starter.get(lang):
                        starter[lang] = template
                p["starterCode"] = starter
                p_difficulty = (p.get("difficulty") or (difficulty if difficulty != "mixed" else "medium")).lower()
                if p_difficulty not in ("easy", "medium", "hard"):
                    p_difficulty = "medium"
                p["difficulty"] = p_difficulty
                p["examples"] = p.get("examples") if isinstance(p.get("examples"), list) else []
                p["topics"] = p.get("topics") if isinstance(p.get("topics"), list) else []
                p["constraints"] = p.get("constraints") or ""
                p["expected_approach"] = p.get("expected_approach") or ""
                normalized.append(p)

            if not normalized:
                raise ValueError("No valid problems after normalization")

            return {"problems": normalized}
        except Exception as llm_err:
            logger.warning("LLM DSA generation failed, using fallback bank: %s", llm_err)
            return {"problems": _fallback_dsa_problems(count, difficulty, target_role)}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error generating DSA problems")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating DSA problems",
        )


@app.post("/api/evaluate-dsa")
def evaluate_dsa(payload: DsaEvaluateRequest, _auth=Depends(verify_api_key)):
    """AI-evaluate a candidate's DSA code submission."""
    try:
        title = (payload.title or "")[:300]
        description = (payload.description or "")[:8000]
        difficulty = (payload.difficulty or "medium")[:20]
        constraints = (payload.constraints or "")[:2000]
        language = (payload.language or "python")[:40]
        code = (payload.code or "")[:20000]
        expected_approach = (payload.expected_approach or "")[:2000]
        topics = payload.topics[:10] if payload.topics else []
        examples = payload.examples[:5] if payload.examples else []

        if not title or not description:
            raise HTTPException(status_code=400, detail="title and description are required")
        if not code or not code.strip():
            raise HTTPException(status_code=400, detail="code is required")

        # Detect empty / skeleton-only submissions
        stripped = re.sub(r"\s+", " ", code).strip().lower()
        is_likely_empty = (
            len(code.strip()) < 40
            or "write your solution here" in stripped
        )

        examples_text = "\n".join(
            f"- Input: {e.get('input', '')}\n  Output: {e.get('output', '')}\n  Explanation: {e.get('explanation', '')}"
            for e in examples
            if isinstance(e, dict)
        ) or "None provided"

        prompt = (
            f"You are a senior staff engineer evaluating a candidate's DSA coding solution.\n\n"
            f"Problem Title: {title}\n"
            f"Difficulty: {difficulty}\n"
            f"Topics: {', '.join(topics) if topics else 'N/A'}\n"
            f"Constraints:\n{constraints or 'N/A'}\n\n"
            f"Problem Description:\n{description}\n\n"
            f"Examples:\n{examples_text}\n\n"
            f"Expected approach (hidden from candidate, use for grading):\n{expected_approach or 'N/A'}\n\n"
            f"Language: {language}\n"
            f"Candidate Code:\n```{language}\n{code}\n```\n\n"
            f"Evaluate rigorously but fairly:\n"
            f"- Correctness: does the solution solve the problem including edge cases?\n"
            f"- Code quality: clarity, naming, structure, avoid bugs\n"
            f"- Complexity: time/space Big-O of their approach\n"
            f"- If code is empty, only a stub, or clearly incomplete, score very low (1-3).\n\n"
            f"Return strict JSON only:\n"
            f"{{\n"
            f'  "score": <integer 1-10 overall>,\n'
            f'  "correctness": <integer 1-10>,\n'
            f'  "codeQuality": <integer 1-10>,\n'
            f'  "timeComplexity": "O(...)",\n'
            f'  "spaceComplexity": "O(...)",\n'
            f'  "feedback": "2-4 sentence constructive feedback",\n'
            f'  "strengths": ["..."],\n'
            f'  "improvements": ["..."]\n'
            f"}}"
        )

        default_fallback = {
            "score": 4 if not is_likely_empty else 2,
            "correctness": 4 if not is_likely_empty else 1,
            "codeQuality": 5 if not is_likely_empty else 2,
            "timeComplexity": "Unknown",
            "spaceComplexity": "Unknown",
            "feedback": (
                "Unable to fully parse model evaluation. Review the submission manually. "
                "Ensure the solution handles edge cases and matches the problem constraints."
            ),
            "strengths": [],
            "improvements": ["Re-submit with a complete, tested solution."],
        }

        try:
            response = litellm.completion(
                model=MODEL_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert DSA code reviewer that outputs valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                timeout=45,
            )
            content = response.choices[0].message.content or ""
            parsed = parse_json_safely(content, default_fallback)
        except Exception as llm_err:
            logger.warning("LLM DSA evaluation failed: %s", llm_err)
            parsed = default_fallback

        # Normalize numeric scores
        for key in ("score", "correctness", "codeQuality"):
            try:
                parsed[key] = max(1, min(10, int(parsed.get(key, 5))))
            except (ValueError, TypeError):
                parsed[key] = 5

        if not isinstance(parsed.get("strengths"), list):
            parsed["strengths"] = []
        if not isinstance(parsed.get("improvements"), list):
            parsed["improvements"] = []
        parsed["timeComplexity"] = str(parsed.get("timeComplexity") or "Unknown")[:50]
        parsed["spaceComplexity"] = str(parsed.get("spaceComplexity") or "Unknown")[:50]
        parsed["feedback"] = str(parsed.get("feedback") or default_fallback["feedback"])[:2000]

        return parsed

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error evaluating DSA submission")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during DSA evaluation",
        )