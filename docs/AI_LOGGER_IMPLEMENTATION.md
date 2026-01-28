# AI Logger & Agent Roster Implementation

This document summarizes the AI Logger middleware and Agent Roster implementation for ResearchFlow.

## Overview

The implementation adds three key capabilities to the `@researchflow/ai-router` package:

1. **Notion AI Logger** - Automatic logging of all AI API calls to Notion databases
2. **Provider Wrappers** - Claude and OpenAI clients with built-in logging
3. **Agent Roster** - Type definitions for orchestration agents matching the Notion Command Center

## Quick Start

### 1. Environment Variables

Add these to your `.env`:

```bash
# Notion Integration
NOTION_API_KEY=secret_your_token

# Database IDs (from your Notion workspace)
NOTION_API_USAGE_TRACKER_DB=96fe5bba-d3fe-4384-ae9c-0def8a83424d
NOTION_TOOL_USAGE_PLANS_DB=a9c6dde1-7fab-4de9-ba40-9bedeafa62d3

# Optional: Disable logging
# DISABLE_AI_LOGGING=true
```

### 2. Share Databases with Integration

In Notion:
1. Open each database (API Usage Tracker, AI Tool Usage Plans)
2. Click "..." menu → "Add connections"
3. Select "ResearchFlow AI Logger" integration

### 3. Usage

#### Simple Completions with Logging

```typescript
import { claudeComplete, openaiComplete } from '@researchflow/ai-router';

// Claude completion (automatically logged to Notion)
const response = await claudeComplete('Explain this code...', {
  taskType: 'summarize',
  userId: 'user-123',
  researchId: 'research-456',
});

// OpenAI completion (automatically logged)
const result = await openaiComplete('Generate a test...', {
  taskType: 'draft_section',
  model: 'gpt-4o',
});
```

#### Provider Classes for More Control

```typescript
import { getClaudeProvider, getOpenAIProvider } from '@researchflow/ai-router';

// Claude provider
const claude = getClaudeProvider();
const { message, usage, metrics } = await claude.createMessage({
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 1024,
}, {
  taskType: 'classify',
  agentId: 'security-steward',
});

// OpenAI provider with JSON mode
const openai = getOpenAIProvider();
const { data } = await openai.completeJSON<{ tasks: string[] }>('List tasks', {
  taskType: 'extract_metadata',
});
```

#### Direct Logger Access

```typescript
import { getNotionLogger, logAIUsage } from '@researchflow/ai-router';

// Log custom entries
await logAIUsage({
  provider: 'lm-studio',
  model: 'llama-3.1-8b',
  taskType: 'phi_scan',
  inputTokens: 500,
  outputTokens: 100,
  totalTokens: 600,
  estimatedCostUsd: 0, // Local model
  latencyMs: 150,
  status: 'success',
});

// Get budget status
const logger = getNotionLogger();
const budget = await logger?.getBudgetStatus('claude');
if (budget?.shouldAlert) {
  console.warn(`Claude budget ${budget.percentUsed}% used`);
}

// Get usage statistics
const stats = await logger?.getUsageStats({
  provider: 'openai',
  startDate: new Date('2026-01-01'),
});
```

## Agent Roster

The agent roster defines orchestration agents that bind your AI tools together:

```typescript
import { AGENT_ROSTER, TOOL_REGISTRY, getAgentForTaskType } from '@researchflow/ai-router';

// Get agent for a task type
const agent = AGENT_ROSTER[getAgentForTaskType('protocol_reasoning')!];
// Returns: pm-orchestrator

// Check tool capabilities
const claudeCapabilities = TOOL_REGISTRY['claude-pro'];
// { strengths: ['Long context', 'Structured analysis', ...], phiSafe: false, ... }

// Get PHI-safe tools for sensitive data
import { getPhiSafeTools } from '@researchflow/ai-router';
const safeTool = getPhiSafeTools(); // ['lm-studio', 'sourcegraph', 'context7', 'figma']
```

### Available Agents

| Agent | Role | Primary Tools |
|-------|------|---------------|
| `pm-orchestrator` | Convert features to specs/tasks | Claude, ChatGPT |
| `repo-cartographer` | Find code, propose diffs | Sourcegraph, Claude |
| `backend-implementer` | Apply changes, run tests, open PRs | Cursor, Continue, ChatGPT |
| `frontend-implementer` | Implement UI from Figma specs | Cursor, Continue, Figma |
| `qa-release` | CI results, deployment gates | Codex CLI, Sourcegraph |
| `security-steward` | Review RBAC/PHI/auth changes | Claude |
| `figma-agent` | Design-to-code pipeline | Figma, Claude |
| `replit-agent` | Debug sandbox, spike solutions | Replit, Grok |

## File Structure

```
packages/ai-router/src/
├── notion/
│   ├── index.ts           # Notion module exports
│   └── notionLogger.ts    # Notion AI logger middleware
├── providers/
│   ├── index.ts           # Provider exports
│   ├── claude.ts          # Claude wrapper with logging
│   └── openai.ts          # OpenAI wrapper with logging
└── agents/
    ├── index.ts           # Agent exports
    └── roster.ts          # Agent and tool definitions
```

## Notion Database Schema

### API Usage Tracker
- Provider (select)
- Model (text)
- Task Type (select)
- Input Tokens (number)
- Output Tokens (number)
- Total Tokens (number)
- Cost (USD) (number)
- Latency (ms) (number)
- Status (select: success, error, timeout, blocked)
- Timestamp (date)
- Error Message (text, optional)
- Tier (select, optional)
- Escalated (checkbox, optional)
- Research ID (text, optional)
- User ID (text, optional)
- Stage (number, optional)
- Session ID (text, optional)
- Agent ID (text, optional)

### AI Tool Usage Plans
- Provider (select)
- Monthly Budget (number)
- Current Spend (number)
- Alert Threshold (number, 0-1)
- Budget Status (formula)
- Budget Alert (formula)
- Usage Logs (relation to API Usage Tracker)

## Next Steps

1. **Create n8n workflows** to trigger agents on Notion task changes
2. **Implement agent runners** that execute the defined agents
3. **Set up human-in-the-loop gates** for high-risk agents
4. **Configure budget alerts** via Notion automations
