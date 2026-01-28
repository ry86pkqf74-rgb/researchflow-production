/**
 * ResearchFlow Execution Tracker
 * 
 * High-level API for tracking tool executions with automatic:
 * - Execution log creation
 * - Progress updates
 * - Task status synchronization
 * - Completion handling
 */

import { NotionClient } from './notion-client.js';
import type {
  ExecutionSession,
  StartExecutionOptions,
  CompleteExecutionOptions,
  ExecutionLog,
  DeploymentTask,
} from './types.js';
import { v4 as uuidv4 } from 'uuid';

export class ExecutionTracker {
  private client: NotionClient;
  private activeSessions: Map<string, ExecutionSession> = new Map();
  
  constructor(client: NotionClient) {
    this.client = client;
  }
  
  // ============================================================================
  // Session Management
  // ============================================================================
  
  /**
   * Start a new execution session
   * 
   * Creates an entry in the Execution Log and optionally links to a Deployment Task
   * 
   * @example
   * const session = await tracker.startExecution({
   *   name: 'Frontend Docker Deploy',
   *   taskId: 'DOCK-006',
   *   stream: 'Frontend',
   *   notes: 'Building production Docker image'
   * });
   */
  async startExecution(options: StartExecutionOptions): Promise<ExecutionSession> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toolInstanceId = options.toolInstanceId || `tool-${uuidv4().slice(0, 8)}`;
    const startedAt = new Date();
    
    // Create execution log entry
    const executionLog = await this.client.createExecutionLog({
      executionId,
      name: options.name,
      toolInstanceId,
      status: 'Running',
      progressPercent: 0,
      startedAt,
      stream: options.stream,
      notes: options.notes,
    });
    
    // Update linked task if provided
    if (options.taskId) {
      const task = await this.client.getDeploymentTaskByTaskId(options.taskId);
      if (task && task.url) {
        // Get existing execution logs and add this one
        const existingLogs = task.executionLogs || [];
        await this.client.updateDeploymentTaskByTaskId(options.taskId, {
          status: '🟡 In Progress',
          startedAt: task.startedAt || startedAt, // Only set if not already started
          lastUpdated: new Date(),
          executionLogs: [...existingLogs, executionLog.url!],
        });
      }
    }
    
    // Create session object
    const session: ExecutionSession = {
      executionId,
      taskId: options.taskId,
      toolInstanceId,
      name: options.name,
      stream: options.stream,
      startedAt,
      currentProgress: 0,
    };
    
    // Set up auto-progress if enabled
    if (options.autoUpdateProgress) {
      const intervalMs = options.progressIntervalMs || 30000; // Default 30 seconds
      session.progressInterval = setInterval(async () => {
        await this.syncProgress(executionId);
      }, intervalMs);
    }
    
    this.activeSessions.set(executionId, session);
    
    console.log(`[ExecutionTracker] Started execution: ${executionId}`);
    console.log(`  Name: ${options.name}`);
    console.log(`  Stream: ${options.stream}`);
    console.log(`  Tool Instance: ${toolInstanceId}`);
    if (options.taskId) {
      console.log(`  Linked to Task: ${options.taskId}`);
    }
    
