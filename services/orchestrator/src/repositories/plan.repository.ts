/**
 * Plan Repository
 *
 * Data access layer for analysis plans, jobs, artifacts, and events.
 */

import { db } from '../db';
import type {
  AnalysisPlan,
  AnalysisJob,
  AnalysisArtifact,
  PlanStatus,
  JobStatus,
  JobEvent,
  PlanSpec,
} from '../types/planning';

export class PlanRepository {
  // ===== PLANS =====

  async createPlan(
    data: Omit<AnalysisPlan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AnalysisPlan> {
    const [result] = await db
      .insert('analysis_plans')
      .values({
        project_id: data.projectId || null,
        dataset_id: data.datasetId,
        name: data.name,
        description: data.description || null,
        research_question: data.researchQuestion,
        plan_type: data.planType,
        constraints: JSON.stringify(data.constraints),
        plan_spec: JSON.stringify(data.planSpec),
        status: data.status,
        requires_approval: data.requiresApproval,
        created_by: data.createdBy,
      })
      .returning('*');
    return this.mapPlanRow(result);
  }

  async getPlan(planId: string): Promise<AnalysisPlan | null> {
    const [result] = await db
      .select('*')
      .from('analysis_plans')
      .where('id', planId)
      .limit(1);
    return result ? this.mapPlanRow(result) : null;
  }

  async listPlans(
    userId: string,
    projectId?: string,
    limit = 50
  ): Promise<AnalysisPlan[]> {
    let query = db
      .select('*')
      .from('analysis_plans')
      .where('created_by', userId);

    if (projectId) {
      query = query.andWhere('project_id', projectId);
    }

    const results = await query.orderBy('created_at', 'desc').limit(limit);
    return results.map((r: unknown) => this.mapPlanRow(r));
  }

  async updatePlanStatus(
    planId: string,
    status: PlanStatus,
    extras?: Partial<AnalysisPlan>
  ): Promise<AnalysisPlan | null> {
    const updateData: Record<string, unknown> = { status };

    if (extras?.approvedBy) updateData.approved_by = extras.approvedBy;
    if (extras?.approvedAt) updateData.approved_at = extras.approvedAt;
    if (extras?.rejectionReason)
      updateData.rejection_reason = extras.rejectionReason;
    if (extras?.planSpec) updateData.plan_spec = JSON.stringify(extras.planSpec);

    const [result] = await db
      .update('analysis_plans')
      .set(updateData)
      .where('id', planId)
      .returning('*');
    return result ? this.mapPlanRow(result) : null;
  }

  async deletePlan(planId: string): Promise<boolean> {
    const result = await db.delete('analysis_plans').where('id', planId);
    return result.rowCount > 0;
  }

  // ===== JOBS =====

  async createJob(
    planId: string,
    jobType: 'plan_build' | 'plan_run',
    startedBy: string
  ): Promise<AnalysisJob> {
    const [result] = await db
      .insert('analysis_jobs')
      .values({
        plan_id: planId,
        job_type: jobType,
        status: 'pending',
        progress: 0,
        stages_completed: JSON.stringify([]),
        started_by: startedBy,
      })
      .returning('*');
    return this.mapJobRow(result);
  }

  async getJob(jobId: string): Promise<AnalysisJob | null> {
    const [result] = await db
      .select('*')
      .from('analysis_jobs')
      .where('id', jobId)
      .limit(1);
    return result ? this.mapJobRow(result) : null;
  }

  async getJobsByPlan(planId: string): Promise<AnalysisJob[]> {
    const results = await db
      .select('*')
      .from('analysis_jobs')
      .where('plan_id', planId)
      .orderBy('created_at', 'desc');
    return results.map((r: unknown) => this.mapJobRow(r));
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<AnalysisJob | null> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'running') {
      updateData.started_at = new Date();
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updateData.completed_at = new Date();
    }

    const [result] = await db
      .update('analysis_jobs')
      .set(updateData)
      .where('id', jobId)
      .returning('*');
    return result ? this.mapJobRow(result) : null;
  }

  async updateJobProgress(
    jobId: string,
    progress: number,
    currentStage?: string,
    stageCompleted?: string
  ): Promise<AnalysisJob | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const stagesCompleted = stageCompleted
      ? [...job.stagesCompleted, stageCompleted]
      : job.stagesCompleted;

    const updateData: Record<string, unknown> = {
      progress,
      current_stage: currentStage || null,
      stages_completed: JSON.stringify(stagesCompleted),
      status: 'running',
    };

    if (!job.startedAt) {
      updateData.started_at = new Date();
    }

