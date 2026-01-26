# ============================================
# ResearchFlow Collab - Real-time Collaboration Server
# ============================================
# Build context: repository root (.)
# Stages: base → deps → build → development | production
#
# Usage:
#   Development: docker build --target development -t collab:dev .
#   Production:  docker build --target production -t collab:prod .

# ===================
# Base stage - Alpine with build tools
# ===================
FROM node:20-alpine AS base

# OCI Image Labels
LABEL org.opencontainers.image.title="ResearchFlow Collab"
LABEL org.opencontainers.image.description="Yjs-based real-time collaboration server for document editing"
LABEL org.opencontainers.image.vendor="ResearchFlow"
LABEL org.opencontainers.image.source="https://github.com/ry86pkqf74-rgb/researchflow-production"

WORKDIR /app

# Install build dependencies (only needed for npm install with native modules)
# Use py3-pip which pulls in python3 correctly on newer Alpine versions
RUN apk add --no-cache --update python3 py3-pip make g++ || apk add --no-cache make g++

# ===================
# Dependencies stage - Install npm packages
# ===================
FROM base AS deps

# Copy package files
COPY services/collab/package*.json ./

# Copy workspace packages needed for file: dependencies
COPY packages/core/package.json ./packages/core/
COPY packages/core/types ./packages/core/types
COPY packages/core/index.ts ./packages/core/
COPY packages/core/src ./packages/core/src

COPY packages/phi-engine/package.json ./packages/phi-engine/
COPY packages/phi-engine/index.ts ./packages/phi-engine/
COPY packages/phi-engine/src ./packages/phi-engine/src

# Install all dependencies (including devDependencies for build)
RUN npm install

# ===================
# Build stage - Compile TypeScript
# ===================
FROM base AS build

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY services/collab/tsconfig.json ./
COPY services/collab/src ./src

# Ensure @researchflow packages are accessible
RUN mkdir -p ./node_modules/@researchflow && \
    rm -rf ./node_modules/@researchflow/core ./node_modules/@researchflow/phi-engine && \
    cp -r ./packages/core ./node_modules/@researchflow/core && \
    cp -r ./packages/phi-engine ./node_modules/@researchflow/phi-engine

# Build TypeScript to JavaScript
RUN npm run build

# ===================
# Development stage - Hot reload with tsx
# ===================
FROM base AS development

WORKDIR /app

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY services/collab/ ./

# Ensure @researchflow packages are accessible
RUN mkdir -p ./node_modules/@researchflow && \
    rm -rf ./node_modules/@researchflow/core ./node_modules/@researchflow/phi-engine && \
    cp -r ./packages/core ./node_modules/@researchflow/core && \
    cp -r ./packages/phi-engine ./node_modules/@researchflow/phi-engine

ENV NODE_ENV=development
EXPOSE 1234

# Development uses tsx watch for hot reload
CMD ["npm", "run", "dev"]

# ===================
# Production stage - Minimal runtime image
# ===================
FROM node:20-alpine AS production

# OCI Image Labels
LABEL org.opencontainers.image.title="ResearchFlow Collab"
LABEL org.opencontainers.image.description="Yjs-based real-time collaboration server for document editing"
LABEL org.opencontainers.image.vendor="ResearchFlow"

WORKDIR /app

# Install only runtime dependencies (curl for healthcheck)
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy only production node_modules (prune devDeps would be ideal, but we copy all for now)
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled JavaScript output
COPY --from=build /app/dist ./dist

# Copy package.json for npm start script
COPY services/collab/package.json ./

# Ensure @researchflow packages are in node_modules
COPY --from=build /app/node_modules/@researchflow ./node_modules/@researchflow

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment
ENV NODE_ENV=production

# Expose WebSocket port
EXPOSE 1234

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:1234/health || exit 1

# Production uses compiled JavaScript
CMD ["npm", "run", "start"]
