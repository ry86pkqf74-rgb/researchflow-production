/**
 * Notion Usage Logger Service
 * Automatically logs AI API usage to Notion database for tracking
 */

import { Client } from '@notionhq/client';

// Initialize Notion client (requires NOTION_API_KEY env var)
const notion = process.env.NOTION_API_KEY
  ? new Client({ auth: process.env.NOTION_API_KEY })
  : null;

// Notion database ID for API Usage Tracker
const USAGE_DATABASE_ID = '96fe5bba-d3fe-4384-ae9c-0def8a83424d';

export interface UsageLogEntry {
  name: string;
  provider: 'Claude' | 'ChatGPT Pro' | 'GPT-4' | 'GPT-4o' | 'Grok Expert' | 'Grok' | 'Mercury' | 'LM Studio' | 'Sourcegraph' | 'Context7';
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  taskType: 'Code Generation' | 'Code Review' | 'Refactoring' | 'Documentation' | 'Analysis' | 'Autocomplete' | 'Search' | 'Chat';
  status: 'Success' | 'Error' | 'Rate Limited' | 'Timeout';
  timestamp?: Date;
}

/**
 * Log AI usage to Notion database
 */
export async function logUsageToNotion(entry: UsageLogEntry): Promise<boolean> {
  if (!notion) {
    console.warn('[NotionLogger] NOTION_API_KEY not configured, skipping usage log');
    return false;
  }

  try {
    const timestamp = entry.timestamp || new Date();

    await notion.pages.create({
      parent: { database_id: USAGE_DATABASE_ID },
      properties: {
        'Name': {
          title: [{ text: { content: entry.name } }]
        },
        'Provider': {
          select: { name: entry.provider }
        },
        'Model': {
          rich_text: [{ text: { content: entry.model } }]
        },
        'Input Tokens': {
          number: entry.inputTokens
        },
        'Output Tokens': {
          number: entry.outputTokens
        },
        'Total Tokens': {
          number: entry.totalTokens
        },
        'Cost (USD)': {
          number: entry.costUsd
        },
        'Latency (ms)': {
          number: entry.latencyMs
        },
        'Task Type': {
          select: { name: entry.taskType }
        },
        'Status': {
          select: { name: entry.status }
        },
        'Timestamp': {
          date: { start: timestamp.toISOString() }
        }
      }
    });

    console.log(`[NotionLogger] Logged usage: ${entry.name} (${entry.provider})`);
    return true;
  } catch (error) {
    console.error('[NotionLogger] Failed to log usage:', error);
    return false;
  }
}

/**
 * Batch log multiple usage entries
 */
export async function batchLogUsage(entries: UsageLogEntry[]): Promise<number> {
  let successCount = 0;

  for (const entry of entries) {
    const success = await logUsageToNotion(entry);
    if (success) successCount++;

    // Rate limit: Notion API allows ~3 requests/second
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  return successCount;
}

/**
 * Calculate cost based on provider and tokens
 */
export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    // Per 1K tokens
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'grok-2-latest': { input: 0.002, output: 0.01 },
    'grok-2-mini': { input: 0.0002, output: 0.001 },
    'mercury-coder-small-beta': { input: 0.0001, output: 0.0001 },
    // Free tiers
    'local-model': { input: 0, output: 0 },
    'llama-3.2-3b': { input: 0, output: 0 },
  };

  const modelPricing = pricing[model] || { input: 0, output: 0 };

  return (
    (inputTokens / 1000) * modelPricing.input +
    (outputTokens / 1000) * modelPricing.output
  );
}

/**
 * Map provider string to Notion-compatible provider name
 */
export function mapProviderName(provider: string): UsageLogEntry['provider'] {
  const mapping: Record<string, UsageLogEntry['provider']> = {
    'anthropic': 'Claude',
    'openai': 'GPT-4',
    'openai-pro': 'ChatGPT Pro',
    'xai': 'Grok',
    'xai-expert': 'Grok Expert',
    'mercury': 'Mercury',
    'lm-studio': 'LM Studio',
    'sourcegraph': 'Sourcegraph',
    'context7': 'Context7',
  };

  return mapping[provider.toLowerCase()] || 'Claude';
}

export default {
  logUsageToNotion,
  batchLogUsage,
  calculateCost,
  mapProviderName,
};
