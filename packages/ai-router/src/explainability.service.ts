/**
 * Explainability Service (Task 64)
 *
 * Provides detailed logging and reasoning traces for AI invocations.
 * Logs full prompt/response chains with routing decisions for accountability.
 *
 * IMPORTANT: Never stores raw prompts/responses - only hashes and metadata.
 */

import { createHash } from 'crypto';
import type {
  ModelTier,
  AITaskType,
  AIRouterRequest,
  AIRouterResponse,
  AIInvocationRecord,
} from './types';
import { MODEL_CONFIGS, TASK_TIER_MAPPING } from './types';

/**
 * Reasoning trace for explainability
 */
export interface ReasoningTrace {
  tierSelection: {
    selectedTier: ModelTier;
    reason: string;
    taskType: AITaskType;
    forcedTier?: ModelTier;
    defaultTier: ModelTier;
  };
  escalationPath?: {
    fromTier: ModelTier;
    toTier: ModelTier;
    reason: string;
    attemptNumber: number;
  }[];
  qualityChecks: {
    checkName: string;
    passed: boolean;
    reason?: string;
    severity: 'info' | 'warning' | 'error';
  }[];
  phiScanSummary: {
    inputScanned: boolean;
    outputScanned: boolean;
    inputPassed: boolean;
    outputPassed: boolean;
    findingsRedacted: number;
  };
  costAnalysis: {
    estimatedCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    tier: ModelTier;
    model: string;
    costSavedByTiering?: number;
  };
  timestamp: string;
}

/**
 * Invocation log entry for database storage
 */
export interface InvocationLogEntry {
  id?: string;
  auditEventId?: number;
  provider: string;
  model: string;
  taskType: AITaskType;
  workflowStage?: number;
  promptTemplateId?: string;
  promptTemplateVersion?: number;
  promptHash: string;
  promptTokenCount: number;
  responseHash: string;
  responseTokenCount: number;
  latencyMs: number;
  phiScanPassed: boolean;
  phiRiskLevel?: string;
  initialTier: ModelTier;
  finalTier: ModelTier;
  escalated: boolean;
  escalationCount: number;
  escalationReason?: string;
  qualityGatePassed: boolean;
  qualityChecks: object;
  estimatedCostUsd: string;
  reasoningTrace: ReasoningTrace;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'TIMEOUT';
  errorMessage?: string;
  researchId?: string;
  userId?: string;
  sessionId?: string;
  ethicsApprovalId?: string;
}

/**
 * Explainability Service
 */
export class ExplainabilityService {
  private enabled: boolean;
  private logCallback?: (entry: InvocationLogEntry) => Promise<void>;

  constructor(options?: {
    enabled?: boolean;
    logCallback?: (entry: InvocationLogEntry) => Promise<void>;
  }) {
    this.enabled = options?.enabled ?? process.env.EXPLAINABILITY_LOGGING_ENABLED === 'true';
    this.logCallback = options?.logCallback;
  }

