// Rehearse.io production processes (PM2)
//
// API  -> bun server  on :3025  (served as api.rehearseio.triptribe.info)
// Web  -> static SPA on :3024  (served as rehearseio.triptribe.info)
// AI   -> FastAPI     on :8000  (internal, not exposed publicly)
//
// Environment secrets are NOT committed here — the backend loads them from
// backend/.env (dotenv), and the AI service from ai-service/.env.

const path = require("node:path");
const dir = __dirname;

const common = {
  max_memory_restart: "800M",
  max_restarts: 10,
  restart_delay: 4000,
  time: true,
};

module.exports = {
  apps: [
    {
      name: "rehearse-api",
      cwd: path.join(dir, "backend"),
      script: "/home/ubuntu/.bun/bin/bun",
      args: "src/server.ts",
      interpreter: "none",
      env: { PORT: "3025", NODE_ENV: "production" },
      ...common,
    },
    {
      name: "rehearse-web",
      cwd: path.join(dir, "frontend"),
      script: "/home/ubuntu/.nvm/versions/node/v24.16.0/bin/serve",
      args: "-s dist -p 3024 -L",
      ...common,
    },
    {
      name: "rehearse-ai",
      cwd: path.join(dir, "ai-service/app"),
      script: path.join(dir, "ai-service/.venv/bin/uvicorn"),
      args: "main:app --host 127.0.0.1 --port 8000",
      ...common,
    },
  ],
};