# ============================================
# ResearchFlow Orchestrator - Node.js Service
# ============================================
# Build context: repository root (.)

# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Dependencies stage
FROM base AS deps

# Copy root package.json for workspace configuration
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/orchestrator/package.json ./services/orchestrator/

# Copy workspace packages
COPY packages/core/package.json ./packages/core/
COPY packages/core/types ./packages/core/types
COPY packages/core/index.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/policy ./packages/core/policy
COPY packages/core/tsconfig.json ./packages/core/

COPY packages/phi-engine/package.json ./packages/phi-engine/
COPY packages/phi-engine/index.ts ./packages/phi-engine/
COPY packages/phi-engine/src ./packages/phi-engine/src
COPY packages/phi-engine/tsconfig.json* ./packages/phi-engine/

COPY packages/ai-router/package.json ./packages/ai-router/
COPY packages/ai-router/index.ts ./packages/ai-router/
COPY packages/ai-router/src ./packages/ai-router/src
COPY packages/ai-router/tsconfig.json* ./packages/ai-router/

# Install all dependencies (workspace-aware)
RUN npm ci --workspace=services/orchestrator --include-workspace-root

# Development stage
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/orchestrator ./services/orchestrator
COPY services/orchestrator/ ./services/orchestrator/

WORKDIR /app/services/orchestrator
ENV NODE_ENV=development
EXPOSE 3001

CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/orchestrator ./services/orchestrator
COPY services/orchestrator/ ./services/orchestrator/

WORKDIR /app/services/orchestrator
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=build /app/services/orchestrator/dist ./dist
COPY --from=build /app/services/orchestrator/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

# Create data directories
RUN mkdir -p /data/artifacts /data/logs /data/manifests && \
    chown -R nodejs:nodejs /data

USER nodejs

ENV NODE_ENV=production
EXPOSE 3001

# Note: HEALTHCHECK removed in favor of Kubernetes liveness/readiness probes
# See infrastructure/kubernetes/base/orchestrator-deployment.yaml for probe configuration

CMD ["node", "dist/index.js"]
