# Rehearse.io

Monorepo with three services:
- **backend**: Express.js API with MongoDB and JWT auth
- **frontend**: React + TypeScript + Vite + TailwindCSS 4
- **ai-service**: FastAPI (Python) minimal service

## Getting Started

1. Run `npm install` in the root.
2. Run `npm run setup` to install all Node dependencies.
3. Run `npm run setup:env` and fill in the `.env` variables in `/backend`.
4. Ensure MongoDB is running locally on port 27017.
5. Start everything with `npm run dev`.