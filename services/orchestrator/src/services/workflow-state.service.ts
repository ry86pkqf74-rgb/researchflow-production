/**
 * Workflow State Persistence Service
 *
 * Redis-backed persistence for workflow/lifecycle session state.
 * Replaces in-memory storage for production scalability.
 *
 * Key pattern: workflow:state:{sessionId}
 * TTL: 30 days (configurable via WORKFLOW_STATE_TTL_DAYS)
 *
 * @module services/workflow-state.service
 */

import { getCacheService, RedisCacheService, RedisClient } from './redis-cache';
import type { LifecycleState, AuditLogEntry } from './lifecycleService';

// Default TTL: 30 days in seconds
const DEFAULT_TTL_DAYS = 30;
const TTL_SECONDS = (parseInt(process.env.WORKFLOW_STATE_TTL_DAYS || String(DEFAULT_TTL_DAYS), 10)) * 86400;

/**
 * Serializable session state (no Set objects)
 */
export interface PersistedSessionState {
  currentLifecycleState: LifecycleState;
  approvedAIStages: number[];
  completedStages: number[];
  attestedGates: number[];
  auditLog: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate Redis key for a session
 */
function getSessionKey(sessionId: string): string {
  return `workflow:state:${sessionId}`;
}

/**
 * In-memory fallback for when Redis is unavailable
 * Used to ensure graceful degradation
 */
const memoryFallback = new Map<string, PersistedSessionState>();

/**
 * Workflow State Service
 *
 * Provides Redis-backed persistence for workflow session state.
 * Falls back to in-memory storage if Redis is unavailable.
 */
export class WorkflowStateService {
  private cache: RedisCacheService;
  private redisAvailable: boolean = true;

  constructor(redisClient?: RedisClient) {
    this.cache = getCacheService(redisClient);
  }

  /**
   * Get session state from Redis or memory fallback
   */
  async getState(sessionId: string): Promise<PersistedSessionState | null> {
    const key = getSessionKey(sessionId);

    try {
      const cached = await this.cache.get<PersistedSessionState>(key);
      if (cached) {
        this.redisAvailable = true;
        return cached.data;
      }

      // Check memory fallback
      const fallbackState = memoryFallback.get(sessionId);
      if (fallbackState) {
        return fallbackState;
      }

      return null;
    } catch (error) {
      console.warn('[WorkflowStateService] Redis get failed, using memory fallback:', error);
      this.redisAvailable = false;
      return memoryFallback.get(sessionId) || null;
    }
  }

  /**
   * Save session state to Redis and memory fallback
   */
  async setState(sessionId: string, state: PersistedSessionState): Promise<void> {
    const key = getSessionKey(sessionId);

    // Always update memory fallback for redundancy
    memoryFallback.set(sessionId, state);

    try {
      await this.cache.set(key, state, TTL_SECONDS);
      this.redisAvailable = true;
    } catch (error) {
      console.warn('[WorkflowStateService] Redis set failed, state persisted to memory only:', error);
      this.redisAvailable = false;
    }
  }

  /**
   * Get or create session state
   */
  async getOrCreateState(sessionId: string): Promise<PersistedSessionState> {
    const existing = await this.getState(sessionId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newState: PersistedSessionState = {
      currentLifecycleState: 'DRAFT',
      approvedAIStages: [],
      completedStages: [],
      attestedGates: [],
      auditLog: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.setState(sessionId, newState);
    return newState;
  }

  /**
   * Update specific fields of session state
   */
  async updateState(
    sessionId: string,
    updates: Partial<Omit<PersistedSessionState, 'createdAt'>>
  ): Promise<PersistedSessionState> {
    const state = await this.getOrCreateState(sessionId);
    const updatedState: PersistedSessionState = {
      ...state,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.setState(sessionId, updatedState);
    return updatedState;
  }

  /**
   * Add approved AI stage
   */
  async addApprovedAIStage(sessionId: string, stageId: number): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    if (!state.approvedAIStages.includes(stageId)) {
      state.approvedAIStages.push(stageId);
      state.updatedAt = new Date().toISOString();
      await this.setState(sessionId, state);
    }
  }

  /**
   * Remove approved AI stage
   */
  async removeApprovedAIStage(sessionId: string, stageId: number): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    const idx = state.approvedAIStages.indexOf(stageId);
    if (idx !== -1) {
      state.approvedAIStages.splice(idx, 1);
      state.updatedAt = new Date().toISOString();
      await this.setState(sessionId, state);
    }
  }

  /**
   * Add completed stage
   */
  async addCompletedStage(sessionId: string, stageId: number): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    if (!state.completedStages.includes(stageId)) {
      state.completedStages.push(stageId);
      state.updatedAt = new Date().toISOString();
      await this.setState(sessionId, state);
    }
  }

  /**
   * Add attested gate
   */
  async addAttestedGate(sessionId: string, stageId: number): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    if (!state.attestedGates.includes(stageId)) {
      state.attestedGates.push(stageId);
      state.updatedAt = new Date().toISOString();
      await this.setState(sessionId, state);
    }
  }

  /**
   * Append audit log entry
   */
  async appendAuditLog(sessionId: string, entry: AuditLogEntry): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.auditLog.push(entry);
    state.updatedAt = new Date().toISOString();
    await this.setState(sessionId, state);
  }

  /**
   * Transition lifecycle state
   */
  async transitionState(
    sessionId: string,
    newState: LifecycleState
  ): Promise<void> {
    await this.updateState(sessionId, { currentLifecycleState: newState });
  }

  /**
   * Delete session state (for reset/cleanup)
   */
  async deleteState(sessionId: string): Promise<void> {
    const key = getSessionKey(sessionId);
    memoryFallback.delete(sessionId);

    try {
      await this.cache.delete(key);
    } catch (error) {
      console.warn('[WorkflowStateService] Redis delete failed:', error);
    }
  }

  /**
   * Check if Redis is available
   */
  isRedisHealthy(): boolean {
    return this.redisAvailable;
  }
}

// Singleton instance
let workflowStateService: WorkflowStateService | null = null;

/**
 * Get workflow state service singleton
 */
export function getWorkflowStateService(): WorkflowStateService {
  if (!workflowStateService) {
    workflowStateService = new WorkflowStateService();
  }
  return workflowStateService;
}

/**
 * Create workflow state service with specific Redis client
 */
export function createWorkflowStateService(redisClient: RedisClient): WorkflowStateService {
  return new WorkflowStateService(redisClient);
}

export default WorkflowStateService;
