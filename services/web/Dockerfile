# ============================================
# ResearchFlow Web - React Frontend
# ============================================
# Build context: repository root (.)
# Stages: base → deps → build → production
#
# Usage:
#   Production: docker build --target production -t web:prod .

# Base stage
FROM node:20-alpine AS base

# OCI Image Labels
LABEL org.opencontainers.image.title="ResearchFlow Web"
LABEL org.opencontainers.image.description="React frontend for ResearchFlow research workflow platform"
LABEL org.opencontainers.image.vendor="ResearchFlow"
LABEL org.opencontainers.image.source="https://github.com/ry86pkqf74-rgb/researchflow-production"
WORKDIR /app

# Dependencies stage
FROM base AS deps

# Copy package files from web service
COPY services/web/package.json ./
# Note: package-lock.json should be added for reproducible builds

# Copy packages for type imports (only the types we need)
COPY packages/core/package.json ./packages/core/
COPY packages/core/types ./packages/core/types
COPY packages/core/index.ts ./packages/core/
COPY packages/core/src ./packages/core/src

# Install dependencies
RUN npm install

# Build stage
FROM base AS build
WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy web source files
COPY services/web/ ./

# Build arguments for Vite (must be declared before npm run build)
ARG VITE_API_BASE_URL
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_COLLAB_URL
ARG VITE_APP_MODE
ARG VITE_SENTRY_DSN
ARG VITE_ENABLE_ANALYTICS

# Export as environment variables for Vite build process
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_COLLAB_URL=$VITE_COLLAB_URL
ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_ENABLE_ANALYTICS=$VITE_ENABLE_ANALYTICS

# Build the application (now with access to VITE_* env vars)
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine AS production

# OCI Image Labels (repeated for final stage)
LABEL org.opencontainers.image.title="ResearchFlow Web"
LABEL org.opencontainers.image.description="React frontend for ResearchFlow research workflow platform"
LABEL org.opencontainers.image.vendor="ResearchFlow"

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy external nginx config (maintainable, with security headers)
COPY services/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
