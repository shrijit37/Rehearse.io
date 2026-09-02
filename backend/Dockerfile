FROM oven/bun:1.3 AS build
WORKDIR /app

# Copy dependency definition files
COPY package.json bun.lock ./

# Install all dependencies (dev deps are required for TS type resolution at runtime)
RUN bun install --frozen-lockfile

FROM oven/bun:1.3
WORKDIR /app

ENV NODE_ENV=production

# Copy installed dependencies and source
COPY --from=build /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY tsconfig.json ./
COPY src ./src

# Create non-root user (oven/bun:1.3 is Debian-based; use groupadd/useradd)
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser
USER appuser

# Expose backend port
EXPOSE 9000

# Start command
CMD ["bun", "src/server.ts"]