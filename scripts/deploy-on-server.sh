#!/usr/bin/env bash
#
# Remote deploy for Rehearse.io — runs on the production server.
# Pulls the target branch, then builds and starts the full Docker stack
# (mongo, ai-service, backend, frontend). Requires a .env in APP_DIR.
#
#   BRANCH=main  (default)   branch to deploy
#   SKIP_BUILD=1             skip docker build (debug)
#
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/projects/Rehearse.io}"
BRANCH="${BRANCH:-main}"

log() { echo "==> $*"; }

cd "$APP_DIR"
log "Updating source (${BRANCH})"
git fetch --prune origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

if [ ! -f .env ]; then
  echo "!! .env missing in $APP_DIR — compose will fail without MONGO_USERNAME/MONGO_PASSWORD/JWT_SECRET"
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  log "Building + starting Docker stack"
  docker compose up -d --build --remove-orphans
else
  log "SKIP_BUILD=1 — restarting existing containers"
  docker compose up -d --remove-orphans
fi

log "Health checks"
sleep 5
curl -s -o /dev/null -w "  backend :9000 -> %{http_code}\n" http://127.0.0.1:9000/health || true
curl -s -o /dev/null -w "  web     :3000 -> %{http_code}\n" http://127.0.0.1:3000/ || true

log "Deploy complete"