  /**
   * Hash content using SHA-256 (never store raw content)
   */
  hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate reasoning trace for an invocation
   */
  generateReasoningTrace(
    request: AIRouterRequest,
    response: AIRouterResponse,
    options?: {
      escalationPath?: { from: ModelTier; to: ModelTier; reason: string; attempt: number }[];
      phiFindings?: { input: number; output: number };
    }
  ): ReasoningTrace {
    const defaultTier = TASK_TIER_MAPPING[request.taskType] || 'MINI';
    const config = MODEL_CONFIGS[response.routing.finalTier];

    // Calculate cost saved by using lower tier
    let costSavedByTiering: number | undefined;
    if (response.routing.initialTier !== 'FRONTIER') {
      const frontierConfig = MODEL_CONFIGS['FRONTIER'];
      const frontierCost =
        (response.usage.inputTokens / 1_000_000) * frontierConfig.costPerMToken.input +
        (response.usage.outputTokens / 1_000_000) * frontierConfig.costPerMToken.output;
      costSavedByTiering = frontierCost - response.usage.estimatedCostUsd;
    }

    return {
      tierSelection: {
        selectedTier: response.routing.initialTier,
        reason: request.forceTier
          ? 'Tier was explicitly forced by request'
          : `Task type "${request.taskType}" maps to tier ${defaultTier}`,
        taskType: request.taskType,
        forcedTier: request.forceTier,
        defaultTier,
      },
      escalationPath: options?.escalationPath?.map((e, i) => ({
        fromTier: e.from,
        toTier: e.to,
        reason: e.reason,
        attemptNumber: e.attempt,
      })),
      qualityChecks: response.qualityGate.checks.map(c => ({
        checkName: c.name,
        passed: c.passed,
        reason: c.reason,
        severity: c.severity,
      })),
      phiScanSummary: {
        inputScanned: true,
        outputScanned: true,
        inputPassed: !response.qualityGate.checks.some(c => c.name === 'phi_input_scan' && !c.passed),
        outputPassed: !response.qualityGate.checks.some(c => c.name === 'phi_output_scan' && !c.passed),
        findingsRedacted: options?.phiFindings?.output || 0,
      },
      costAnalysis: {
        estimatedCostUsd: response.usage.estimatedCostUsd,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        tier: response.routing.finalTier,
        model: config.model,
        costSavedByTiering,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a complete invocation log entry
   */
  createLogEntry(
    request: AIRouterRequest,
    response: AIRouterResponse,
    options?: {
      auditEventId?: number;
      phiRiskLevel?: string;
      ethicsApprovalId?: string;
      escalationPath?: { from: ModelTier; to: ModelTier; reason: string; attempt: number }[];
      phiFindings?: { input: number; output: number };
      promptTemplateId?: string;
      promptTemplateVersion?: number;
    }
  ): InvocationLogEntry {
    const reasoningTrace = this.generateReasoningTrace(request, response, options);

    // Determine status
    let status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'TIMEOUT' = 'SUCCESS';
    let errorMessage: string | undefined;

    const phiBlocked = response.qualityGate.checks.some(
      c => c.name === 'phi_input_scan' && !c.passed
    );

    if (phiBlocked) {
      status = 'BLOCKED';
      errorMessage = 'PHI detected in input';
    } else if (!response.qualityGate.passed) {
      status = 'FAILED';
      errorMessage = response.qualityGate.checks
        .filter(c => !c.passed)
        .map(c => c.reason)
        .join('; ');
    }

    // Count escalations from the path
    const escalationCount = options?.escalationPath?.length || 0;

    return {
      auditEventId: options?.auditEventId,
      provider: response.routing.provider,
      model: response.routing.model,
      taskType: request.taskType,
      workflowStage: request.metadata?.stageId,
      promptTemplateId: options?.promptTemplateId,
      promptTemplateVersion: options?.promptTemplateVersion,
      promptHash: this.hashContent(request.prompt),
      promptTokenCount: response.usage.inputTokens,
      responseHash: this.hashContent(response.content),
      responseTokenCount: response.usage.outputTokens,
      latencyMs: response.metrics.latencyMs,
      phiScanPassed: !phiBlocked,
      phiRiskLevel: options?.phiRiskLevel,
      initialTier: response.routing.initialTier,
      finalTier: response.routing.finalTier,
      escalated: response.routing.escalated,
      escalationCount,
      escalationReason: response.routing.escalationReason,
      qualityGatePassed: response.qualityGate.passed,
      qualityChecks: response.qualityGate.checks,
      estimatedCostUsd: response.usage.estimatedCostUsd.toFixed(6),
      reasoningTrace,
      status,
      errorMessage,
      researchId: request.metadata?.researchId,
      userId: request.metadata?.userId,
      sessionId: request.metadata?.sessionId,
      ethicsApprovalId: options?.ethicsApprovalId,
    };
  }

  /**
   * Log an invocation (calls the callback if provided)
   */
  async logInvocation(
    request: AIRouterRequest,
    response: AIRouterResponse,
    options?: Parameters<ExplainabilityService['createLogEntry']>[2]
  ): Promise<InvocationLogEntry | null> {
    if (!this.enabled) {
      return null;
    }

    const entry = this.createLogEntry(request, response, options);

    if (this.logCallback) {
      await this.logCallback(entry);
    }

    return entry;
  }

  /**
   * Generate a human-readable explanation of the routing decision
   */
  explainRouting(trace: ReasoningTrace): string {
    const lines: string[] = [];

    // Tier selection
    lines.push(`## Tier Selection`);
    lines.push(`- Selected tier: ${trace.tierSelection.selectedTier}`);
    lines.push(`- Reason: ${trace.tierSelection.reason}`);
    if (trace.tierSelection.forcedTier) {
      lines.push(`- Note: Tier was explicitly forced`);
    }

    // Escalation path
    if (trace.escalationPath && trace.escalationPath.length > 0) {
      lines.push('');
      lines.push(`## Escalation Path`);
      for (const step of trace.escalationPath) {
        lines.push(`- Attempt ${step.attemptNumber}: ${step.fromTier} -> ${step.toTier}`);
        lines.push(`  Reason: ${step.reason}`);
      }
    }

    // Quality checks
    lines.push('');
    lines.push(`## Quality Checks`);
    for (const check of trace.qualityChecks) {
      const status = check.passed ? 'PASS' : 'FAIL';
      lines.push(`- [${status}] ${check.checkName}: ${check.reason || 'OK'}`);
    }

    // PHI summary
    lines.push('');
    lines.push(`## PHI Scan Summary`);
    lines.push(`- Input scanned: ${trace.phiScanSummary.inputPassed ? 'PASS' : 'BLOCKED'}`);
    lines.push(`- Output scanned: ${trace.phiScanSummary.outputPassed ? 'PASS' : 'REDACTED'}`);
    if (trace.phiScanSummary.findingsRedacted > 0) {
      lines.push(`- Findings redacted: ${trace.phiScanSummary.findingsRedacted}`);
    }

    // Cost analysis
    lines.push('');
    lines.push(`## Cost Analysis`);
    lines.push(`- Model: ${trace.costAnalysis.model} (${trace.costAnalysis.tier})`);
    lines.push(`- Tokens: ${trace.costAnalysis.inputTokens} in / ${trace.costAnalysis.outputTokens} out`);
    lines.push(`- Estimated cost: $${trace.costAnalysis.estimatedCostUsd.toFixed(6)}`);
    if (trace.costAnalysis.costSavedByTiering !== undefined) {
      lines.push(`- Cost saved vs FRONTIER: $${trace.costAnalysis.costSavedByTiering.toFixed(6)}`);
    }

    return lines.join('\n');
  }

  /**
   * Set the enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if explainability logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Singleton instance
 */
let defaultExplainabilityService: ExplainabilityService | null = null;

export function getExplainabilityService(options?: ConstructorParameters<typeof ExplainabilityService>[0]): ExplainabilityService {
  if (!defaultExplainabilityService || options) {
    defaultExplainabilityService = new ExplainabilityService(options);
  }
  return defaultExplainabilityService;
}
