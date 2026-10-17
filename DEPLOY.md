# Deployment — Rehearse.io (Dokploy API + Cloudflare Pages frontend)

Two independent deploy families. Keep them apart:

| Family | Workflow | Trigger | Target |
|---|---|---|---|
| API (backend) | `.github/workflows/deploy-backend.yml` | push to `main` touching `backend/**` (not `backend/**/*.md`), `frontend/package.json`, `frontend/package-lock.json`, `scripts/**`, `deploy/compose.prod.yml`, or the workflow itself | GHCR image → Dokploy **compose app** → health gate |
| Frontend | `.github/workflows/deploy-frontend.yml` | push to `main` touching `frontend/**` or the workflow itself | Cloudflare Pages (`dist/`) — no server |

`.github/workflows/ci.yml` validates PRs only; `.github/workflows/server-debug.yml`
is dispatch-only SSH diagnostics and deploys nothing.

## The rule

Push to `main` and nothing else. Both workflows also accept
`workflow_dispatch` — use it to redeploy after a vault-only or Cloudflare
token change, since neither pipeline reads the other one's config.

**Backend CI**: `test` (Postgres 18 container, `./scripts/setup`,
`./scripts/migrate`, live server, `./scripts/test`) → `lint` (`npm ci` in
`frontend/`, `./scripts/lint`) → `build` (multi-arch image pushed to GHCR
tagged with the full commit SHA, `APP_VERSION` build-arg baked in) → `scan`
(Trivy, fails on HIGH/CRITICAL) → `deploy-prod` (main only: Doppler fetch with
`secrets.DOPPLER_TOKEN` → `./scripts/migrate` against the external DB →
`compose.update` with
`deploy/compose.prod.yml` and the SHA tag → `compose.deploy` → `scripts/health`).
`deploy-prod` is gated on `github.ref == 'refs/heads/main'`.

**Frontend CI**: `lint` → `build` (`npm run build`, `VITE_API_URL` baked in) →
`verify-api-url` (fails if `localhost:9000` appears in `dist/assets`) →
`deploy` (main only: `cloudflare/wrangler-action@v3`,
`pages deploy dist --project-name=${{ vars.PAGES_PROJECT }} --branch=main`).

No manual prod build from a dev machine: there is no local push path to
Dokploy or Pages, and `scripts/` exposes no deploy script.

One deviation from the fleet standard, forced by this repo:

- It never calls `compose.saveEnvironment` during deploys; the compose app's env
  comes from the Dokploy `doppler-prod` secrets provider (providerType
  `doppler`, service token — the provider that replaced `infisical-prod`), which
  resolves `${{vault.doppler-prod.<SECRET>}}` refs at deploy time. The stored
  env holds only refs — no secret values — plus the non-secret settings listed
  below.

Why a compose app and not a Dokploy *application*: on Dokploy v0.30.8 an
application cannot be made image-sourced. `application.redeploy` runs a nixpacks
build instead of pulling the tag, fails in ~0.3 s with
`Failed to read app source directory`, marks the deployment `error`, and leaves
the previous container answering — the health gate then fails `healthy but stale
version` (2026-10-16, deployment `VsGmFB6hgnAUs-8EXsFAP`). The compose app
`6P05YIEVfP-ETKhCNUY8Q` pulls the tag and rolls it.

The compose app's env (Dokploy → `compose.saveEnvironment`, `createEnvFile: true`)
holds no secret values, only refs and settings:

```text
NODE_ENV=production          APP_ENV=production        PORT=9000        LOG_LEVEL=info
APP_URL=https://api.rehearseio.triptribe.info           AI_SERVICE_URL=http://ai-service:8000
CLIENT_URL=https://rehearseio.triptribe.info            DATABASE_POOL_MAX=10
ALLOWED_ORIGINS=https://rehearse.io.shrijit.tech,https://rehearseio.triptribe.info
RATE_MAX=1000  RATE_WINDOW_MS=900000   AUTH_RATE_MAX=10   AUTH_RATE_WINDOW_MS=900000
DATABASE_URL=${{vault.doppler-prod.REHEARSE_DATABASE_URL}}
DATABASE_URL_EXTERNAL=${{vault.doppler-prod.REHEARSE_DATABASE_URL_EXTERNAL}}
JWT_SECRET=${{vault.doppler-prod.REHEARSE_JWT_SECRET}}
ENCRYPTION_KEY=${{vault.doppler-prod.REHEARSE_ENCRYPTION_KEY}}
AI_SERVICE_API_KEY=${{vault.doppler-prod.REHEARSE_AI_SERVICE_API_KEY}}
```

