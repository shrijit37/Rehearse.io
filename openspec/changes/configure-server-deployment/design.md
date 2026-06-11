## Context

Rehearse.io runs three services (frontend, backend, AI service) that currently default to `localhost` URLs. When accessed from the server's LAN IP (`10.0.0.60`), the frontend cannot reach the backend (wrong API URL), CORS blocks cross-origin requests, and the AI service rejects calls from the backend due to origin mismatch.

## Goals / Non-Goals

**Goals:**
- All services accessible via `http://10.0.0.60:3000` (frontend), `http://10.0.0.60:9000` (backend), `http://10.0.0.60:8000` (AI service)
- CORS allowlists include the server IP origins
- Frontend builds with the correct API base URL
- Docker Compose passes the server IP through to all services

**Non-Goals:**
- HTTPS/TLS setup (out of scope for this change)
- DNS configuration or domain name setup
- Production hardening beyond IP-based access
- CI/CD pipeline changes

## Decisions

### 1. Use `.env` at repo root for shared IP configuration
**Decision**: Add a root `.env` file with `SERVER_IP=10.0.0.60` and reference it in docker-compose.yml and backend `.env`.

**Why**: Single source of truth for the IP. Changing the IP later means editing one file.

**Alternative considered**: Hardcoding IP in each service's config — rejected because it duplicates the value across 3+ files.

### 2. Frontend uses build-time `VITE_API_URL`
**Decision**: Set `VITE_API_URL=http://10.0.0.60:9000` as a Docker build arg, which Vite bakes into the JS bundle.

**Why**: Vite only supports env vars at build time for `VITE_*` prefixed vars. The frontend container serves static files — no runtime config possible without a rewrite.

**Trade-off**: Changing the IP requires rebuilding the frontend image. Acceptable for a fixed server deployment.

### 3. CORS uses explicit origin list, not wildcards
**Decision**: Add `http://10.0.0.60:3000` and `http://10.0.0.60:9000` to the allowed origins list rather than using `*`.

**Why**: Wildcards disable cookies and credentials. The app uses JWT via Authorization header so credentials aren't strictly needed, but explicit origins follow security best practices already in place.

## Risks / Trade-offs

- **[Risk] IP changes break config** → Mitigated by centralizing IP in root `.env`
- **[Risk] Frontend must be rebuilt for IP changes** → Documented; Docker cache minimizes rebuild time
- **[Trade-off] No HTTPS** → Acceptable for LAN/internal use; HTTPS can be added later via reverse proxy
