# Agentic Planning Pipeline

## Overview

The Agentic Planning Pipeline provides AI-assisted statistical analysis with PHI protection and governance controls. It enables researchers to create, approve, and execute analysis plans with full audit trails.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│   analysis-planner.tsx  |  planning.ts (API client)            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Orchestrator (Node.js)                       │
│   analysis-planning.ts (routes)                                │
│   planning.service.ts (business logic)                         │
│   phi-gate.ts (PHI protection)                                 │
│   queue.ts (BullMQ job queue)                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      Worker (Python)                            │
│   agentic/pipeline.py (execution)                              │
│   agentic/schema_introspect.py (profiling)                     │
│   agentic/stats_selector.py (method selection)                 │
│   agentic/stats_executor.py (analysis)                         │
│   agentic/safe_query.py (SQL safety)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### PHI Protection
- **Metadata-only to AI**: In LIVE mode, only column names and types (never actual data) are sent to external AI for plan generation
- **Fail-closed**: PHI gate blocks all operations if PHI detection fails
- **Pattern detection**: Scans research questions for common PHI patterns (SSN, MRN, names, etc.)

### SELECT-only Enforcement
- All data queries are validated to be SELECT-only
- INSERT, UPDATE, DELETE, DROP, ALTER, etc. are blocked
- Row limits enforced to prevent data exfiltration
- Parameterized queries only (no SQL injection)

### Governance Workflow
```
draft → pending_approval → approved → running → completed
                        ↘ rejected              ↘ failed
```

- **DEMO mode**: Plans auto-approve (no governance gates)
- **LIVE mode**: Plans require STEWARD/ADMIN approval before execution

## API Endpoints

### Plans
- `POST /api/analysis/plans` - Create new plan
- `GET /api/analysis/plans` - List user's plans
- `GET /api/analysis/plans/:planId` - Get plan details
- `POST /api/analysis/plans/:planId/approve` - Approve/reject plan
- `POST /api/analysis/plans/:planId/run` - Execute approved plan

### Jobs
- `GET /api/analysis/jobs/:jobId` - Get job status
- `GET /api/analysis/jobs/:jobId/events` - SSE stream for job events

### Artifacts
- `GET /api/analysis/artifacts` - List artifacts (filter by job/plan/type)

## Database Schema

### Tables
- `analysis_plans` - Plan definitions and status
- `analysis_jobs` - Job execution records
- `analysis_artifacts` - Generated outputs
- `analysis_job_events` - Event log for SSE streaming

## Plan Specification

```json
{
  "version": "1.0",
  "generatedAt": "2024-01-27T10:00:00Z",
  "stages": [
    {
      "stageId": "extract_data",
      "stageType": "extraction",
      "name": "Data Extraction",
      "description": "Extract relevant data from dataset",
      "config": {
        "columns": ["age", "treatment", "outcome"],
        "filters": []
      },
      "dependsOn": []
    },
    {
      "stageId": "run_ttest",
      "stageType": "analysis",
      "name": "T-Test Analysis",
      "description": "Compare outcome between treatment groups",
      "config": {
        "method": "independent_ttest",
        "dependent": "outcome",
        "grouping": "treatment"
      },
      "dependsOn": ["extract_data"]
    }
  ],
  "statisticalMethods": [
    {
      "method": "independent_ttest",
      "rationale": "Compare means between two independent groups",
      "assumptions": [
        "Normal distribution of outcome",
        "Equal variances (Levene's test)",
        "Independence of observations"
      ],
      "variables": {
        "dependent": "outcome",
        "independent": ["treatment"]
      }
    }
  ],
  "expectedOutputs": [
    {
      "name": "t_test_results",
      "type": "table",
      "description": "Statistical test results"
    }
  ]
}
```

## Statistical Methods Supported

### Comparison Tests
- Independent t-test
- Paired t-test
- One-way ANOVA
- Kruskal-Wallis test
- Mann-Whitney U test
- Chi-square test
- Fisher's exact test

### Correlation & Regression
- Pearson correlation
- Spearman correlation
- Linear regression
- Logistic regression

### Survival Analysis
- Kaplan-Meier curves
- Log-rank test
- Cox proportional hazards

## Usage Example

```typescript
import { planningApi } from '@/lib/api/planning';

// Create a plan
const { plan, job } = await planningApi.createPlan({
  datasetId: 'dataset-123',
  name: 'Treatment Effect Analysis',
  researchQuestion: 'Does the treatment improve outcomes compared to control?',
  planType: 'comparative',
  datasetMetadata: {
    name: 'Clinical Trial Data',
    columns: [
      { name: 'treatment', type: 'categorical' },
      { name: 'outcome', type: 'numeric' },
      { name: 'age', type: 'numeric' }
    ]
  }
});

// Subscribe to job progress
const unsubscribe = planningApi.subscribeToJobEvents(
  job.id,
  (event) => console.log('Progress:', event.job.progress),
  (error) => console.error('Error:', error)
);

// After plan is generated and approved, run it
await planningApi.runPlan(plan.id, { executionMode: 'full' });
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOVERNANCE_MODE` | DEMO or LIVE | DEMO |
| `PLANNING_MODEL` | AI model for plan generation | gpt-4 |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `REDIS_URL` | Redis URL for job queue | redis://redis:6379 |
| `WORKER_URL` | Python worker URL | http://worker:8000 |

## Security Considerations

1. **PHI Protection**: Never send actual data values to external AI services
2. **Query Safety**: All SQL queries are validated and parameterized
3. **Governance Gates**: LIVE mode requires explicit approval for plan execution
4. **Audit Trail**: All events logged for compliance
5. **Row Limits**: Prevent bulk data extraction

## Testing

```bash
# Run Python tests
cd services/worker
pytest src/agentic/tests/ -v

# Run TypeScript tests (if available)
cd services/orchestrator
npm test
```