`ALLOWED_ORIGINS` is the whole CORS allow-list (`backend/src/server.ts:27`): the
browser-facing frontend origin must be in it. It was missing
`https://rehearse.io.shrijit.tech` until 2026-10-16, which left every browser API
call from the Pages frontend blocked (`TypeError: Failed to fetch`) while `curl`
looked perfectly healthy. `APP_VERSION` is *not* set here — the Dockerfile bakes
it from the CI build-arg.

## The deployed apps

| App | Image | Public domain | Port | Notes |
|---|---|---|---|---|
| `rehearse-api` (Dokploy **compose** app, `6P05YIEVfP-ETKhCNUY8Q`, stack `compose-connect-multi-byte-card-95xy74`) | `ghcr.io/shrijit37/rehearse.io:<full-sha>` | `https://api.rehearse.io.shrijit.tech` and `https://api.rehearseio.triptribe.info` | 9000 | GHCR package is public; the compose app pulls anonymously. Let's Encrypt via Traefik. The retired Dokploy application `IcMHdaM_nevmNlv8mP4q4` is stopped and kept for rollback. |
| Frontend (Cloudflare Pages, project `rehearse-io`) | n/a — static `dist/` | `https://rehearse.io.shrijit.tech` (`rehearse-io.pages.dev`) | n/a | No server, no health endpoint. Build-time `VITE_API_URL` is the only API coupling. |
| `ai-service` (FastAPI) | not recorded in this repo | not recorded in this repo | 8000 | No workflow builds or deploys it. Nothing in this repo deploys it today. |
| PostgreSQL `rehearse_io_prod` | shared instance, outside this repo | none — internal only | 5432 | No public domain by design: it is the shared fleet Postgres, reached from the app container and CI by `DATABASE_URL_EXTERNAL`. |

Domain note, deliberate: Rehearse keeps its **pre-existing API domain**
`api.rehearseio.triptribe.info` rather than adopting the `api.<repo>.shrijit.tech`
convention. The domain predates standardization and is already routed and
certified; do not rename it.

Legacy: `rehearseio.triptribe.info` still serves a stale Netlify build with no
`VITE_API_URL`. It is not part of this pipeline. Retire it (owner action).

## Health

Contract: `GET /health` → `{status, service, version, checks}`. 200 when the
database probe passes, 503 when it fails — this repo has no `degraded` tier.
Route lives at `backend/src/server.ts:108`.

| Check | Probes | On failure |
|---|---|---|
| `database` | `checkDb()` → `SELECT 1` against the app's Postgres pool (`backend/src/db/index.ts:32`) | `status: "down"`, HTTP 503, keeps retrying — only `ok` passes the gate |

`service` is the literal `"rehearse-api"`. `version` is
`process.env.APP_VERSION`, set by the Dockerfile from the build-arg — that is
the full commit SHA. CI passes it as `EXPECTED_VERSION` so a healthy-but-stale
container cannot pass the gate.

Gate: `./scripts/health` against `${{ vars.APP_URL }}/health`. Requires
`APP_URL`; polls every 5s with a 600s deadline (10s per curl), matches
`"status":"ok"`, then — when `EXPECTED_VERSION` is set — matches
`"version":"<sha>"`, re-polling every 6s within the same deadline.

There is no `/ready` route: it was dropped in `a2ddf7c` in favour of the uniform
contract above, and a request returns `404`.

## Secrets

