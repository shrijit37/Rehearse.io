# frontend

React 19 + TypeScript + Vite 7 + TailwindCSS 4 static SPA for Rehearse.io.

> Honest repo state: [STATE.md](../STATE.md). The live Netlify build is
> broken (no `VITE_API_URL` at build time, calls `localhost:9000`).

## Install and run

```bash
npm ci            # package-lock.json is the lockfile
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # preview the production build
```

Set `VITE_API_URL` **before** `npm run build` — it is baked into the
bundle. Unset means the app talks to `http://localhost:9000`.

## Routes

Public: `/` (landing), `/signup` (login+signup), `/interview/accept/:token`
(candidate invite), `/privacy`, `/terms`, `/account` (auth, any role).

Candidate (`ProtectedRoute role="candidate" requireOnboarded`):
`/onboarding`, `/rehearsal` (voice), `/practice/dsa`, `/dashboard`.

Recruiter (`ProtectedRoute role="recruiter"`): `/recruiter`,
`/recruiter/interviews/new`, `/recruiter/interviews/:id` (results).

Auth state is token + user JSON in `localStorage`. `ProtectedRoute` handles
login redirects, role-mismatch redirects, and the candidate onboarding gate.
The shared API client (`src/lib/api.ts`) injects the Bearer token and on 401
clears the session and redirects to `/signup`.

## Architecture

- `src/main.tsx` → `App.tsx`, React Router v7, flat route list.
- Shared client `src/lib/api.ts`: `api.get/post/put/patch/delete`, `raw`
  mode for blob downloads (TTS audio).
- `useSpeak` hook: browser SpeechSynthesis by default, Groq Orpheus via
  `POST /api/tts` when `useGroqTts` is set, automatic fallback on failure.
- Audio capture via `MediaRecorder` (`audio/webm` blobs).
- Styling: TailwindCSS 4 via the Vite plugin (no config file), shadcn/ui
  "new-york" components in `src/components/ui/`, `@/` → `src/` alias.

## Deploy notes

Pure static output (`dist/`). Served by nginx in Docker (`nginx.conf` has
the SPA fallback). `vercel.json` is dead config — the live site is on
Netlify, and platform direction is Cloudflare Pages. Whatever host builds
it must provide `VITE_API_URL`.
