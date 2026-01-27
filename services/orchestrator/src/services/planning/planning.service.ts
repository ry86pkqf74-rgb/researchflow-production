/**
 * Planning Service
 *
 * Handles analysis plan creation, approval, and execution.
 */

import OpenAI from 'openai';
import { planRepository } from '../../repositories/plan.repository';
import { phiGate, PHIGateResult } from './phi-gate';
import type {
  AnalysisPlan,
  AnalysisJob,
  AnalysisArtifact,
  CreatePlanRequest,
  ApprovePlanRequest,
  RunPlanRequest,
  PlanSpec,
  PlanStage,
  JobEvent,
} from '../../types/planning';
import { config } from '../../config/env';

// Conditionally import Anthropic
let Anthropic: typeof import('@anthropic-ai/sdk').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Anthropic = require('@anthropic-ai/sdk').default;
} catch {
  // Anthropic SDK not available
}

export class PlanningService {
  private openai: OpenAI | null = null;
  private anthropic: InstanceType<typeof import('@anthropic-ai/sdk').default> | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.ANTHROPIC_API_KEY && Anthropic) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  /**
   * Create a new analysis plan.
   */
  async createPlan(
    request: CreatePlanRequest,
    userId: string
  ): Promise<{ plan: AnalysisPlan; job: AnalysisJob; phiWarning?: string }> {
    // 1. PHI check on research question
    const questionCheck = phiGate.checkResearchQuestion(request.researchQuestion);
    if (!questionCheck.allowed) {
      throw new Error(
        `PHI detected in research question. Patterns: ${questionCheck.patterns.join(', ')}`
      );
    }

    // 2. Determine if approval is required
    const requiresApproval = this.requiresGovernanceApproval(request);

    // 3. Create initial plan record
    const plan = await planRepository.createPlan({
      projectId: request.projectId,
      datasetId: request.datasetId,
      name: request.name,
      description: request.description,
      researchQuestion: request.researchQuestion,
      planType: request.planType || 'statistical',
      constraints: request.constraints || { maxRows: 100000 },
      planSpec: { version: '1.0', generatedAt: '', stages: [] },
      status: 'draft',
      requiresApproval,
      createdBy: userId,
    });

    // 4. Create job for plan generation
    const job = await planRepository.createJob(plan.id, 'plan_build', userId);

    // 5. Start plan generation (async)
    this.generatePlanInBackground(
      plan.id,
      job.id,
      request.datasetMetadata,
      request.researchQuestion,
      request.constraints
    );

    return {
      plan,
      job,
      phiWarning: questionCheck.phiDetected
        ? `PHI detected (sanitized): ${questionCheck.patterns.join(', ')}`
        : undefined,
    };
  }

  /**
   * Generate plan specification using AI.
   * Runs asynchronously in background (called by queue worker).
   */
  async generatePlanInBackground(
    planId: string,
    jobId: string,
    datasetMetadata: CreatePlanRequest['datasetMetadata'],
    researchQuestion: string,
    constraints: CreatePlanRequest['constraints']
  ): Promise<void> {
    try {
      // 1. Prepare PHI-safe metadata
      const safeMetadata = datasetMetadata
        ? phiGate.prepareMetadataForAI(datasetMetadata)
        : '{ "columns": [] }';

      // 2. Build prompt
      await planRepository.updateJobProgress(jobId, 10, 'preparing_prompt');
      const prompt = this.buildPlanningPrompt(
        safeMetadata,
        researchQuestion,
        constraints
      );

      // 3. Call AI
      await planRepository.updateJobProgress(jobId, 20, 'calling_ai');
      await planRepository.addJobEvent(jobId, 'ai_call_started', {
        model: process.env.PLANNING_MODEL || 'gpt-4',
      });

      const aiResponse = await this.callAI(prompt);

      // 4. Parse and validate plan
      await planRepository.updateJobProgress(jobId, 60, 'validating_plan');
      const planSpec = this.parsePlanSpec(aiResponse);

      // 5. Determine final status based on governance requirements
      const plan = await planRepository.getPlan(planId);
      const finalStatus = plan?.requiresApproval ? 'pending_approval' : 'approved';

      // 6. Update plan with generated spec
      await planRepository.updateJobProgress(jobId, 80, 'saving_plan');
      await planRepository.updatePlanStatus(planId, finalStatus, { planSpec });

      // 7. Complete job
      await planRepository.completeJob(jobId, { planSpec });
      await planRepository.addJobEvent(jobId, 'plan_generated', {
        stageCount: planSpec.stages.length,
        status: finalStatus,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Plan generation failed:', errorMessage);

      await planRepository.failJob(jobId, errorMessage, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      await planRepository.updatePlanStatus(planId, 'failed');
    }
  }

  /**
   * Get plan with full details.
   */
  async getPlan(planId: string): Promise<AnalysisPlan | null> {
    return planRepository.getPlan(planId);
  }

  /**
   * List user's plans.
   */
  async listPlans(userId: string, projectId?: string): Promise<AnalysisPlan[]> {
    return planRepository.listPlans(userId, projectId);
  }

  /**
   * Approve a plan (STEWARD/ADMIN only).
   */
  async approvePlan(planId: string, approverId: string): Promise<AnalysisPlan> {
    const plan = await planRepository.getPlan(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'pending_approval') {
      throw new Error(`Plan cannot be approved (status: ${plan.status})`);
    }

    const updated = await planRepository.updatePlanStatus(planId, 'approved', {
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    });

    if (!updated) throw new Error('Failed to approve plan');
    return updated;
  }

  /**
   * Reject a plan (STEWARD/ADMIN only).
   */
  async rejectPlan(planId: string, reason: string): Promise<AnalysisPlan> {
    const plan = await planRepository.getPlan(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'pending_approval') {
      throw new Error(`Plan cannot be rejected (status: ${plan.status})`);
    }

    const updated = await planRepository.updatePlanStatus(planId, 'rejected', {
      rejectionReason: reason,
    });

    if (!updated) throw new Error('Failed to reject plan');
    return updated;
  }

  /**
   * Run an approved plan.
   */
  async runPlan(
    planId: string,
    userId: string,
    request?: RunPlanRequest
  ): Promise<AnalysisJob> {
    const plan = await planRepository.getPlan(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'approved') {
      throw new Error(
        `Plan must be approved before running (status: ${plan.status})`
      );
    }

    // Update plan status
    await planRepository.updatePlanStatus(planId, 'running');

    // Create execution job
    const job = await planRepository.createJob(planId, 'plan_run', userId);

    // Start execution (async)
    this.executePlanInBackground(
      planId,
      job.id,
      plan.planSpec,
      plan.constraints,
      request?.executionMode || 'full',
      request?.configOverrides
    );

    return job;
  }

  /**
   * Execute plan asynchronously (called by queue worker).
   */
  async executePlanInBackground(
    planId: string,
    jobId: string,
    planSpec: PlanSpec,
    constraints: AnalysisPlan['constraints'],
    executionMode: 'full' | 'dry_run',
    configOverrides?: Record<string, unknown>
  ): Promise<void> {
    try {
      await planRepository.updateJobProgress(jobId, 5, 'starting_execution');
      await planRepository.addJobEvent(jobId, 'execution_started', {
        mode: executionMode,
      });

      // Forward to Python worker for actual execution
      const workerUrl = config.workerUrl || 'http://localhost:8000';
      const response = await fetch(`${workerUrl}/api/agentic/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          jobId,
          planSpec,
          constraints,
          executionMode,
          configOverrides,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker execution failed: ${errorText}`);
      }

      const result = await response.json();

      // Update plan and job status
      await planRepository.updatePlanStatus(planId, 'completed');
      await planRepository.completeJob(jobId, result);
      await planRepository.addJobEvent(jobId, 'execution_completed', {
        artifactCount: result.artifacts?.length || 0,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Plan execution failed:', errorMessage);

      await planRepository.updatePlanStatus(planId, 'failed');
      await planRepository.failJob(jobId, errorMessage, {
        stack: error instanceof Error ? error.stack : undefined,
      });
      await planRepository.addJobEvent(jobId, 'execution_failed', {
        error: errorMessage,
      });
    }
  }

  /**
   * Get job status.
   */
  async getJob(jobId: string): Promise<AnalysisJob | null> {
    return planRepository.getJob(jobId);
  }

  /**
   * Get jobs for a plan.
   */
  async getJobsByPlan(planId: string): Promise<AnalysisJob[]> {
    return planRepository.getJobsByPlan(planId);
  }

  /**
   * Get job events for SSE streaming.
   */
  async getJobEvents(jobId: string, since?: Date): Promise<JobEvent[]> {
    return planRepository.getJobEvents(jobId, since);
  }

  /**
   * Get artifacts for a job or plan.
   */
  async getArtifacts(filters: {
    jobId?: string;
    planId?: string;
    type?: string;
  }): Promise<AnalysisArtifact[]> {
    return planRepository.getArtifacts(filters);
  }

  /**
   * Create an artifact.
   */
  async createArtifact(
    data: Omit<AnalysisArtifact, 'id' | 'createdAt'>
  ): Promise<AnalysisArtifact> {
    return planRepository.createArtifact(data);
  }

  // ===== PRIVATE METHODS =====

  private requiresGovernanceApproval(
    request: CreatePlanRequest | { constraints?: CreatePlanRequest['constraints'] }
  ): boolean {
    const mode = process.env.GOVERNANCE_MODE;
    if (mode !== 'LIVE') return false;

    // Check if explicitly required
    if (request.constraints?.requireApproval) return true;

    // Predictive models always need approval in LIVE mode
    if ((request as CreatePlanRequest).planType === 'predictive') return true;

    return false;
  }

  private buildPlanningPrompt(
    metadata: string,
    question: string,
    constraints?: CreatePlanRequest['constraints']
  ): string {
    return `You are a clinical research statistical analysis planner.

Given the following dataset metadata (column names and types only - no actual data):
${metadata}

Research Question: ${question}

Constraints:
- Maximum rows: ${constraints?.maxRows || 100000}
- Sampling rate: ${constraints?.samplingRate || 1.0}
- Excluded columns: ${constraints?.excludedColumns?.join(', ') || 'none'}

Generate a detailed analysis plan as JSON with this structure:
{
  "version": "1.0",
  "generatedAt": "ISO timestamp",
  "stages": [
    {
      "stageId": "unique_id",
      "stageType": "extraction|transform|analysis|validation|output",
      "name": "Stage name",
      "description": "What this stage does",
      "config": { /* stage-specific config */ },
      "dependsOn": ["previous_stage_ids"]
    }
  ],
  "statisticalMethods": [
    {
      "method": "method_name",
      "rationale": "Why this method is appropriate",
      "assumptions": ["assumptions to check"],
      "variables": {
        "dependent": "column_name",
        "independent": ["column_names"],
        "covariates": ["optional"]
      }
    }
  ],
  "expectedOutputs": [
    { "name": "output_name", "type": "table|figure|report", "description": "..." }
  ]
}

Important:
- Only use SELECT queries for data extraction
- Include data validation stages
- Check statistical assumptions before analysis
- Choose methods based on variable types (categorical, continuous, etc.)
- Include stages for handling missing data if needed

Return only valid JSON.`;
  }

  private async callAI(prompt: string): Promise<string> {
    const model =
      process.env.PLANNING_MODEL ||
      process.env.CHAT_AGENT_MODEL ||
      'gpt-4';

    if (model.includes('gpt') && this.openai) {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.3,
      });
      return response.choices[0]?.message?.content || '';
    }

    if (this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: model.includes('claude') ? model : 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      const content = response.content[0];
      return content.type === 'text' ? content.text : '';
    }

    throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
  }

  private parsePlanSpec(rawResponse: string): PlanSpec {
    try {
      // Extract JSON from response
      const jsonMatch =
        rawResponse.match(/```json\s*([\s\S]*?)```/) ||
        rawResponse.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawResponse;

      const spec = JSON.parse(jsonStr.trim());

      // Validate required fields
      if (!spec.stages || !Array.isArray(spec.stages)) {
        throw new Error('Plan must have stages array');
      }

      // Ensure version and timestamp
      spec.version = spec.version || '1.0';
      spec.generatedAt = spec.generatedAt || new Date().toISOString();

      return spec as PlanSpec;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse plan: ${errorMessage}`);
    }
  }
}

export const planningService = new PlanningService();
