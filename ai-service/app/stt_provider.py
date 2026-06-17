"""
STT Provider abstraction for Rehearse.io AI Service.

Supports three backends:
  - local  (default): faster-whisper running locally (free, unlimited, no API key needed)
  - groq:   Groq Whisper API (free, rate-limited, requires GROQ_API_KEY)
  - openai: OpenAI Whisper API (paid, requires OPENAI_API_KEY)

Environment variables:
  STT_BACKEND    — "local" | "groq" | "openai" | "auto"  (default: "local")
  GROQ_API_KEY   — required for groq backend
  OPENAI_API_KEY — required for openai backend
  STT_LOCAL_MODEL   — faster-whisper model name (default: "distil-large-v3")
  STT_LOCAL_DEVICE  — "cpu" | "cuda" (default: "cpu")
"""

import os
import logging
import tempfile
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

AUDIO_EXTENSIONS = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/x-m4a": ".m4a",
    "audio/opus": ".opus",
}


def guess_extension(content_type: str) -> str:
    """Map a MIME type to a file extension for Whisper API calls."""
    return AUDIO_EXTENSIONS.get(content_type, ".webm")


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class STTProvider(ABC):
    """Abstract speech-to-text provider."""

    @abstractmethod
    def transcribe(self, audio_bytes: bytes, content_type: str = "audio/webm") -> str:
        """Transcribe audio bytes to text. Returns the transcribed string."""
        ...


# ---------------------------------------------------------------------------
# Local Whisper (faster-whisper) — free, unlimited, self-hosted
# ---------------------------------------------------------------------------

class LocalWhisperProvider(STTProvider):
    """Transcribes audio using faster-whisper running locally.

    Downloads the model on first use (cached in ~/.cache/huggingface/).
    Requires ffmpeg to be available on the system path.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
    ):
        self.model_name = model_name or os.getenv("STT_LOCAL_MODEL", "distil-large-v3")
        self.device = device or os.getenv("STT_LOCAL_DEVICE", "cpu")
        # Default compute types: int8 for CPU, float16 for GPU
        self.compute_type = compute_type or os.getenv(
            "STT_LOCAL_COMPUTE_TYPE",
            "int8_float16" if self.device == "cpu" else "float16",
        )
        self._model = None
        self._load_model()

    def _load_model(self) -> None:
        """Lazy-load the Whisper model at startup."""
        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading faster-whisper model '%s' on %s (compute=%s) ...",
                self.model_name,
                self.device,
                self.compute_type,
            )
            self._model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
                download_root=os.getenv(
                    "STT_LOCAL_CACHE_DIR",
                    os.path.expanduser("~/.cache/huggingface/hub"),
                ),
            )
            logger.info("Local Whisper model loaded successfully.")
        except ImportError:
            logger.error(
                "faster-whisper is not installed. "
                "Run: pip install faster-whisper"
            )
            raise
        except Exception as exc:
            logger.error(
                "Failed to load local Whisper model '%s': %s",
                self.model_name,
                exc,
            )
            raise

    def transcribe(self, audio_bytes: bytes, content_type: str = "audio/webm") -> str:
        if self._model is None:
            raise RuntimeError("Local Whisper model not loaded.")

        # faster-whisper reads from a file path — write to a temp file
        suffix = guess_extension(content_type)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            segments, info = self._model.transcribe(
                tmp_path,
                beam_size=5,
                language=None,  # auto-detect
                vad_filter=True,  # filter out non-speech
                vad_parameters=dict(min_silence_duration_ms=500),
            )
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())
            return " ".join(text_parts)
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass  # Temp file cleanup is best-effort



# ---------------------------------------------------------------------------
# Groq Whisper API — free tier, rate-limited
# ---------------------------------------------------------------------------

class GroqWhisperProvider(STTProvider):
    """Transcribes audio via the Groq API (whisper-large-v3)."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.model = model or os.getenv("STT_MODEL", "whisper-large-v3")
        self._client = None

        if not self.api_key:
            raise ValueError("GROQ_API_KEY is required for GroqWhisperProvider")

        from openai import OpenAI
        self._client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1",
        )

    def transcribe(self, audio_bytes: bytes, content_type: str = "audio/webm") -> str:
        if self._client is None:
            raise RuntimeError("Groq client not initialized")

        filename = f"audio{guess_extension(content_type)}"
        transcription = self._client.audio.transcriptions.create(
            model=self.model,
            file=(filename, audio_bytes, content_type),
        )
        return transcription.text


# ---------------------------------------------------------------------------
# OpenAI Whisper API — paid
# ---------------------------------------------------------------------------

class OpenAiWhisperProvider(STTProvider):
    """Transcribes audio via the OpenAI Whisper API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model or os.getenv("STT_MODEL", "whisper-1")
        self._client = None

        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAiWhisperProvider")

        from openai import OpenAI
        self._client = OpenAI(api_key=self.api_key)

    def transcribe(self, audio_bytes: bytes, content_type: str = "audio/webm") -> str:
        if self._client is None:
            raise RuntimeError("OpenAI client not initialized")

        filename = f"audio{guess_extension(content_type)}"
        transcription = self._client.audio.transcriptions.create(
            model=self.model,
            file=(filename, audio_bytes, content_type),
        )
        return transcription.text


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_stt_provider() -> STTProvider:
    """Build and return an STTProvider based on environment configuration.

    Resolution order for *auto* mode:
      1. Local (faster-whisper) — always available when installed
      2. Groq — if GROQ_API_KEY is set
      3. OpenAI — if OPENAI_API_KEY is set

    Raises RuntimeError if no provider can be created.
    """
    backend = os.getenv("STT_BACKEND", "local").strip().lower()

    # --- explicit backend ---
    if backend == "local":
        try:
            return LocalWhisperProvider()
        except Exception as exc:
            raise RuntimeError(
                f"Failed to initialize local Whisper provider: {exc}\n"
                "Make sure 'faster-whisper' is installed and ffmpeg is available."
            ) from exc

    if backend == "groq":
        key = os.getenv("GROQ_API_KEY")
        if not key:
            raise RuntimeError(
                "STT_BACKEND=groq but GROQ_API_KEY is not set."
            )
        return GroqWhisperProvider(api_key=key)

    if backend == "openai":
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise RuntimeError(
                "STT_BACKEND=openai but OPENAI_API_KEY is not set."
            )
        return OpenAiWhisperProvider(api_key=key)

    # --- auto mode (default) — try local first, then API fallbacks ---
    if backend == "auto":
        # 1. Local
        try:
            logger.info("STT auto: trying local faster-whisper...")
            return LocalWhisperProvider()
        except Exception as exc:
            logger.warning("STT auto: local Whisper unavailable (%s)", exc)

        # 2. Groq
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            try:
                logger.info("STT auto: falling back to Groq Whisper API...")
                return GroqWhisperProvider(api_key=groq_key)
            except Exception as exc:
                logger.warning("STT auto: Groq unavailable (%s)", exc)

        # 3. OpenAI
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            try:
                logger.info("STT auto: falling back to OpenAI Whisper API...")
                return OpenAiWhisperProvider(api_key=openai_key)
            except Exception as exc:
                logger.warning("STT auto: OpenAI unavailable (%s)", exc)

        raise RuntimeError(
            "STT auto: no provider available. "
            "Install faster-whisper OR set GROQ_API_KEY or OPENAI_API_KEY."
        )

    raise RuntimeError(
        f"Unknown STT_BACKEND '{backend}'. "
        "Expected: local | groq | openai | auto"
    )
