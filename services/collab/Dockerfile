# Collaboration Service Dockerfile
# Yjs-based real-time collaboration server

FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY services/collab/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY services/collab/tsconfig.json ./
COPY services/collab/src ./src

# Copy shared packages
COPY packages/core ./node_modules/@researchflow/core
COPY packages/phi-engine ./node_modules/@researchflow/phi-engine

# Build TypeScript
RUN npm run build || echo "Build step (optional)"

# Expose WebSocket port
EXPOSE 1234

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:1234/health || exit 1

# Start server
CMD ["npm", "run", "dev"]
