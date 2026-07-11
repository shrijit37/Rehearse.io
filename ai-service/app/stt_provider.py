"""
STT Provider abstraction for Rehearse.io AI Service.

Supports:
  - groq:   Groq Whisper API (free, rate-limited, requires GROQ_API_KEY)

Environment variables:
  GROQ_API_KEY   — required for groq backend
"""

import os
import logging
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
# Factory
# ---------------------------------------------------------------------------

def create_stt_provider() -> STTProvider:
    """Build and return an STTProvider based on environment configuration.
    
    Requires GROQ_API_KEY to be set.
    Raises RuntimeError if no provider can be created.
    """
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError(
            "GROQ_API_KEY is not set."
        )
    return GroqWhisperProvider(api_key=key)