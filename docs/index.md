# ResearchFlow Documentation

Welcome to the ResearchFlow documentation. ResearchFlow is a comprehensive clinical research workflow platform designed to streamline the research process from topic selection to publication.

## Overview

ResearchFlow provides a 20-stage guided workflow pipeline that helps researchers:

- **Plan** their research with structured topic development and literature review
- **Execute** studies with IRB protocol generation and statistical planning
- **Publish** results with AI-powered manuscript generation and conference preparation

## Quick Links

| Section | Description |
|---------|-------------|
| [Quick Start](getting-started/quickstart.md) | Get up and running in 5 minutes |
| [Installation](getting-started/installation.md) | Full installation guide |
| [Architecture](architecture/overview.md) | System design and components |
| [API Reference](api/orchestrator.md) | Complete API documentation |

## Key Features

### 20-Stage Workflow Pipeline

ResearchFlow guides you through the complete research lifecycle:

1. **Discovery** (Stages 1-5): Topic selection, literature review, feasibility
2. **Planning** (Stages 6-10): IRB protocols, statistical plans, data collection
3. **Execution** (Stages 11-15): Data analysis, results generation
4. **Publication** (Stages 16-20): Manuscript writing, journal targeting, conference prep

### PHI-Safe by Design

- **Fail-Closed Architecture**: If PHI detection fails, operations are blocked
- **No Raw PHI in Responses**: Only locations, hashes, or categories returned
- **DEMO Mode**: Fully functional offline with synthetic data
- **Audit Trail**: Complete logging without PHI content

### AI-Powered Assistance

- Literature search and synthesis
- Statistical analysis recommendations
- Manuscript draft generation
- Conference poster and slides creation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web UI (React)                          │
│  - Workflow Pipeline    - Manuscript Editor    - Conference UI  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────▼───────────────────────────────────┐
│                     Orchestrator (Node.js)                      │
│  - API Gateway        - Auth/RBAC          - Route Handlers     │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP
┌─────────────────────────────▼───────────────────────────────────┐
│                       Worker (Python)                           │
│  - AI Processing      - PHI Scanner        - Document Gen       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    PostgreSQL + Redis                           │
│  - Research Data      - Session Cache      - Job Queue          │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Help

- **Documentation**: Browse this site for guides and references
- **Issues**: [Open an issue](https://github.com/ry86pkqf74-rgb/researchflow-production/issues) for bugs or features
- **Contributing**: See our [Contributing Guide](development/contributing.md)

## License

ResearchFlow is proprietary software. See LICENSE for details.
