/**
 * Notion AI Logger Middleware
 *
 * Logs all AI API calls to Notion databases for usage tracking, cost analysis,
 * and budget monitoring. Integrates with the API Usage Tracker and AI Tool Usage Plans.
 *
 * @see https://www.notion.so/AI-Logger-Middleware-Implementation-Guide
 */

import { Client } from '@notionhq/client';
import type { AIProvider, AITaskType, ModelTier } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AIUsageLogEntry {
  /** Provider name (claude, openai, grok, mercury, etc.) */
  provider: string;
  /** Specific model used (gpt-4o, claude-3-5-sonnet, etc.) */
  model: string;
  /** Type of AI task performed */
  taskType: AITaskType | string;
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
  /** Request latency in milliseconds */
  latencyMs: number;
  /** Request status */
  status: 'success' | 'error' | 'timeout' | 'blocked';
  /** Error message if status is error */
  errorMessage?: string;
  /** Model tier used */
  tier?: ModelTier;
  /** Whether the request was escalated */
  escalated?: boolean;
  /** Associated research ID */
  researchId?: string;
  /** Associated user ID */
  userId?: string;
  /** Workflow stage number */
  stageId?: number;
  /** Session identifier for grouping related calls */
  sessionId?: string;
  /** Agent ID if executed by an agent */
  agentId?: string;
  /** Tool usage plan ID for budget tracking */
  toolUsagePlanId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface NotionLoggerConfig {
  /** Notion API key */
  apiKey: string;
  /** API Usage Tracker database ID */
  usageTrackerDbId: string;
  /** AI Tool Usage Plans database ID (optional, for linking) */
  toolUsagePlansDbId?: string;
  /** Enable logging (default: true) */
  enabled?: boolean;
  /** Log to console as well (default: false) */
  consoleLog?: boolean;
  /** Batch logs for efficiency (default: true) */
  batchLogs?: boolean;
  /** Batch interval in ms (default: 5000) */
  batchIntervalMs?: number;
}

export interface BudgetStatus {
  provider: string;
  monthlyBudget: number;
  currentSpend: number;
  remainingBudget: number;
  percentUsed: number;
  isOverBudget: boolean;
  alertThreshold: number;
  shouldAlert: boolean;
}

// ============================================================================
// Notion Logger Class
// ============================================================================

export class NotionAILogger {
  private client: Client;
  private config: Required<NotionLoggerConfig>;
  private logQueue: AIUsageLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: NotionLoggerConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? true,
      consoleLog: config.consoleLog ?? false,
      batchLogs: config.batchLogs ?? true,
      batchIntervalMs: config.batchIntervalMs ?? 5000,
      toolUsagePlansDbId: config.toolUsagePlansDbId ?? '',
    };

    this.client = new Client({ auth: this.config.apiKey });

    if (this.config.batchLogs) {
      this.startBatchTimer();
    }

    this.isInitialized = true;
  }

  /**
   * Log an AI usage entry to Notion
   */
  async log(entry: AIUsageLogEntry): Promise<void> {
    if (!this.config.enabled) return;

    if (this.config.consoleLog) {
      console.log('[AI Logger]', JSON.stringify(entry, null, 2));
    }

    if (this.config.batchLogs) {
      this.logQueue.push(entry);
    } else {
      await this.writeToNotion(entry);
    }
  }

  /**
   * Write a single log entry to Notion
   */
  private async writeToNotion(entry: AIUsageLogEntry): Promise<void> {
    try {
      const properties: Record<string, unknown> = {
        Provider: {
          select: { name: this.normalizeProvider(entry.provider) },
        },
        Model: {
          rich_text: [{ text: { content: entry.model } }],
        },
        'Task Type': {
          select: { name: entry.taskType },
        },
        'Input Tokens': {
          number: entry.inputTokens,
        },
        'Output Tokens': {
          number: entry.outputTokens,
        },
        'Total Tokens': {
          number: entry.totalTokens,
        },
        'Cost (USD)': {
          number: entry.estimatedCostUsd,
        },
        'Latency (ms)': {
          number: entry.latencyMs,
        },
        Status: {
          select: { name: entry.status },
        },
        Timestamp: {
          date: { start: new Date().toISOString() },
        },
      };

      // Optional fields
      if (entry.errorMessage) {
        properties['Error Message'] = {
          rich_text: [{ text: { content: entry.errorMessage.slice(0, 2000) } }],
        };
      }

      if (entry.tier) {
        properties['Tier'] = {
          select: { name: entry.tier },
        };
      }

      if (entry.escalated !== undefined) {
        properties['Escalated'] = {
          checkbox: entry.escalated,
        };
      }

      if (entry.researchId) {
        properties['Research ID'] = {
          rich_text: [{ text: { content: entry.researchId } }],
        };
      }

      if (entry.userId) {
        properties['User ID'] = {
          rich_text: [{ text: { content: entry.userId } }],
        };
      }

      if (entry.stageId !== undefined) {
        properties['Stage'] = {
          number: entry.stageId,
        };
      }

      if (entry.sessionId) {
        properties['Session ID'] = {
          rich_text: [{ text: { content: entry.sessionId } }],
        };
      }

      if (entry.agentId) {
        properties['Agent ID'] = {
          rich_text: [{ text: { content: entry.agentId } }],
        };
      }

      // Link to Tool Usage Plan if provided
      if (entry.toolUsagePlanId && this.config.toolUsagePlansDbId) {
        properties['Usage Plan'] = {
          relation: [{ id: entry.toolUsagePlanId }],
        };
      }

      await this.client.pages.create({
        parent: { database_id: this.stripCollectionPrefix(this.config.usageTrackerDbId) },
        properties: properties as Parameters<typeof this.client.pages.create>[0]['properties'],
      });
    } catch (error) {
      console.error('[AI Logger] Failed to write to Notion:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Flush the log queue to Notion
   */
  async flush(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const entries = [...this.logQueue];
    this.logQueue = [];

    await Promise.all(entries.map((entry) => this.writeToNotion(entry)));
  }

  /**
   * Start the batch timer
   */
  private startBatchTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.batchIntervalMs);
  }

  /**
   * Stop the batch timer and flush remaining logs
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Get budget status for a provider
   */
  async getBudgetStatus(provider: string): Promise<BudgetStatus | null> {
    if (!this.config.toolUsagePlansDbId) {
      return null;
    }

    try {
      // Use the generic request method for database queries (more stable across SDK versions)
      const response = await this.client.request<{ results: Array<{ properties: Record<string, unknown> }> }>({
        path: `databases/${this.stripCollectionPrefix(this.config.toolUsagePlansDbId)}/query`,
        method: 'post',
        body: {
          filter: {
            property: 'Provider',
            select: { equals: this.normalizeProvider(provider) },
          },
        },
      });

      if (response.results.length === 0) {
        return null;
      }

      const page = response.results[0];
      const props = page.properties;

      // Extract budget information from Notion properties
      const monthlyBudget = this.extractNumber(props['Monthly Budget']);
      const currentSpend = this.extractNumber(props['Current Spend']) ?? 0;
      const alertThreshold = this.extractNumber(props['Alert Threshold']) ?? 0.8;

      if (monthlyBudget === null) {
        return null;
      }

      const remainingBudget = monthlyBudget - currentSpend;
      const percentUsed = (currentSpend / monthlyBudget) * 100;

      return {
        provider: this.normalizeProvider(provider),
        monthlyBudget,
        currentSpend,
        remainingBudget,
        percentUsed,
        isOverBudget: currentSpend > monthlyBudget,
        alertThreshold,
        shouldAlert: percentUsed >= alertThreshold * 100,
      };
    } catch (error) {
      console.error('[AI Logger] Failed to get budget status:', error);
      return null;
    }
  }

  /**
   * Check if a provider is within budget
   */
  async isWithinBudget(provider: string, estimatedCost: number): Promise<boolean> {
    const status = await this.getBudgetStatus(provider);
    if (!status) return true; // No budget tracking = allow

    return status.remainingBudget >= estimatedCost;
  }

  /**
   * Get aggregated usage statistics
   */
  async getUsageStats(options: {
    provider?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
    byTaskType: Record<string, { calls: number; tokens: number; cost: number }>;
  }> {
    try {
      const filters: Array<Record<string, unknown>> = [];

      if (options.provider) {
        filters.push({
          property: 'Provider',
          select: { equals: this.normalizeProvider(options.provider) },
        });
      }

      if (options.startDate) {
        filters.push({
          property: 'Timestamp',
          date: { on_or_after: options.startDate.toISOString() },
        });
      }

      if (options.endDate) {
        filters.push({
          property: 'Timestamp',
          date: { on_or_before: options.endDate.toISOString() },
        });
      }

      // Use the generic request method for database queries (more stable across SDK versions)
      const response = await this.client.request<{ results: Array<{ properties: Record<string, unknown> }> }>({
        path: `databases/${this.stripCollectionPrefix(this.config.usageTrackerDbId)}/query`,
        method: 'post',
        body: {
          filter: filters.length > 1
            ? { and: filters }
            : filters.length === 1
              ? filters[0]
              : undefined,
          page_size: options.limit ?? 100,
        },
      });

      const stats = {
        totalCalls: 0,
        totalTokens: 0,
        totalCost: 0,
        byProvider: {} as Record<string, { calls: number; tokens: number; cost: number }>,
        byTaskType: {} as Record<string, { calls: number; tokens: number; cost: number }>,
      };

      for (const page of response.results) {
        const props = page.properties;
        const provider = this.extractSelect(props['Provider']) ?? 'unknown';
        const taskType = this.extractSelect(props['Task Type']) ?? 'unknown';
        const tokens = this.extractNumber(props['Total Tokens']) ?? 0;
        const cost = this.extractNumber(props['Cost (USD)']) ?? 0;

        stats.totalCalls++;
        stats.totalTokens += tokens;
        stats.totalCost += cost;

        if (!stats.byProvider[provider]) {
          stats.byProvider[provider] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byProvider[provider].calls++;
        stats.byProvider[provider].tokens += tokens;
        stats.byProvider[provider].cost += cost;

        if (!stats.byTaskType[taskType]) {
          stats.byTaskType[taskType] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byTaskType[taskType].calls++;
        stats.byTaskType[taskType].tokens += tokens;
        stats.byTaskType[taskType].cost += cost;
      }

      return stats;
    } catch (error) {
      console.error('[AI Logger] Failed to get usage stats:', error);
      return {
        totalCalls: 0,
        totalTokens: 0,
        totalCost: 0,
        byProvider: {},
        byTaskType: {},
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private normalizeProvider(provider: string): string {
    const providerMap: Record<string, string> = {
      anthropic: 'Claude',
      claude: 'Claude',
      openai: 'OpenAI',
      gpt: 'OpenAI',
      together: 'Together AI',
      grok: 'Grok',
      xai: 'Grok',
      mercury: 'Mercury',
      inceptionlabs: 'Mercury',
      'lm-studio': 'LM Studio',
      lmstudio: 'LM Studio',
      sourcegraph: 'Sourcegraph',
      cursor: 'Cursor',
      'continue.dev': 'Continue.dev',
      continuedev: 'Continue.dev',
      codex: 'Codex CLI',
      figma: 'Figma',
      replit: 'Replit',
    };
    return providerMap[provider.toLowerCase()] ?? provider;
  }

  private stripCollectionPrefix(id: string): string {
    return id.replace(/^collection:\/\//, '').replace(/-/g, '');
  }

  private extractNumber(prop: unknown): number | null {
    if (typeof prop === 'object' && prop !== null && 'number' in prop) {
      return (prop as { number: number | null }).number;
    }
    return null;
  }

  private extractSelect(prop: unknown): string | null {
    if (
      typeof prop === 'object' &&
      prop !== null &&
      'select' in prop &&
      typeof (prop as { select: unknown }).select === 'object' &&
      (prop as { select: { name?: string } }).select !== null
    ) {
      return (prop as { select: { name: string } }).select.name ?? null;
    }
    return null;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let loggerInstance: NotionAILogger | null = null;

/**
 * Get or create the Notion AI logger instance
 */
export function getNotionLogger(config?: Partial<NotionLoggerConfig>): NotionAILogger | null {
  // Check if logging is enabled
  if (process.env.DISABLE_AI_LOGGING === 'true') {
    return null;
  }

  if (loggerInstance) {
    return loggerInstance;
  }

  const apiKey = config?.apiKey ?? process.env.NOTION_API_KEY;
  const usageTrackerDbId =
    config?.usageTrackerDbId ?? process.env.NOTION_API_USAGE_TRACKER_DB;

  if (!apiKey || !usageTrackerDbId) {
    console.warn('[AI Logger] Missing Notion configuration, logging disabled');
    return null;
  }

  loggerInstance = new NotionAILogger({
    apiKey,
    usageTrackerDbId,
    toolUsagePlansDbId: config?.toolUsagePlansDbId ?? process.env.NOTION_TOOL_USAGE_PLANS_DB,
    enabled: config?.enabled,
    consoleLog: config?.consoleLog ?? process.env.NODE_ENV === 'development',
    batchLogs: config?.batchLogs,
    batchIntervalMs: config?.batchIntervalMs,
  });

  return loggerInstance;
}

/**
 * Log an AI usage entry (convenience function)
 */
export async function logAIUsage(entry: AIUsageLogEntry): Promise<void> {
  const logger = getNotionLogger();
  if (logger) {
    await logger.log(entry);
  }
}

/**
 * Shutdown the logger gracefully
 */
export async function shutdownLogger(): Promise<void> {
  if (loggerInstance) {
    await loggerInstance.shutdown();
    loggerInstance = null;
  }
}
