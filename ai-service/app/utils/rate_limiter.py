import time
import json
from collections import defaultdict
from fastapi import Request, Response

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