    const [result] = await db
      .update('analysis_jobs')
      .set(updateData)
      .where('id', jobId)
      .returning('*');
    return result ? this.mapJobRow(result) : null;
  }

  async completeJob(
    jobId: string,
    result: Record<string, unknown>
  ): Promise<AnalysisJob | null> {
    const [row] = await db
      .update('analysis_jobs')
      .set({
        status: 'completed',
        progress: 100,
        result: JSON.stringify(result),
        completed_at: new Date(),
      })
      .where('id', jobId)
      .returning('*');
    return row ? this.mapJobRow(row) : null;
  }

  async failJob(
    jobId: string,
    errorMessage: string,
    errorDetails?: Record<string, unknown>
  ): Promise<AnalysisJob | null> {
    const [row] = await db
      .update('analysis_jobs')
      .set({
        status: 'failed',
        error_message: errorMessage,
        error_details: errorDetails ? JSON.stringify(errorDetails) : null,
        completed_at: new Date(),
      })
      .where('id', jobId)
      .returning('*');
    return row ? this.mapJobRow(row) : null;
  }

  // ===== JOB EVENTS =====

  async addJobEvent(
    jobId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    await db.insert('analysis_job_events').values({
      job_id: jobId,
      event_type: eventType,
      event_data: JSON.stringify(eventData),
    });
  }

  async getJobEvents(jobId: string, since?: Date): Promise<JobEvent[]> {
    let query = db
      .select('*')
      .from('analysis_job_events')
      .where('job_id', jobId)
      .orderBy('created_at', 'asc');

    if (since) {
      query = query.andWhere('created_at', '>', since);
    }

    const results = await query;
    return results.map((r: Record<string, unknown>) => ({
      type: r.event_type as string,
      data:
        typeof r.event_data === 'string'
          ? JSON.parse(r.event_data)
          : r.event_data,
      timestamp: (r.created_at as Date).toISOString(),
    }));
  }

  // ===== ARTIFACTS =====

  async createArtifact(
    data: Omit<AnalysisArtifact, 'id' | 'createdAt'>
  ): Promise<AnalysisArtifact> {
    const [result] = await db
      .insert('analysis_artifacts')
      .values({
        job_id: data.jobId,
        plan_id: data.planId,
        artifact_type: data.artifactType,
        name: data.name,
        description: data.description || null,
        file_path: data.filePath || null,
        file_size: data.fileSize || null,
        mime_type: data.mimeType || null,
        inline_data: data.inlineData ? JSON.stringify(data.inlineData) : null,
        metadata: JSON.stringify(data.metadata),
      })
      .returning('*');
    return this.mapArtifactRow(result);
  }

  async getArtifact(artifactId: string): Promise<AnalysisArtifact | null> {
    const [result] = await db
      .select('*')
      .from('analysis_artifacts')
      .where('id', artifactId)
      .limit(1);
    return result ? this.mapArtifactRow(result) : null;
  }

  async getArtifacts(filters: {
    jobId?: string;
    planId?: string;
    type?: string;
  }): Promise<AnalysisArtifact[]> {
    let query = db.select('*').from('analysis_artifacts');
    if (filters.jobId) query = query.where('job_id', filters.jobId);
    if (filters.planId) query = query.where('plan_id', filters.planId);
    if (filters.type) query = query.where('artifact_type', filters.type);
    const results = await query.orderBy('created_at', 'desc');
    return results.map((r: unknown) => this.mapArtifactRow(r));
  }

  async deleteArtifact(artifactId: string): Promise<boolean> {
    const result = await db.delete('analysis_artifacts').where('id', artifactId);
    return result.rowCount > 0;
  }

  // ===== MAPPERS =====

  private mapPlanRow(row: Record<string, unknown>): AnalysisPlan {
    return {
      id: row.id as string,
      projectId: row.project_id as string | undefined,
      datasetId: row.dataset_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      researchQuestion: row.research_question as string,
      planType: row.plan_type as AnalysisPlan['planType'],
      constraints:
        typeof row.constraints === 'string'
          ? JSON.parse(row.constraints)
          : row.constraints || {},
      planSpec:
        typeof row.plan_spec === 'string'
          ? JSON.parse(row.plan_spec)
          : row.plan_spec || { version: '1.0', generatedAt: '', stages: [] },
      status: row.status as AnalysisPlan['status'],
      requiresApproval: row.requires_approval as boolean,
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at
        ? (row.approved_at as Date).toISOString()
        : undefined,
      rejectionReason: row.rejection_reason as string | undefined,
      createdBy: row.created_by as string,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapJobRow(row: Record<string, unknown>): AnalysisJob {
    return {
      id: row.id as string,
      planId: row.plan_id as string,
      jobType: row.job_type as AnalysisJob['jobType'],
      status: row.status as AnalysisJob['status'],
      progress: row.progress as number,
      currentStage: row.current_stage as string | undefined,
      stagesCompleted:
        typeof row.stages_completed === 'string'
          ? JSON.parse(row.stages_completed)
          : row.stages_completed || [],
      result: row.result
        ? typeof row.result === 'string'
          ? JSON.parse(row.result)
          : row.result
        : undefined,
      errorMessage: row.error_message as string | undefined,
      errorDetails: row.error_details
        ? typeof row.error_details === 'string'
          ? JSON.parse(row.error_details)
          : row.error_details
        : undefined,
      startedAt: row.started_at
        ? (row.started_at as Date).toISOString()
        : undefined,
      completedAt: row.completed_at
        ? (row.completed_at as Date).toISOString()
        : undefined,
      startedBy: row.started_by as string,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  private mapArtifactRow(row: Record<string, unknown>): AnalysisArtifact {
    return {
      id: row.id as string,
      jobId: row.job_id as string,
      planId: row.plan_id as string,
      artifactType: row.artifact_type as AnalysisArtifact['artifactType'],
      name: row.name as string,
      description: row.description as string | undefined,
      filePath: row.file_path as string | undefined,
      fileSize: row.file_size as number | undefined,
      mimeType: row.mime_type as string | undefined,
      inlineData: row.inline_data
        ? typeof row.inline_data === 'string'
          ? JSON.parse(row.inline_data)
          : row.inline_data
        : undefined,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata || {},
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}

export const planRepository = new PlanRepository();
