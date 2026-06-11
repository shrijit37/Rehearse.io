## 1. Root Environment Configuration

- [x] 1.1 Create root `.env` file with `SERVER_IP=161.118.179.12`

## 2. Backend Configuration

- [x] 2.1 Update `backend/.env` to add `http://161.118.179.12:3000` and `http://161.118.179.12:9000` to `ALLOWED_ORIGINS`

## 3. AI Service Configuration

- [x] 3.1 Update `docker-compose.yml` AI service `ALLOWED_ORIGINS` to include `http://161.118.179.12:3000`

## 4. Docker Compose Updates

- [x] 4.1 Add `SERVER_IP` env var passthrough to all services in `docker-compose.yml`
- [x] 4.2 Update frontend build arg `VITE_API_URL` to use `http://${SERVER_IP}:9000`

## 5. Verification

- [x] 5.1 Rebuild Docker images with `docker compose build`
- [x] 5.2 Start services with `docker compose up`
- [x] 5.3 Verify frontend loads at `http://161.118.179.12:3000`
- [x] 5.4 Verify API calls succeed from browser to `http://161.118.179.12:9000`