    return session;
  }
  
  /**
   * Update progress for an execution
   * 
   * @example
   * await tracker.updateProgress(session.executionId, 50, 'Completed build phase');
   */
  async updateProgress(
    executionId: string,
    progressPercent: number,
    notes?: string
  ): Promise<ExecutionLog | null> {
    const session = this.activeSessions.get(executionId);
    if (session) {
      session.currentProgress = progressPercent;
    }
    
    const updateData: { progressPercent: number; notes?: string } = { progressPercent };
    if (notes) {
      updateData.notes = notes;
    }
    
    const result = await this.client.updateExecutionLogByExecutionId(executionId, updateData);
    
    // Also update linked task's progress and timestamp
    if (session?.taskId) {
      await this.client.updateDeploymentTaskByTaskId(session.taskId, {
        progressPercent,
        lastUpdated: new Date(),
      });
    }
    
    console.log(`[ExecutionTracker] Progress update: ${executionId} -> ${progressPercent}%`);
    
    return result;
  }
  
  /**
   * Complete an execution (success or failure)
   * 
   * @example
   * await tracker.completeExecution(session.executionId, {
   *   status: 'Complete',
   *   notes: 'Successfully deployed to production'
   * });
   */
  async completeExecution(
    executionId: string,
    options: CompleteExecutionOptions
  ): Promise<ExecutionLog | null> {
    const session = this.activeSessions.get(executionId);
    const completedAt = new Date();
    
    // Clear auto-progress interval if exists
    if (session?.progressInterval) {
      clearInterval(session.progressInterval);
    }
    
    // Update execution log
    const result = await this.client.updateExecutionLogByExecutionId(executionId, {
      status: options.status,
      progressPercent: options.status === 'Complete' ? 100 : session?.currentProgress,
      completedAt,
      notes: options.notes,
      blockingIssues: options.blockingIssues,
    });
    
    // Update linked task
    if (session?.taskId) {
      const taskStatus = options.status === 'Complete' ? '🟢 Complete' : '🔴 Critical';
      await this.client.updateDeploymentTaskByTaskId(session.taskId, {
        status: taskStatus,
        progressPercent: options.status === 'Complete' ? 100 : session.currentProgress,
        completedAt,
        lastUpdated: completedAt,
      });
    }
    
    // Remove from active sessions
    this.activeSessions.delete(executionId);
    
    console.log(`[ExecutionTracker] Execution completed: ${executionId}`);
    console.log(`  Status: ${options.status}`);
    if (options.notes) {
      console.log(`  Notes: ${options.notes}`);
    }
    
    return result;
  }
  
  /**
   * Mark an execution as failed
   * 
   * Convenience method for completeExecution with Failed status
   */
  async failExecution(
    executionId: string,
    blockingIssues: string,
    notes?: string
  ): Promise<ExecutionLog | null> {
    return this.completeExecution(executionId, {
      status: 'Failed',
      blockingIssues,
      notes,
    });
  }
  
  /**
   * Sync progress from internal tracking to Notion
   * 
   * Called automatically when autoUpdateProgress is enabled
   */
  private async syncProgress(executionId: string): Promise<void> {
    const session = this.activeSessions.get(executionId);
    if (!session) return;
    
    await this.client.updateExecutionLogByExecutionId(executionId, {
      progressPercent: session.currentProgress,
    });
    
    if (session.taskId) {
      await this.client.updateDeploymentTaskByTaskId(session.taskId, {
        lastUpdated: new Date(),
      });
    }
  }
  
  // ============================================================================
  // Query Methods
  // ============================================================================
  
  /**
   * Get all currently running executions
   */
  async getRunningExecutions(): Promise<ExecutionLog[]> {
    return this.client.getRunningExecutions();
  }
  
  /**
   * Get active session by execution ID
   */
  getActiveSession(executionId: string): ExecutionSession | undefined {
    return this.activeSessions.get(executionId);
  }
  
  /**
   * Get all active sessions
   */
  getAllActiveSessions(): ExecutionSession[] {
    return Array.from(this.activeSessions.values());
  }
  
  // ============================================================================
  // Task Management
  // ============================================================================
  
  /**
   * Start working on a task
   * 
   * Convenience method that starts an execution and links it to a task
   * 
   * @example
   * const session = await tracker.startTask('DOCK-006', {
   *   name: 'Production Docker build',
   *   stream: 'Frontend',
   *   toolInstanceId: 'claude-worker-1'
   * });
   */
  async startTask(
    taskId: string,
    options: Omit<StartExecutionOptions, 'taskId'>
  ): Promise<ExecutionSession> {
    // Get task to verify it exists and get its name
    const task = await this.client.getDeploymentTaskByTaskId(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    return this.startExecution({
      ...options,
      taskId,
      name: options.name || `${task.name} Execution`,
    });
  }
  
  /**
   * Complete a task (marks task as complete)
   * 
   * @example
   * await tracker.completeTask('DOCK-006', {
   *   notes: 'All Docker configurations verified'
   * });
   */
  async completeTask(
    taskId: string,
    notes?: string
  ): Promise<DeploymentTask | null> {
    return this.client.updateDeploymentTaskByTaskId(taskId, {
      status: '🟢 Complete',
      progressPercent: 100,
      completedAt: new Date(),
      lastUpdated: new Date(),
      notes,
    });
  }
  
  /**
   * Mark a task as blocked/critical
   */
  async blockTask(
    taskId: string,
    reason: string
  ): Promise<DeploymentTask | null> {
    return this.client.updateDeploymentTaskByTaskId(taskId, {
      status: '🔴 Critical',
      lastUpdated: new Date(),
      notes: reason,
    });
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  /**
   * Cleanup all active sessions (call on process exit)
   */
  async cleanup(): Promise<void> {
    console.log(`[ExecutionTracker] Cleaning up ${this.activeSessions.size} active sessions...`);
    
    for (const [executionId, session] of this.activeSessions) {
      if (session.progressInterval) {
        clearInterval(session.progressInterval);
      }
      
      // Mark as failed since we're cleaning up unexpectedly
      await this.client.updateExecutionLogByExecutionId(executionId, {
        status: 'Failed',
        completedAt: new Date(),
        blockingIssues: 'Process terminated unexpectedly',
      });
    }
    
    this.activeSessions.clear();
    console.log(`[ExecutionTracker] Cleanup complete`);
  }
}

export default ExecutionTracker;