App secrets live in **Doppler** — project `platform`, config `prd` (one flat
namespace; this repo's keys carry the `REHEARSE_` prefix). No project slug or
prefix repo variable exists any more: the read-only, config-scoped service
token in `secrets.DOPPLER_TOKEN` is already scoped to that project/config.
STATE.md lists five prod secrets:
`REHEARSE_DATABASE_URL`, `REHEARSE_DATABASE_URL_EXTERNAL`,
`REHEARSE_JWT_SECRET`, `REHEARSE_ENCRYPTION_KEY`,
`REHEARSE_AI_SERVICE_API_KEY`. Names for anything else are not recorded in
this repo.

They reach the container two ways:

- **The app** — Dokploy's `doppler-prod` secrets provider expands
  `${{vault.doppler-prod.<SECRET>}}` env refs at deploy time. No value is stored
  in this repo.
- **CI** — `dopplerhq/cli-action@v4`, authenticated with
  `secrets.DOPPLER_TOKEN`. The deploy job fetches only
  `REHEARSE_DATABASE_URL_EXTERNAL` (to run migrations) via
  `doppler secrets get … --plain --silent`, masking the value with
  `::add-mask::` before it reaches `GITHUB_ENV`. The test job fetches
  `REHEARSE_SMOKE_EMAIL` and `REHEARSE_SMOKE_PASSWORD` the same way and maps
  them onto `SMOKE_EMAIL` / `SMOKE_PASSWORD` in the Test step.

To rotate a prod secret: update it in Doppler `platform`/`prd`, then dispatch
`deploy-backend` — the `deploy-prod` job redeploys and Dokploy re-resolves the
refs. Vault-only changes never touch git, so `workflow_dispatch` exists.

`REHEARSE_GROQ_API_KEY` is deliberately absent (never created; the only key
available was compromised). Voice and DSA features error until it exists.

**Voice (Live API).** The spoken-session transport expects
`GEMINI_API_KEY` in the app env, added as
`${{vault.doppler-prod.REHEARSE_GEMINI_API_KEY}}` alongside the refs above
(see `VOICE.md` for the provider decision). It is **not provisioned yet**: while
it is unset, `POST /api/live/session` answers `503 Voice sessions are not
configured on this server` and every other route is unaffected, so the backend
boots and deploys without it. The socket itself is `wss://<api-host>/ws/live`,
upgraded from the same HTTP server and port as the REST API — there is no second
service and no separate Traefik router. **Long-lived upgrades through this
Traefik have not been proven**: nothing has ever held a WebSocket open through
this proxy, so the first deployment that enables voice must confirm a socket
stays up past five minutes before an interview is trusted to it.

Repo secrets the *pipeline* needs — not app secrets: `DOPPLER_TOKEN`,
`DOKPLOY_API_KEY`, `GHCR_PULL_TOKEN`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`. (`GHCR_PULL_TOKEN` is a long-lived pull token; the
workflow comment notes ephemeral `GITHUB_TOKEN` expires and poisons later
pulls — outage 2026-10-09.) CI authenticates to Doppler with that single
read-only, config-scoped service token: no client credentials and no OIDC
identity are involved any more. *Historical, pre-cutover:* the OIDC identity
needed the subject glob `repo:shrijit37/Rehearse.io:*` because the job's
`environment: prod` appends `:environment:prod` to the claim.

## Repo configuration

Backend workflow (`deploy-backend.yml`):

| Name | Kind | Value / meaning |
|---|---|---|
| `secrets.DOPPLER_TOKEN` | secret | read-only, config-scoped Doppler service token (project `platform`, config `prd`) |
| `vars.DOKPLOY_URL` | variable | Dokploy base URL (org) |
| `vars.DOKPLOY_COMPOSE_ID` | variable | backend compose app id (`6P05YIEVfP-ETKhCNUY8Q`) |
| `vars.APP_URL` | variable | `https://api.rehearseio.triptribe.info` |
| `secrets.DOKPLOY_API_KEY` | secret | Dokploy API key (redeploy trigger only) |
| `secrets.GHCR_PULL_TOKEN` | secret | long-lived GHCR pull token — no longer used by the deploy step (public package, anonymous pull); kept until nothing references it |

Frontend workflow (`deploy-frontend.yml`):

| Name | Kind | Value / meaning |
|---|---|---|
| `vars.PAGES_PROJECT` | variable | Cloudflare Pages project name |
| `vars.VITE_API_URL` | variable | API base baked into the bundle |
| `secrets.CLOUDFLARE_API_TOKEN` | secret | Pages-write-scoped CF token |
| `secrets.CLOUDFLARE_ACCOUNT_ID` | secret | CF account id |

Also present in the repo but not part of either deploy: the legacy `DEPLOY_*`
secrets used by `server-debug.yml`, and the `GITHUB_TOKEN` with
`packages: write` for the GHCR push. CI reads no `INFISICAL_*` value at all —
`secrets.DOPPLER_TOKEN` is its only vault credential.

## When the gate fails

| Symptom | Cause |
|---|---|
| `no matching manifest for linux/arm64/v8`, Traefik serves 502 | The deploy server is linux/arm64. An amd64-only image is rejected by Swarm. Build both platforms; `docker/setup-qemu-action@v3` with `platforms: arm64` is required. |
| Docker refuses the tag: `repository name must be lowercase` | `github.repository` preserves `Rehearse.io` capitalization. The workflow hardcodes `IMAGE: ghcr.io/shrijit37/rehearse.io`. |
| OIDC 403 in CI *(historical — resolved by the Doppler cutover: CI authenticates with `secrets.DOPPLER_TOKEN`, so there is no OIDC subject left to bind)* | The OIDC subject bound to the Infisical identity did not include the job's claim. With `environment: prod` the claim was `repo:…:environment:prod`, so the subject had to be bound as the glob `repo:shrijit37/Rehearse.io:*`. |
| Deploy "succeeds" but nothing changes | Wrong Dokploy router notation. This version serves `/api/<router>.<procedure>`; the slashed form 404s and silently never redeploys. |
| Later image pulls fail after an otherwise good deploy | `GITHUB_TOKEN` stored as registry credentials — it expires and poisons later pulls (outage 2026-10-09). Use the long-lived `GHCR_PULL_TOKEN`, or clear credentials entirely and pull anonymously from the public package. |
| `NOT HEALTHY: …/health (gave up after 600s)` | Probed seconds after a redeploy, while Swarm is still pulling the image. The gate retries; if it is genuinely down, check the app's container state rather than re-running the gate. |
| `FAIL: …/health version mismatch (expected <sha>)` | The old container is still answering. Check that `compose.update` really stored the new tag (`compose.one`) and that the multi-arch manifest for that SHA exists in GHCR. |
| `healthy but stale version (waiting for <sha>)` | Logged while the gate waits out a converging rollout. Harmless on its own; only fatal at the deadline. |
| Frontend deploy green but the app calls localhost | `VITE_API_URL` unset. `verify-api-url` catches this with `Built bundle references localhost:9000 - VITE_API_URL was not set.` |
| Prod 404s/500s on every authenticated route after a deploy | Migrations did not run — prod ends up with zero tables. That step must fail loudly. STATE.md records a deploy where a swallowed migration error left the database empty. |

Diagnose a "done" deployment with the Dokploy REST API, not the status:
`GET /api/deployment.readLogs?deploymentId=&tail=` and
`GET /api/docker.getServiceContainersByAppName?appName=`.

## What goes in git (and what never does)

In git:

- `backend/src`, `backend/drizzle` (versioned SQL migrations), `backend/Dockerfile`
- `.github/workflows/{ci,deploy-backend,deploy-frontend,server-debug}.yml`
- `platform.yaml`, `frontend/platform.yaml`, `.env.example`, `.gitignore`
- `scripts/{setup,dev,test,lint,build,migrate,health}` — CI calls these, never
  framework commands directly

Never in git:

- `.env`, `backend/.env`, `frontend/.env`, `ai-service/.env` — git-ignored.
  `.env.example` documents names and safe defaults only.
- Any `REHEARSE_*` secret value. They live in Doppler `platform`/`prd`.
- `DOKPLOY_API_KEY`, `GHCR_PULL_TOKEN`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID` — GitHub secrets.
- Build artifacts: `frontend/dist`, `nohup.out`, `__pycache__/`,
  `test-results/`, `.pnpm-store/`.
- Any live host IP or LAN address; `.env.example` carries documentation-range
  placeholders for the external DB.
