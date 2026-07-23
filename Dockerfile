# =============================================================
# BFP — Business Flow Pro | Multi-stage Production Dockerfile
# =============================================================
# Stage 1 : Install all workspace dependencies
# Stage 2 : Build frontend (Vite) + API server (esbuild)
# Stage 3 : Minimal production image (Node 22 slim)
# =============================================================

# ── Stage 1: base ─────────────────────────────────────────────
FROM node:22-slim AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

COPY lib/db/package.json                       ./lib/db/
COPY lib/api-zod/package.json                  ./lib/api-zod/
COPY lib/api-client-react/package.json         ./lib/api-client-react/
COPY artifacts/api-server/package.json         ./artifacts/api-server/
COPY artifacts/business-automation/package.json ./artifacts/business-automation/

RUN pnpm install --frozen-lockfile


# ── Stage 2: builder ──────────────────────────────────────────
FROM base AS builder

COPY . .

ARG VITE_API_BASE_URL=/api
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ENV PORT=8080
ENV NODE_ENV=production

# Build React frontend
RUN pnpm --filter @workspace/business-automation run build

# Build Express API server (esbuild bundle → single CJS file)
RUN pnpm --filter @workspace/api-server run build


# ── Stage 3: production runner ────────────────────────────────
FROM node:22-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy bundled server
COPY --from=builder /app/artifacts/api-server/dist/index.cjs ./server.cjs

# Copy built frontend static files (served by Express in production)
COPY --from=builder /app/artifacts/business-automation/dist/public ./public

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "server.cjs"]
