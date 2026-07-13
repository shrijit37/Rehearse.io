import re
import json

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
