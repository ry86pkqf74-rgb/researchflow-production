# ADR 0001: Node Orchestrator + Python Worker Split

## Status

Accepted

## Context

ResearchFlow requires both:
1. A responsive API layer for web clients with real-time capabilities
2. Heavy compute capabilities for statistical analysis, data processing, and ML workloads

Single-language solutions presented trade-offs:
- Node.js: Excellent for I/O-bound API work, poor for CPU-intensive data science
- Python: Excellent for data science, less mature for high-concurrency API servers

## Decision

Split the backend into two services:

1. **Node.js Orchestrator**
   - Handles HTTP API requests
   - Manages authentication and authorization (RBAC)
   - Coordinates job scheduling via BullMQ
   - Provides real-time WebSocket capabilities
   - Handles PHI governance and audit logging

2. **Python Worker**
   - Processes compute-intensive jobs from the queue
   - Performs statistical analysis (scipy, statsmodels)
   - Runs data validation (pandera, pandas)
   - Generates artifacts and figures
   - Executes ML inference

Communication between services uses:
- Redis/BullMQ for job queuing (async)
- HTTP callbacks for job completion notifications
- Shared PostgreSQL for persistent state

## Consequences

### Positive
- Best-of-both-worlds: Node.js for APIs, Python for data science
- Independent scaling: Workers can scale based on queue depth
- Technology flexibility: Each service uses optimal libraries
- Fault isolation: Worker failures don't affect API availability

### Negative
- Operational complexity: Two different runtimes to maintain
- Serialization overhead: Job data must be serialized between services
- Debugging complexity: Distributed tracing needed across services
- Deployment coordination: Version compatibility must be managed

### Mitigations
- Shared schemas (JSON Schema) for job definitions
- OpenTelemetry for distributed tracing
- Docker Compose for local development parity
- Semantic versioning and contract testing
