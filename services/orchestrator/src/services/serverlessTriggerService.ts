/**
 * Serverless Trigger Service
 *
 * Phase G - Task 132: Serverless Function Triggers
 *
 * Manages serverless function execution:
 * - Define and manage serverless functions
 * - Event-based triggers
 * - Scheduled execution
 * - Invocation tracking and monitoring
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Schemas
// ============================================================================

export const TriggerTypeSchema = z.enum([
  'http',
  'schedule',
  'queue',
  'storage',
  'database',
  'pubsub',
  'webhook',
]);

export const RuntimeSchema = z.enum([
  'nodejs18',
  'nodejs20',
  'python39',
  'python311',
  'go121',
  'java17',
]);

export const ServerlessFunctionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  runtime: RuntimeSchema,
  handler: z.string(),
  codeLocation: z.string(),
  trigger: z.object({
    type: TriggerTypeSchema,
    config: z.record(z.string(), z.unknown()),
  }),
  resources: z.object({
    memoryMB: z.number().min(128).max(10240).default(256),
    timeoutSeconds: z.number().min(1).max(900).default(60),
    maxConcurrency: z.number().min(1).max(1000).optional(),
  }),
  environment: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const InvocationSchema = z.object({
  id: z.string().uuid(),
  functionId: z.string().uuid(),
  functionName: z.string(),
  triggerType: TriggerTypeSchema,
  status: z.enum(['pending', 'running', 'success', 'error', 'timeout', 'cancelled']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  durationMs: z.number().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  coldStart: z.boolean(),
  memoryUsedMB: z.number().optional(),
  billedDurationMs: z.number().optional(),
});

export const TriggerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('http'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('POST'),
    path: z.string(),
    cors: z.boolean().default(true),
    authRequired: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('schedule'),
    cron: z.string(),
    timezone: z.string().default('UTC'),
  }),
  z.object({
    type: z.literal('queue'),
    queueName: z.string(),
    batchSize: z.number().min(1).max(10).default(1),
  }),
  z.object({
    type: z.literal('storage'),
    bucket: z.string(),
    events: z.array(z.enum(['created', 'deleted', 'modified'])),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
  z.object({
    type: z.literal('database'),
    collection: z.string(),
    operations: z.array(z.enum(['insert', 'update', 'delete'])),
  }),
  z.object({
    type: z.literal('pubsub'),
    topic: z.string(),
    subscription: z.string().optional(),
  }),
  z.object({
    type: z.literal('webhook'),
    secret: z.string().optional(),
    allowedSources: z.array(z.string()).optional(),
  }),
]);

export const FunctionMetricsSchema = z.object({
  functionId: z.string().uuid(),
  functionName: z.string(),
  period: z.string(),
  invocations: z.number(),
  errors: z.number(),
  errorRate: z.number(),
  avgDurationMs: z.number(),
  p50DurationMs: z.number(),
  p95DurationMs: z.number(),
  p99DurationMs: z.number(),
  coldStarts: z.number(),
  coldStartRate: z.number(),
  totalBilledMs: z.number(),
  estimatedCost: z.number(),
});

export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type Runtime = z.infer<typeof RuntimeSchema>;
export type ServerlessFunction = z.infer<typeof ServerlessFunctionSchema>;
export type Invocation = z.infer<typeof InvocationSchema>;
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;
export type FunctionMetrics = z.infer<typeof FunctionMetricsSchema>;

// ============================================================================
// Serverless Trigger Service
// ============================================================================

class ServerlessTriggerService extends EventEmitter {
  private functions: Map<string, ServerlessFunction> = new Map();
  private invocations: Invocation[] = [];
  private activeInvocations: Map<string, Invocation> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private coldStartTracker: Map<string, number> = new Map(); // Last invocation time

  constructor() {
    super();
    this.initializeDefaultFunctions();
  }

  /**
   * Initialize default functions
   */
  private initializeDefaultFunctions(): void {
    const defaults: Omit<ServerlessFunction, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'data-processor',
        description: 'Processes incoming research data',
        runtime: 'nodejs20',
        handler: 'index.handler',
        codeLocation: 's3://functions/data-processor.zip',
        trigger: {
          type: 'queue',
          config: { queueName: 'data-processing-queue', batchSize: 5 },
        },
        resources: { memoryMB: 512, timeoutSeconds: 120 },
        environment: { NODE_ENV: 'production' },
        enabled: true,
      },
      {
        name: 'daily-report-generator',
        description: 'Generates daily analytics reports',
        runtime: 'python311',
        handler: 'main.generate_report',
        codeLocation: 's3://functions/report-generator.zip',
        trigger: {
          type: 'schedule',
          config: { cron: '0 6 * * *', timezone: 'America/Los_Angeles' },
        },
        resources: { memoryMB: 1024, timeoutSeconds: 300 },
        enabled: true,
      },
      {
        name: 'webhook-handler',
        description: 'Handles incoming webhooks from external services',
        runtime: 'nodejs18',
        handler: 'webhook.handle',
        codeLocation: 's3://functions/webhook-handler.zip',
        trigger: {
          type: 'http',
          config: { method: 'POST', path: '/webhooks/external', cors: true, authRequired: true },
        },
        resources: { memoryMB: 256, timeoutSeconds: 30 },
        enabled: true,
      },
      {
        name: 'file-processor',
        description: 'Processes uploaded files',
        runtime: 'python39',
        handler: 'processor.process_file',
        codeLocation: 's3://functions/file-processor.zip',
        trigger: {
          type: 'storage',
          config: { bucket: 'uploads', events: ['created'], prefix: 'raw/' },
        },
        resources: { memoryMB: 2048, timeoutSeconds: 600, maxConcurrency: 10 },
        enabled: true,
      },
      {
        name: 'notification-sender',
        description: 'Sends notifications via pubsub events',
        runtime: 'go121',
        handler: 'main.SendNotification',
        codeLocation: 's3://functions/notification-sender.zip',
        trigger: {
          type: 'pubsub',
          config: { topic: 'notifications' },
        },
        resources: { memoryMB: 128, timeoutSeconds: 10 },
        enabled: true,
      },
    ];

    const now = new Date().toISOString();
    for (const func of defaults) {
      const id = crypto.randomUUID();
      this.functions.set(id, {
        id,
        ...func,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Create a new serverless function
   */
  createFunction(
    config: Omit<ServerlessFunction, 'id' | 'createdAt' | 'updatedAt'>
  ): ServerlessFunction {
    const now = new Date().toISOString();
    const func: ServerlessFunction = {
      id: crypto.randomUUID(),
      ...config,
      createdAt: now,
      updatedAt: now,
    };

    this.functions.set(func.id, func);

    // Set up scheduled trigger if applicable
    if (func.trigger.type === 'schedule' && func.enabled) {
      this.setupSchedule(func);
    }

    this.emit('function:created', func);
    return func;
  }

  /**
   * Update a function
   */
  updateFunction(
    id: string,
    updates: Partial<Omit<ServerlessFunction, 'id' | 'createdAt' | 'updatedAt'>>
  ): ServerlessFunction | null {
    const func = this.functions.get(id);
    if (!func) return null;

    const updated: ServerlessFunction = {
      ...func,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.functions.set(id, updated);

    // Update schedule if changed
    if (updates.trigger || updates.enabled !== undefined) {
      this.clearSchedule(id);
      if (updated.trigger.type === 'schedule' && updated.enabled) {
        this.setupSchedule(updated);
      }
    }

    this.emit('function:updated', updated);
    return updated;
  }

  /**
   * Delete a function
   */
  deleteFunction(id: string): boolean {
    const func = this.functions.get(id);
    if (!func) return false;

    this.clearSchedule(id);
    this.functions.delete(id);
    this.emit('function:deleted', { id });
    return true;
  }

  /**
   * Get all functions
   */
  getFunctions(): ServerlessFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * Get function by ID
   */
  getFunction(id: string): ServerlessFunction | undefined {
    return this.functions.get(id);
  }

  /**
   * Get functions by trigger type
   */
  getFunctionsByTrigger(triggerType: TriggerType): ServerlessFunction[] {
    return Array.from(this.functions.values()).filter(f => f.trigger.type === triggerType);
  }

  /**
   * Invoke a function
   */
  async invokeFunction(
    functionId: string,
    input?: unknown,
    triggerType?: TriggerType
  ): Promise<Invocation> {
    const func = this.functions.get(functionId);
    if (!func) {
      throw new Error(`Function ${functionId} not found`);
    }

    if (!func.enabled) {
      throw new Error(`Function ${func.name} is disabled`);
    }

    // Check for cold start
    const lastInvocation = this.coldStartTracker.get(functionId) || 0;
    const coldStart = Date.now() - lastInvocation > 300000; // 5 minutes

    const invocation: Invocation = {
      id: crypto.randomUUID(),
      functionId,
      functionName: func.name,
      triggerType: triggerType || func.trigger.type,
      status: 'pending',
      startTime: new Date().toISOString(),
      input,
      coldStart,
    };

    this.activeInvocations.set(invocation.id, invocation);
    this.emit('invocation:started', invocation);

    // Execute function asynchronously
    this.executeFunction(invocation, func);

    return invocation;
  }

  /**
   * Execute function (simulated)
   */
  private async executeFunction(
    invocation: Invocation,
    func: ServerlessFunction
  ): Promise<void> {
    try {
      invocation.status = 'running';
      this.emit('invocation:running', invocation);

      // Simulate cold start delay
      if (invocation.coldStart) {
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      }

      // Simulate execution time based on memory and complexity
      const baseTime = 50 + Math.random() * 100;
      const memoryFactor = func.resources.memoryMB / 256;
      const executionTime = Math.round(baseTime / memoryFactor);

      await new Promise(resolve => setTimeout(resolve, Math.min(executionTime, 1000)));

      // Simulate occasional errors (5% rate)
      if (Math.random() < 0.05) {
        throw new Error('Simulated function error');
      }

      // Simulate timeout (1% rate)
      if (Math.random() < 0.01) {
        invocation.status = 'timeout';
        invocation.error = `Function timed out after ${func.resources.timeoutSeconds}s`;
      } else {
        invocation.status = 'success';
        invocation.output = {
          statusCode: 200,
          body: { message: 'Function executed successfully', processed: true },
        };
      }

      invocation.endTime = new Date().toISOString();
      invocation.durationMs = new Date(invocation.endTime).getTime() -
        new Date(invocation.startTime).getTime();
      invocation.memoryUsedMB = Math.round(func.resources.memoryMB * (0.3 + Math.random() * 0.5));
      invocation.billedDurationMs = Math.ceil(invocation.durationMs / 100) * 100;

      // Update cold start tracker
      this.coldStartTracker.set(func.id, Date.now());

    } catch (error) {
      invocation.status = 'error';
      invocation.error = error instanceof Error ? error.message : 'Unknown error';
      invocation.endTime = new Date().toISOString();
      invocation.durationMs = new Date(invocation.endTime).getTime() -
        new Date(invocation.startTime).getTime();
    } finally {
      // Move to history
      this.invocations.push({ ...invocation });
      this.activeInvocations.delete(invocation.id);

      this.emit(`invocation:${invocation.status}`, invocation);
    }
  }

  /**
   * Set up scheduled execution
   */
  private setupSchedule(func: ServerlessFunction): void {
    if (func.trigger.type !== 'schedule') return;

    const config = func.trigger.config as { cron: string; timezone?: string };

    // Simplified: use interval instead of proper cron parsing
    // In production, would use a proper cron library
    const intervalMs = this.parseCronToInterval(config.cron);

    const job = setInterval(() => {
      if (func.enabled) {
        this.invokeFunction(func.id, { scheduled: true, cron: config.cron }, 'schedule');
      }
    }, intervalMs);

    this.scheduledJobs.set(func.id, job);
    console.log(`[ServerlessTrigger] Scheduled ${func.name} with interval ${intervalMs}ms`);
  }

  /**
   * Parse cron expression to interval (simplified)
   */
  private parseCronToInterval(cron: string): number {
    // Very simplified - in production use a proper cron parser
    const parts = cron.split(' ');
    if (parts[0] === '*') return 60000; // Every minute
    if (parts[1] === '*') return 3600000; // Every hour
    return 86400000; // Daily default
  }

  /**
   * Clear scheduled job
   */
  private clearSchedule(functionId: string): void {
    const job = this.scheduledJobs.get(functionId);
    if (job) {
      clearInterval(job);
      this.scheduledJobs.delete(functionId);
    }
  }

  /**
   * Trigger function by event
   */
  async triggerByEvent(
    eventType: TriggerType,
    eventData: unknown
  ): Promise<Invocation[]> {
    const matchingFunctions = Array.from(this.functions.values())
      .filter(f => f.trigger.type === eventType && f.enabled);

    const invocations: Invocation[] = [];

    for (const func of matchingFunctions) {
      try {
        const invocation = await this.invokeFunction(func.id, eventData, eventType);
        invocations.push(invocation);
      } catch (error) {
        console.error(`[ServerlessTrigger] Failed to trigger ${func.name}:`, error);
      }
    }

    return invocations;
  }

  /**
   * Get active invocations
   */
  getActiveInvocations(): Invocation[] {
    return Array.from(this.activeInvocations.values());
  }

  /**
   * Get invocation history
   */
  getInvocationHistory(
    functionId?: string,
    limit: number = 100
  ): Invocation[] {
    let history = this.invocations;

    if (functionId) {
      history = history.filter(i => i.functionId === functionId);
    }

    return history.slice(-limit);
  }

  /**
   * Get invocation by ID
   */
  getInvocation(id: string): Invocation | undefined {
    return this.activeInvocations.get(id) || this.invocations.find(i => i.id === id);
  }

  /**
   * Get function metrics
   */
  getMetrics(functionId: string, periodMinutes: number = 60): FunctionMetrics | null {
    const func = this.functions.get(functionId);
    if (!func) return null;

    const cutoff = Date.now() - (periodMinutes * 60 * 1000);
    const recentInvocations = this.invocations.filter(
      i => i.functionId === functionId && new Date(i.startTime).getTime() > cutoff
    );

    if (recentInvocations.length === 0) {
      return {
        functionId,
        functionName: func.name,
        period: `${periodMinutes}m`,
        invocations: 0,
        errors: 0,
        errorRate: 0,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        coldStarts: 0,
        coldStartRate: 0,
        totalBilledMs: 0,
        estimatedCost: 0,
      };
    }

    const errors = recentInvocations.filter(i => i.status === 'error' || i.status === 'timeout');
    const coldStarts = recentInvocations.filter(i => i.coldStart);
    const durations = recentInvocations
      .filter(i => i.durationMs !== undefined)
      .map(i => i.durationMs!)
      .sort((a, b) => a - b);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, idx)];
    };

    const totalBilledMs = recentInvocations
      .filter(i => i.billedDurationMs !== undefined)
      .reduce((sum, i) => sum + i.billedDurationMs!, 0);

    // Simplified cost calculation (AWS Lambda-like pricing)
    const memoryGB = func.resources.memoryMB / 1024;
    const gbSeconds = (totalBilledMs / 1000) * memoryGB;
    const estimatedCost = gbSeconds * 0.0000166667; // ~$0.0000166667 per GB-second

    return {
      functionId,
      functionName: func.name,
      period: `${periodMinutes}m`,
      invocations: recentInvocations.length,
      errors: errors.length,
      errorRate: recentInvocations.length > 0 ? errors.length / recentInvocations.length : 0,
      avgDurationMs: Math.round(avgDuration),
      p50DurationMs: Math.round(percentile(durations, 50)),
      p95DurationMs: Math.round(percentile(durations, 95)),
      p99DurationMs: Math.round(percentile(durations, 99)),
      coldStarts: coldStarts.length,
      coldStartRate: recentInvocations.length > 0 ? coldStarts.length / recentInvocations.length : 0,
      totalBilledMs,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    };
  }

  /**
   * Get all function metrics
   */
  getAllMetrics(periodMinutes: number = 60): FunctionMetrics[] {
    return Array.from(this.functions.keys())
      .map(id => this.getMetrics(id, periodMinutes))
      .filter((m): m is FunctionMetrics => m !== null);
  }

  /**
   * Get aggregate statistics
   */
  getStats(): {
    totalFunctions: number;
    enabledFunctions: number;
    totalInvocations: number;
    byTriggerType: Record<TriggerType, number>;
    byRuntime: Record<Runtime, number>;
    errorRate: number;
    avgDurationMs: number;
  } {
    const functions = Array.from(this.functions.values());
    const byTriggerType: Record<string, number> = {};
    const byRuntime: Record<string, number> = {};

    for (const func of functions) {
      byTriggerType[func.trigger.type] = (byTriggerType[func.trigger.type] || 0) + 1;
      byRuntime[func.runtime] = (byRuntime[func.runtime] || 0) + 1;
    }

    const errors = this.invocations.filter(i => i.status === 'error' || i.status === 'timeout');
    const durations = this.invocations
      .filter(i => i.durationMs !== undefined)
      .map(i => i.durationMs!);

    return {
      totalFunctions: functions.length,
      enabledFunctions: functions.filter(f => f.enabled).length,
      totalInvocations: this.invocations.length,
      byTriggerType: byTriggerType as Record<TriggerType, number>,
      byRuntime: byRuntime as Record<Runtime, number>,
      errorRate: this.invocations.length > 0 ? errors.length / this.invocations.length : 0,
      avgDurationMs: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
    };
  }
}

// Export singleton instance
export const serverlessTriggerService = new ServerlessTriggerService();

export default serverlessTriggerService;
