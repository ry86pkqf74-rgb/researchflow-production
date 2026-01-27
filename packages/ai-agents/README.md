# @researchflow/ai-agents

Phase-specific AI agents for the ResearchFlow clinical research workflow.

## Overview

This package provides a registry of specialized AI agents mapped to the 20-stage ResearchFlow workflow. Each agent is optimized for specific tasks within the research pipeline, from data extraction through manuscript preparation and conference submission.

## Installation

```bash
npm install @researchflow/ai-agents
```

## Usage

### Get agents for a workflow stage

```typescript
import { getAgentsForStage, getStageDescription } from '@researchflow/ai-agents';

// Get agents available for stage 7 (Inferential Analysis)
const agents = getAgentsForStage(7);
const description = getStageDescription(7);

console.log(`Stage 7: ${description}`);
agents.forEach(agent => {
  console.log(`- ${agent.name}: ${agent.description}`);
});
```

### Create and use an agent

```typescript
import { createAgent } from '@researchflow/ai-agents';

const agent = createAgent('statistical-analysis');
if (agent) {
  const result = await agent.execute({
    query: 'What statistical test should I use to compare means between two groups?',
    context: {
      dataType: 'continuous',
      groups: 2,
    }
  });
  console.log(result.content);
}
```

### Use the prompt system

```typescript
import { renderPrompt, getPromptSpec } from '@researchflow/ai-agents';

// Get a prompt specification
const spec = getPromptSpec('conference-scout');

// Render with variables
const rendered = renderPrompt('conference-scout', {
  topic: 'Diabetes management in primary care',
  researchType: 'Retrospective cohort study',
});

console.log(rendered.system); // System prompt
console.log(rendered.user);   // User prompt with variables filled in
```

## Workflow Stages

The 20-stage workflow is organized into four phases:

### Data Collection & Extraction (Stages 1-5)
1. Data collection and initial extraction
2. Data validation and cleaning
3. Variable identification
4. Cohort definition
5. Data transformation

### Statistical Analysis (Stages 6-10)
6. Descriptive statistics
7. Inferential analysis
8. Model building
9. Results interpretation
10. Sensitivity analysis

### Manuscript Writing (Stages 11-15)
11. Introduction drafting
12. Methods section
13. Results section
14. Discussion section
15. Abstract and final review

### Conference Preparation (Stages 16-20)
16. Conference identification
17. Abstract preparation
18. Poster design
19. Presentation preparation
20. Submission and follow-up

## Agent Registry

Available agents include:

| Agent ID | Name | Model Tier | PHI Scan |
|----------|------|------------|----------|
| data-extraction | Data Extraction Agent | STANDARD | Yes |
| data-validation | Data Validation Agent | MINI | Yes |
| statistical-analysis | Statistical Analysis Agent | FRONTIER | No |
| manuscript-drafting | Manuscript Drafting Agent | FRONTIER | Yes |
| conference-scout | Conference Scout Agent | MINI | No |
| abstract-generator | Abstract Generator Agent | STANDARD | Yes |
| ... | ... | ... | ... |

## Model Tiers

Agents use different model tiers based on task complexity:

- **NANO**: Lightweight tasks (not currently used)
- **MINI**: Simple tasks, fast responses
- **STANDARD**: Moderate complexity, balanced performance
- **FRONTIER**: Complex reasoning, highest capability

## PHI Safety

Agents marked with `phiScanRequired: true` should have their outputs scanned for Protected Health Information before display. The prompt system includes PHI-safe system prompts that never request actual patient data.

## API

### Registry Functions

- `getAgentsForStage(stage: number): AgentConfig[]`
- `getAgentById(agentId: string): AgentConfig | undefined`
- `getStageDescription(stage: number): string`
- `getAllAgentIds(): string[]`

### Agent Factory

- `createAgent(agentId: string): BaseAgent | null`

### Prompt Functions

- `registerPrompt(spec: PromptSpec): void`
- `getPromptSpec(promptId: string): PromptSpec | undefined`
- `renderPrompt(promptId: string, variables: Record<string, string>): RenderedPrompt | null`
- `listPrompts(): PromptSpec[]`
- `listPromptsByCategory(category: string): PromptSpec[]`

## Development

```bash
# Build
npm run build

# Test
npm test

# Watch mode
npm run test:watch
```

## License

MIT
