import os
import re
import hmac
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
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

# Text inference — the LLM behind scenario generation, DSA problem generation
# and audio/DSA evaluation. Any OpenAI-compatible chat-completions endpoint
# works, configured entirely by env: a hosted API (e.g. Groq's
# https://api.groq.com/openai/v1) or a self-hosted gateway. There is no provider
# default — while LLM_BASE_URL or LLM_MODEL is unset, text inference reports
# unavailable on /health and its endpoints answer 503.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()

TEXT_INFERENCE_UNAVAILABLE = (
    "Text inference is not configured. Set LLM_BASE_URL, LLM_MODEL and, when the "
    "endpoint requires one, LLM_API_KEY."
)

# Text inference client — the same OpenAI SDK, pointed at the configured endpoint.
llm_client = None
if LLM_BASE_URL and LLM_MODEL:
    try:
        llm_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY or "not-needed")
        logger.info("Text inference client initialized: %s at %s", LLM_MODEL, LLM_BASE_URL)
    except Exception as exc:
        logger.warning("Text inference client failed to initialize: %s", exc)
else:
    logger.warning(
        "LLM_BASE_URL/LLM_MODEL are not set. Text inference (scenario, audio and "
        "DSA evaluation) is unavailable."
    )


def require_llm() -> None:
    """Fail a text endpoint honestly when no text-inference endpoint is configured."""
    if llm_client is None:
        raise HTTPException(status_code=503, detail=TEXT_INFERENCE_UNAVAILABLE)


def llm_json(messages: list[dict], *, timeout: int) -> str:
    """One JSON-mode completion from the configured text-inference endpoint."""
    response = llm_client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        response_format={"type": "json_object"},
        timeout=timeout,
    )
    return response.choices[0].message.content or ""


# Shared API key for backend→AI authentication.
# Accept either API_KEY or AI_SERVICE_API_KEY so the value matches the backend.
API_KEY = os.getenv("API_KEY") or os.getenv("AI_SERVICE_API_KEY", "")

if not API_KEY:
    if (
        os.environ.get("APP_ENV") == "production"
        or os.environ.get("NODE_ENV") == "production"
    ):
        raise RuntimeError(
            "Refusing to start: a production signal (APP_ENV or NODE_ENV is 'production') "
            "is set but neither API_KEY nor AI_SERVICE_API_KEY is, so every /api/* route "
            "would be unauthenticated."
        )
    logger.warning("WARNING: API_KEY is not set. The AI service is running without authentication!")



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
    require_llm()
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

        content = llm_json(
            [
                {"role": "system", "content": "You are a professional HR assistant that outputs JSON format only."},
                {"role": "user", "content": prompt}
            ],
            timeout=30,
        )

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
        "llm_available": llm_client is not None,
        "llm_model": LLM_MODEL or None,
    }


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
    require_llm()
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
            content = llm_json(
                [
                    {
                        "role": "system",
                        "content": "You are an expert DSA interviewer that outputs valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                timeout=60,
            )
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
    require_llm()
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
            content = llm_json(
                [
                    {
                        "role": "system",
                        "content": "You are an expert DSA code reviewer that outputs valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                timeout=45,
            )
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