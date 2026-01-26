# ============================================
# ResearchFlow Orchestrator - Node.js Service
# ============================================
# Build context: repository root (.)
# Stages: base → deps → development | production
#
# Usage:
#   Development: docker build --target development -t orchestrator:dev .
#   Production:  docker build --target production -t orchestrator:prod .

# Base stage
FROM node:20-alpine AS base

# OCI Image Labels
LABEL org.opencontainers.image.title="ResearchFlow Orchestrator"
LABEL org.opencontainers.image.description="Node.js API orchestrator for ResearchFlow research workflow platform"
LABEL org.opencontainers.image.vendor="ResearchFlow"
LABEL org.opencontainers.image.source="https://github.com/ry86pkqf74-rgb/researchflow-production"
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache --update python3 py3-pip make g++ git || apk add --no-cache make g++ git

# Dependencies stage
FROM base AS deps

# Copy package files
COPY services/orchestrator/package.json ./

# Copy workspace packages
COPY packages/core/package.json ./packages/core/
COPY packages/core/types ./packages/core/types
COPY packages/core/index.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/policy ./packages/core/policy

COPY packages/phi-engine/package.json ./packages/phi-engine/
COPY packages/phi-engine/index.ts ./packages/phi-engine/
COPY packages/phi-engine/src ./packages/phi-engine/src

COPY packages/ai-router/package.json ./packages/ai-router/
COPY packages/ai-router/index.ts ./packages/ai-router/
COPY packages/ai-router/src ./packages/ai-router/src

# Install dependencies
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY services/orchestrator/ ./

ENV NODE_ENV=development
ENV NODE_PATH=/app/node_modules
EXPOSE 3001

CMD ["npm", "run", "dev"]

# Production stage - using tsx runtime to avoid TypeScript build issues
# Note: Uses tsx for runtime TypeScript execution instead of pre-compiled JS
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY services/orchestrator/ ./

# Ensure @researchflow packages are accessible in node_modules
# (file: dependencies create symlinks that don't transfer between build stages)
RUN mkdir -p ./node_modules/@researchflow && \
    rm -rf ./node_modules/@researchflow/core ./node_modules/@researchflow/phi-engine ./node_modules/@researchflow/ai-router && \
    cp -r ./packages/core ./node_modules/@researchflow/core && \
    cp -r ./packages/phi-engine ./node_modules/@researchflow/phi-engine && \
    cp -r ./packages/ai-router ./node_modules/@researchflow/ai-router

# Create data directories and fix permissions for nodejs user
RUN mkdir -p /data/artifacts /data/logs /data/manifests && \
    chown -R nodejs:nodejs /data /app

USER nodejs

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["npx", "tsx", "index.ts"]
