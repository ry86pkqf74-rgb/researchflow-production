# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/phi-engine/package.json ./packages/phi-engine/
COPY packages/ai-router/package.json ./packages/ai-router/
COPY packages/manuscript-engine/package.json ./packages/manuscript-engine/
COPY services/manuscript-service/package.json ./services/manuscript-service/

# Install dependencies
RUN npm ci --workspace=services/manuscript-service

# Copy source code
COPY packages/core ./packages/core
COPY packages/phi-engine ./packages/phi-engine
COPY packages/ai-router ./packages/ai-router
COPY packages/manuscript-engine ./packages/manuscript-engine
COPY services/manuscript-service ./services/manuscript-service

# Build packages and service
RUN npm run build -w packages/core
RUN npm run build -w packages/phi-engine
RUN npm run build -w packages/ai-router
RUN npm run build -w packages/manuscript-engine
RUN npm run build -w services/manuscript-service

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/phi-engine/dist ./packages/phi-engine/dist
COPY --from=builder /app/packages/phi-engine/package.json ./packages/phi-engine/
COPY --from=builder /app/packages/ai-router/dist ./packages/ai-router/dist
COPY --from=builder /app/packages/ai-router/package.json ./packages/ai-router/
COPY --from=builder /app/packages/manuscript-engine/dist ./packages/manuscript-engine/dist
COPY --from=builder /app/packages/manuscript-engine/package.json ./packages/manuscript-engine/
COPY --from=builder /app/services/manuscript-service/dist ./services/manuscript-service/dist
COPY --from=builder /app/services/manuscript-service/package.json ./services/manuscript-service/

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["node", "services/manuscript-service/dist/index.js"]
