## ADDED Requirements

### Requirement: Server IP configuration
The system SHALL support deployment on a non-localhost IP address via a `SERVER_IP` variable defined in the root `.env` file.

#### Scenario: IP is set in root .env
- **WHEN** `SERVER_IP=10.0.0.60` is set in the repo root `.env`
- **THEN** all services SHALL use this IP for CORS origins and API URLs

### Requirement: Backend CORS allows server IP
The backend SHALL accept requests from origins matching `http://<SERVER_IP>:3000` and `http://<SERVER_IP>:9000`.

#### Scenario: Frontend on server IP hits backend
- **WHEN** a browser at `http://10.0.0.60:3000` makes an API request to `http://10.0.0.60:9000`
- **THEN** the request SHALL NOT be blocked by CORS

### Requirement: AI Service CORS allows server IP
The AI service SHALL accept requests from origins matching `http://<SERVER_IP>:3000`.

#### Scenario: Backend calls AI service from server IP
- **WHEN** the backend at `http://10.0.0.60:9000` forwards requests to the AI service at `http://10.0.0.60:8000`
- **THEN** the AI service SHALL accept the request

### Requirement: Frontend API URL points to server IP
The frontend SHALL be built with `VITE_API_URL=http://<SERVER_IP>:9000` so API calls reach the backend.

#### Scenario: Browser loads frontend from server IP
- **WHEN** a user navigates to `http://10.0.0.60:3000`
- **THEN** API requests SHALL be sent to `http://10.0.0.60:9000`

### Requirement: Docker Compose passes IP to services
Docker Compose SHALL pass `SERVER_IP` from the root `.env` to all service containers and build args.

#### Scenario: Docker build uses server IP
- **WHEN** `docker compose build` is run with `SERVER_IP=10.0.0.60` in root `.env`
- **THEN** the frontend image SHALL be built with `VITE_API_URL=http://10.0.0.60:9000`
