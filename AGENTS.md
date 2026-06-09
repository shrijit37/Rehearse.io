# Rehearse.io - Agent Instructions

## Project Structure

Monorepo with three services:

```
├── ai-service/          # FastAPI (Python) - AI evaluation + STT
├── backend/             # Express.js 5 API - MongoDB, JWT auth
└── frontend/            # React 19 + TypeScript + Vite 7 + TailwindCSS 4
```

## Developer Commands

### Backend (`/backend`)
```bash
npm start          # Runs with nodemon (auto-reload, port 9000)
# No test suite - package.json has placeholder "echo Error: no test specified"
```

**Environment** (copy `example.env` to `.env`):
```
MONGO_URI=mongodb://localhost:27017/rehearse
JWT_SECRET=your_jwt_secret
PORT=9000
NODE_ENV=development
```

### Frontend (`/frontend`)
```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # tsc -b && vite build (typecheck + build)
npm run lint       # eslint .
npm run preview    # Preview production build
```

### AI Service (`/ai-service/app`)
```bash
uvicorn main:app --reload   # FastAPI on port 8000
# Or from root: npm run dev:ai
```

## Key Architecture Notes

- **Backend entrypoint**: `backend/index.js` — Express 5 app with MongoDB, JWT auth, helmet security headers, rate limiting
- **Auth middleware chain**: `protect` (JWT verification) → `authorize(...roles)` (RBAC) → handler. Always in this order.
- **AI service integration**: Backend calls FastAPI at `AI_SERVICE_URL` for scenario generation and audio evaluation. Uses multipart FormData for audio uploads via axios.
- **Frontend entrypoint**: `frontend/src/main.tsx` → `App.tsx` with React Router v7 (flat route structure, no nested routes)
- **Frontend auth**: No centralized auth state. Each page reads token/user from `localStorage` directly.
- **Frontend API calls**: Raw `fetch()` with `VITE_API_URL` base. No shared API client or error interceptor.

## Important Conventions

- **Backend**: ES modules (`"type": "module"`), Express 5, Mongoose 8. Import paths require `.js` extensions.
- **Frontend**: TypeScript strict, path alias `@/` maps to `src/`, ESLint with React hooks plugin
- **Styling**: TailwindCSS 4 via Vite plugin (no tailwind.config.js). CSS custom properties for design tokens in `index.css`. shadcn/ui "new-york" style components in `src/components/ui/`.
- **No shared config** — each service manages its own dependencies
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) — frontend lint+build, backend install, ai-service install

## Gotchas

- Backend has no test suite — `npm test` exits with error
- Two error-handling patterns in backend controllers: `asyncHandler` wrapper vs manual try/catch. New routes should use `asyncHandler`.
- Frontend has no route guards — pages check auth ad-hoc or not at all
- Frontend has dead dependencies (three.js, framer-motion, react-dropzone) in package.json but unused in code
- `express-validator` is a backend dependency that is never imported
- MongoDB connection defaults to localhost — needs running instance
- JWT_SECRET must be set before starting the backend
- Password field has `select: false` — use `.select("+password")` when needed
