# Manuscript Engine Runbook

## Overview

The Manuscript Engine provides IMRaD structure generation, abstract creation, and section building services for scientific manuscripts.

## Prerequisites

- Node.js 20+
- Access to AI router (for LLM-powered features)
- PHI engine configured

## Environment Variables

```bash
# Required
GOVERNANCE_MODE=DEMO|LIVE

# AI Router (for LLM features)
AI_ROUTER_URL=http://localhost:3002
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key

# PHI Scanning
PHI_SCAN_ENABLED=true
PHI_FAIL_CLOSED=true
```

## How to Run Locally

### 1. Build the Package

```bash
cd packages/manuscript-engine
npm run build
```

### 2. Run Tests

```bash
npm test
```

### 3. Use in Development

The manuscript engine is imported by the orchestrator automatically.

## IMRaD Structure Services

### Introduction Builder

Generates introduction sections from research context:

```typescript
import { IntroductionBuilderService } from '@researchflow/manuscript-engine';

const builder = new IntroductionBuilderService();
const intro = await builder.generate({
  topic: "Diabetes management",
  researchQuestion: "How does continuous glucose monitoring affect HbA1c?",
  backgroundBullets: ["CGM adoption increasing", "Real-time data benefits"],
  gapBullets: ["Limited long-term outcome data"],
  objectives: ["Evaluate 12-month HbA1c outcomes"],
});
```

### Methods Populator

Generates methods sections from study parameters:

```typescript
import { MethodsPopulatorService } from '@researchflow/manuscript-engine';

const methods = new MethodsPopulatorService();
const section = await methods.generate({
  studyDesign: "Retrospective cohort study",
  population: "Adults with Type 2 diabetes",
  inclusionCriteria: ["Age 18-80", "HbA1c > 7.0%"],
  outcomes: ["Primary: HbA1c change at 12 months"],
  statsPlan: "Linear mixed models with random intercepts",
});
```

### Abstract Generator

Generates structured or narrative abstracts:

```typescript
import { abstractGeneratorService } from '@researchflow/manuscript-engine';

const abstract = await abstractGeneratorService.generateAbstract({
  style: "structured",  // or "narrative"
  background: "CGM technology has improved...",
  methods: "We conducted a retrospective cohort study...",
  results: "Among 1,234 patients...",
  conclusions: "CGM use was associated with...",
  targetJournal: "JAMA",
  maxWords: 300,
});
```

## Journal Templates

Supported templates (via `ManuscriptAssemblerService`):

| Template | Journal Style | Max Abstract |
|----------|--------------|--------------|
| IMRAD_DEFAULT | Standard | 250 words |
| JAMA | JAMA Network | 350 words |
| NEJM | New England Journal | 250 words |
| LANCET | Lancet family | 300 words |
| THYROID | Thyroid journals | 250 words |

## PHI Governance

All manuscript services enforce PHI scanning:

- **DEMO mode**: Warnings logged, generation proceeds
- **LIVE mode**: PHI detected = generation blocked (fail-closed)

Override requires explicit approval via governance routes.

## Troubleshooting

### "PHI detected in input"

1. Check input text for patient identifiers
2. Use de-identification service first
3. In DEMO mode, warnings are logged but generation proceeds

### "AI router timeout"

1. Check AI router is running
2. Verify API keys are set
3. Check model tier configuration

### "Word count exceeded"

1. Use `maxWords` constraint
2. Enable auto-truncation
3. Request AI re-write with stricter limits

## Testing

```bash
# Unit tests
cd packages/manuscript-engine
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

## Related Documentation

- [packages/manuscript-engine/src/services/](../../packages/manuscript-engine/src/services/) - Service implementations
- [packages/core/types/](../../packages/core/types/) - Type definitions
- [docs/PHASE_F_OBSERVABILITY_FEATUREFLAGS.md](../PHASE_F_OBSERVABILITY_FEATUREFLAGS.md) - Feature flags
