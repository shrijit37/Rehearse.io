#!/usr/bin/env bash
#
# Remote deploy for Rehearse.io — runs on the production server.
# Pulls the target branch, installs dependencies, builds the frontend,
# and reloads the PM2 processes for the API, web and AI services.
#
#   BRANCH=main  (default)   branch to deploy
#   SKIP_INSTALL=1           skip dependency installation (debug)
#
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/projects/Rehearse.io}"
BRANCH="${BRANCH:-main}"
BUN="${BUN:-/home/ubuntu/.bun/bin/bun}"
SERVE_BIN="${SERVE_BIN:-/home/ubuntu/.nvm/versions/node/v24.16.0/bin/serve}"
API_URL="${VITE_API_URL:-https://api.rehearseio.triptribe.info}"

log() { echo "==> $*"; }

cd "$APP_DIR"
log "Updating source (${BRANCH})"
git fetch --prune origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  log "Backend dependencies"
  ( cd "$APP_DIR/backend" && "$BUN" install )

  log "Frontend dependencies"
  ( cd "$APP_DIR/frontend" && (npm ci || npm install) )

  log "AI service venv"
  ( cd "$APP_DIR/ai-service" &&
    if [ ! -d .venv ]; then python3 -m venv .venv; fi &&
    ./.venv/bin/pip install -q --upgrade pip &&
    ./.venv/bin/pip install -q -r requirements.txt )
fi

log "Building frontend (VITE_API_URL=${API_URL})"
( cd "$APP_DIR/frontend" && VITE_API_URL="$API_URL" npm run build )

log "Reloading PM2 processes"
pm2 startOrReload "$APP_DIR/ecosystem.rehearse.config.cjs"
pm2 save --force

log "Health checks"
sleep 3
curl -s -o /dev/null -w "  backend :3025 -> %{http_code}\n" http://127.0.0.1:3025/health || true
curl -s -o /dev/null -w "  web     :3024 -> %{http_code}\n" http://127.0.0.1:3024/ || true
curl -s -o /dev/null -w "  ai      :8000 -> %{http_code}\n" http://127.0.0.1:8000/ || true

log "Deploy complete"
