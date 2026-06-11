## Why

The application currently only works on localhost. When accessed via the server's IP (10.0.0.60), the frontend cannot reach the backend API, CORS blocks requests, and the AI service rejects calls. All three services need to be configured for LAN/public IP access.

## What Changes

- Backend `ALLOWED_ORIGINS` updated to include `http://10.0.0.60:9000` and `http://10.0.0.60:3000`
- AI Service `ALLOWED_ORIGINS` updated to include `http://10.0.0.60:3000`
- Frontend `VITE_API_URL` build arg set to `http://10.0.0.60:9000` so API calls reach the backend
- `.env` files updated with server IP for all cross-origin configurations
- Docker Compose updated to pass server IP through environment variables

## Capabilities

### New Capabilities
- `server-ip-deployment`: Configuration for running all services on a non-localhost IP address

### Modified Capabilities

## Impact

- `backend/.env` — ALLOWED_ORIGINS updated
- `ai-service` environment — ALLOWED_ORIGINS updated
- `docker-compose.yml` — VITE_API_URL, ALLOWED_ORIGINS env vars
- Frontend build process — VITE_API_URL baked in at build time
