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

Two build/dev-time vars, both baked per run (`import.meta.env`):

- `VITE_API_URL` — API base. Unset means `http://localhost:9000`; a production
  build must set it (`deploy-frontend.yml` fails the deploy when `localhost:9000`
  appears in the bundle).
- `VITE_AUTH_URL` — shared auth service. Unset means `https://auth.shrijit.tech`.

Vite resolves `VITE_*` from the process environment last, so an inline value
wins over `frontend/.env*`. `make dev` (root) uses that to point both at the
local stack. Prefer it over hand-setting these.

## Routes

Public: `/` (landing), `/signup` (login+signup), `/interview/accept/:token`
(candidate invite), `/privacy`, `/terms`, `/account` (auth, any role).

Candidate (`ProtectedRoute role="candidate" requireOnboarded`):
`/onboarding`, `/rehearsal` (voice), `/practice/dsa`, `/dashboard`.

Recruiter (`ProtectedRoute role="recruiter"`): `/recruiter`,
`/recruiter/interviews/new`, `/recruiter/interviews/:id` (results).

Auth state is the shared-auth session cookie plus the profile JSON cached in
`localStorage` by `src/pages/SignUp.tsx` after `/api/auth/claim`. `ProtectedRoute`
handles login redirects, role-mismatch redirects, and the candidate onboarding
gate. `src/lib/api.ts` sends `credentials: "include"` (no local token; the
`tokenOverride` Bearer is only for candidate invite tokens) and on 401 clears
the cached profile and redirects to `/signup`.

Auth flows need the page to share a site with the API and the auth service —
in production they are siblings under one domain; in local dev the root
`make dev` serves all three on `127.0.0.1` for the same reason.

## Architecture

- `src/main.tsx` → `App.tsx`, React Router v7, flat route list.
- Shared client `src/lib/api.ts`: `api.get/post/put/patch/delete`, `raw`
  mode for blob downloads (voice samples).
- `useSpeak` hook: browser SpeechSynthesis, for non-conversational speech
  (reading a question aloud).
- Spoken answers run over a live socket, not a batch upload: `POST /api/live/session`
  mints a 60 s ticket, `src/lib/live/` (mic capture, 24 kHz playback, the socket)
  opens `wss://<api-host>/ws/live`, and the backend owns the setup frame, the
  coaching turn, the score and the persistence. `src/hooks/useLiveAnswer.ts`
  drives one session per run for `RehearsalRoom`/`CandidateInterview` — questions are
  advanced on the same socket, so a practice run stays one stored session.
  `MediaRecorder` survives only for profile voice samples
  (`Onboarding`, `AccountSettings`).
- Styling: TailwindCSS 4 via the Vite plugin (no config file), shadcn/ui
  "new-york" components in `src/components/ui/`, `@/` → `src/` alias.

## Deploy notes

Pure static output (`dist/`). Target is **Cloudflare Pages** via
`.github/workflows/deploy-frontend.yml`, which builds with npm and deploys
`dist/`. The live site is still on Netlify with a broken build (no
`VITE_API_URL`); that is the pending cutover, not the intended state.

Whoever builds it must provide `VITE_API_URL`. The workflow also greps the
built bundle for `localhost:9000` and fails the deploy if it appears, so the
original breakage cannot recur silently.

`frontend/Dockerfile` + `nginx.conf` remain for local compose only; Pages does
not use Docker.
