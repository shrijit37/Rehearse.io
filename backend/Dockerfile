# Rehearse.io API. Multi-stage Bun build, non-root runtime.
# Adapted from templates/Dockerfile.node per the platform Docker standard.
# Shared build arg: the CI bakes the git SHA into the runtime image so
# GET /health can report it as `version` and the deploy gate can tell a
# new container from a stale one.
ARG APP_VERSION=unknown

FROM oven/bun:1.4.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
ARG APP_VERSION
WORKDIR /app
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
# Typecheck in the build so a broken image never reaches the registry.
RUN bunx tsc --noEmit

FROM oven/bun:1.4.3-alpine AS runtime
ARG APP_VERSION
WORKDIR /app
ENV NODE_ENV=production
ENV APP_VERSION=${APP_VERSION}

# Migrations ship with the image so Dokploy can run them at release.
COPY package.json bun.lock drizzle.config.ts tsconfig.json ./
COPY drizzle ./drizzle
RUN bun install --frozen-lockfile --production && \
    addgroup -S rehearse && adduser -S -G rehearse rehearse

COPY --from=build /app/src ./src

USER rehearse
EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:9000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "src/server.ts"]
