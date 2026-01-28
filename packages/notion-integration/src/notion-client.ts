/**
 * ResearchFlow Notion Client
 * 
 * Main API client for interacting with Notion databases:
 * - ResearchFlow Deployment Tasks
 * - Deployment Execution Log
 * 
 * Uses the Notion API via fetch (compatible with Node.js 18+)
 */

import {
  NotionConfig,
  DeploymentTask,
  CreateDeploymentTaskInput,
  UpdateDeploymentTaskInput,
  ExecutionLog,
  CreateExecutionLogInput,
  UpdateExecutionLogInput,
  TaskStatus,
  ExecutionStatus,
} from './types.js';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export class NotionClient {
  private config: NotionConfig;
  
  constructor(config: NotionConfig) {
    this.config = config;
  }
  
  // ============================================================================
  // Private Helpers
  // ============================================================================
  
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${NOTION_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Notion API error: ${response.status} - ${JSON.stringify(error)}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  private formatDateProperty(date: Date | undefined, isDatetime: boolean = true): Record<string, unknown> | null {
    if (!date) return null;
    
    const iso = date.toISOString();
    return {
      start: isDatetime ? iso : iso.split('T')[0],
      time_zone: isDatetime ? 'UTC' : undefined,
    };
  }
  
  private parseDateProperty(prop: unknown): Date | undefined {
    if (!prop || typeof prop !== 'object') return undefined;
    const dateProp = prop as { date?: { start?: string } };
    if (!dateProp.date?.start) return undefined;
    return new Date(dateProp.date.start);
  }
  
  private getTextValue(prop: unknown): string | undefined {
    if (!prop || typeof prop !== 'object') return undefined;
    
    const p = prop as { 
      rich_text?: Array<{ plain_text?: string }>;
      title?: Array<{ plain_text?: string }>;
    };
    
    if (p.rich_text?.length) {
      return p.rich_text.map(rt => rt.plain_text || '').join('');
    }
    if (p.title?.length) {
      return p.title.map(t => t.plain_text || '').join('');
    }
    return undefined;
  }
  
  private getNumberValue(prop: unknown): number | undefined {
    if (!prop || typeof prop !== 'object') return undefined;
    const p = prop as { number?: number | null };
    return p.number ?? undefined;
  }
  
  private getSelectValue<T extends string>(prop: unknown): T | undefined {
    if (!prop || typeof prop !== 'object') return undefined;
    const p = prop as { select?: { name?: string } | null };
    return (p.select?.name as T) ?? undefined;
  }
  
  private getRelationUrls(prop: unknown): string[] {
    if (!prop || typeof prop !== 'object') return [];
    const p = prop as { relation?: Array<{ id: string }> };
    if (!p.relation?.length) return [];
    return p.relation.map(r => `https://www.notion.so/${r.id.replace(/-/g, '')}`);
  }
  
  // ============================================================================
  // Deployment Tasks Operations
  // ============================================================================
  
  /**
   * Create a new deployment task
   */
  async createDeploymentTask(input: CreateDeploymentTaskInput): Promise<DeploymentTask> {
    const properties: Record<string, unknown> = {
      'Task': {
        title: [{ text: { content: input.name } }],
      },
      'Task ID': {
        rich_text: [{ text: { content: input.taskId } }],
      },
    };
    
    if (input.status) {
      properties['Status'] = { select: { name: input.status } };
    }
    if (input.progressPercent !== undefined) {
      properties['Progress %'] = { number: input.progressPercent };
    }
    if (input.aiTool) {
      properties['AI Tool'] = { select: { name: input.aiTool } };
    }
    if (input.phase) {
      properties['Phase'] = { select: { name: input.phase } };
    }
    if (input.priority) {
      properties['Priority'] = { select: { name: input.priority } };
    }
    if (input.filePath) {
      properties['File Path'] = { rich_text: [{ text: { content: input.filePath } }] };
    }
    if (input.notes) {
      properties['Notes'] = { rich_text: [{ text: { content: input.notes } }] };
    }
    
    const response = await this.request<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }>(
      '/pages',
      'POST',
      {
        parent: { database_id: this.config.deploymentTasksDataSourceId },
        properties,
      }
    );
    
    return this.parseDeploymentTask(response);
  }
  
  /**
   * Get a deployment task by Task ID
   */
  async getDeploymentTaskByTaskId(taskId: string): Promise<DeploymentTask | null> {
    const response = await this.request<{ results: Array<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }> }>(
      `/databases/${this.config.deploymentTasksDataSourceId}/query`,
      'POST',
      {
        filter: {
          property: 'Task ID',
          rich_text: { equals: taskId },
        },
      }
    );
    
    if (!response.results?.length) return null;
    return this.parseDeploymentTask(response.results[0]);
  }
  
  /**
   * Get all deployment tasks with optional status filter
   */
  async getDeploymentTasks(status?: TaskStatus): Promise<DeploymentTask[]> {
    const body: Record<string, unknown> = {};
    
    if (status) {
      body.filter = {
        property: 'Status',
        select: { equals: status },
      };
    }
    
    const response = await this.request<{ results: Array<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }> }>(
      `/databases/${this.config.deploymentTasksDataSourceId}/query`,
      'POST',
      body
    );
    
    return response.results.map(r => this.parseDeploymentTask(r));
  }
  
  /**
   * Update a deployment task by page ID
   */
  async updateDeploymentTask(pageId: string, input: UpdateDeploymentTaskInput): Promise<DeploymentTask> {
    const properties: Record<string, unknown> = {};
    
    if (input.status !== undefined) {
      properties['Status'] = { select: { name: input.status } };
    }
    if (input.progressPercent !== undefined) {
      properties['Progress %'] = { number: input.progressPercent };
    }
    if (input.startedAt !== undefined) {
      properties['Started At'] = { date: this.formatDateProperty(input.startedAt) };
    }
    if (input.completedAt !== undefined) {
      properties['Completed At'] = { date: this.formatDateProperty(input.completedAt) };
    }
    if (input.lastUpdated !== undefined) {
      properties['Last Updated'] = { date: this.formatDateProperty(input.lastUpdated) };
    }
    if (input.aiTool !== undefined) {
      properties['AI Tool'] = input.aiTool ? { select: { name: input.aiTool } } : null;
    }
    if (input.phase !== undefined) {
      properties['Phase'] = input.phase ? { select: { name: input.phase } } : null;
    }
    if (input.priority !== undefined) {
      properties['Priority'] = input.priority ? { select: { name: input.priority } } : null;
    }
    if (input.filePath !== undefined) {
      properties['File Path'] = { rich_text: input.filePath ? [{ text: { content: input.filePath } }] : [] };
    }
    if (input.notes !== undefined) {
      properties['Notes'] = { rich_text: input.notes ? [{ text: { content: input.notes } }] : [] };
    }
    if (input.executionLogs !== undefined) {
      // Convert URLs to page IDs for relation
      properties['Execution Logs'] = {
        relation: input.executionLogs.map(url => {
          // Extract page ID from URL
          const match = url.match(/([a-f0-9]{32})/i);
          if (match) {
            const id = match[1];
            return { id: `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}` };
          }
          return { id: url };
        }),
      };
    }
    
    const response = await this.request<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }>(
      `/pages/${pageId}`,
      'PATCH',
      { properties }
    );
    
    return this.parseDeploymentTask(response);
  }
  
  /**
   * Update a deployment task by Task ID
   */
  async updateDeploymentTaskByTaskId(taskId: string, input: UpdateDeploymentTaskInput): Promise<DeploymentTask | null> {
    const task = await this.getDeploymentTaskByTaskId(taskId);
    if (!task || !task.url) return null;
    
    const pageId = this.extractPageId(task.url);
    return this.updateDeploymentTask(pageId, input);
  }
  
  private parseDeploymentTask(page: { id: string; url: string; properties: Record<string, unknown>; created_time: string }): DeploymentTask {
    const props = page.properties;
    
    return {
      taskId: this.getTextValue(props['Task ID']) || '',
      name: this.getTextValue(props['Task']) || '',
      status: this.getSelectValue(props['Status']) || '⚪ Pending',
      progressPercent: this.getNumberValue(props['Progress %']) || 0,
      startedAt: this.parseDateProperty(props['Started At']),
      completedAt: this.parseDateProperty(props['Completed At']),
      lastUpdated: this.parseDateProperty(props['Last Updated']),
      aiTool: this.getSelectValue(props['AI Tool']),
      phase: this.getSelectValue(props['Phase']),
      priority: this.getSelectValue(props['Priority']),
      filePath: this.getTextValue(props['File Path']),
      notes: this.getTextValue(props['Notes']),
      executionLogs: this.getRelationUrls(props['Execution Logs']),
      url: page.url,
      createdTime: new Date(page.created_time),
    };
  }
  
  // ============================================================================
  // Execution Log Operations
  // ============================================================================
  
  /**
   * Create a new execution log entry
   */
  async createExecutionLog(input: CreateExecutionLogInput): Promise<ExecutionLog> {
    const properties: Record<string, unknown> = {
      'Name': {
        title: [{ text: { content: input.name } }],
      },
      'Execution ID': {
        rich_text: [{ text: { content: input.executionId } }],
      },
    };
    
    if (input.toolInstanceId) {
      properties['Tool Instance ID'] = { rich_text: [{ text: { content: input.toolInstanceId } }] };
    }
    if (input.status) {
      properties['Status'] = { select: { name: input.status } };
    }
    if (input.progressPercent !== undefined) {
      properties['Progress %'] = { number: input.progressPercent };
    }
    if (input.startedAt) {
      properties['Started At'] = { date: this.formatDateProperty(input.startedAt) };
    }
    if (input.stream) {
      properties['Stream'] = { select: { name: input.stream } };
    }
    if (input.notes) {
      properties['Notes'] = { rich_text: [{ text: { content: input.notes } }] };
    }
    
    const response = await this.request<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }>(
      '/pages',
      'POST',
      {
        parent: { database_id: this.config.executionLogDataSourceId },
        properties,
      }
    );
    
    return this.parseExecutionLog(response);
  }
  
  /**
   * Get an execution log by Execution ID
   */
  async getExecutionLogByExecutionId(executionId: string): Promise<ExecutionLog | null> {
    const response = await this.request<{ results: Array<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }> }>(
      `/databases/${this.config.executionLogDataSourceId}/query`,
      'POST',
      {
        filter: {
          property: 'Execution ID',
          rich_text: { equals: executionId },
        },
      }
    );
    
    if (!response.results?.length) return null;
    return this.parseExecutionLog(response.results[0]);
  }
  
  /**
   * Get all execution logs with optional status filter
   */
  async getExecutionLogs(status?: ExecutionStatus): Promise<ExecutionLog[]> {
    const body: Record<string, unknown> = {
      sorts: [{ property: 'Started At', direction: 'descending' }],
    };
    
    if (status) {
      body.filter = {
        property: 'Status',
        select: { equals: status },
      };
    }
    
    const response = await this.request<{ results: Array<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }> }>(
      `/databases/${this.config.executionLogDataSourceId}/query`,
      'POST',
      body
    );
    
    return response.results.map(r => this.parseExecutionLog(r));
  }
  
  /**
   * Get currently running executions
   */
  async getRunningExecutions(): Promise<ExecutionLog[]> {
    return this.getExecutionLogs('Running');
  }
  
  /**
   * Update an execution log by page ID
   */
  async updateExecutionLog(pageId: string, input: UpdateExecutionLogInput): Promise<ExecutionLog> {
    const properties: Record<string, unknown> = {};
    
    if (input.status !== undefined) {
      properties['Status'] = { select: { name: input.status } };
    }
    if (input.progressPercent !== undefined) {
      properties['Progress %'] = { number: input.progressPercent };
    }
    if (input.completedAt !== undefined) {
      properties['Completed At'] = { date: this.formatDateProperty(input.completedAt) };
    }
    if (input.stream !== undefined) {
      properties['Stream'] = input.stream ? { select: { name: input.stream } } : null;
    }
    if (input.notes !== undefined) {
      properties['Notes'] = { rich_text: input.notes ? [{ text: { content: input.notes } }] : [] };
    }
    if (input.blockingIssues !== undefined) {
      properties['Blocking Issues'] = { rich_text: input.blockingIssues ? [{ text: { content: input.blockingIssues } }] : [] };
    }
    
    const response = await this.request<{ id: string; url: string; properties: Record<string, unknown>; created_time: string }>(
      `/pages/${pageId}`,
      'PATCH',
      { properties }
    );
    
    return this.parseExecutionLog(response);
  }
  
  /**
   * Update an execution log by Execution ID
   */
  async updateExecutionLogByExecutionId(executionId: string, input: UpdateExecutionLogInput): Promise<ExecutionLog | null> {
    const log = await this.getExecutionLogByExecutionId(executionId);
    if (!log || !log.url) return null;
    
    const pageId = this.extractPageId(log.url);
    return this.updateExecutionLog(pageId, input);
  }
  
  private parseExecutionLog(page: { id: string; url: string; properties: Record<string, unknown>; created_time: string }): ExecutionLog {
    const props = page.properties;
    
    return {
      executionId: this.getTextValue(props['Execution ID']) || '',
      name: this.getTextValue(props['Name']) || '',
      toolInstanceId: this.getTextValue(props['Tool Instance ID']),
      status: this.getSelectValue(props['Status']) || 'Pending',
      progressPercent: this.getNumberValue(props['Progress %']) || 0,
      startedAt: this.parseDateProperty(props['Started At']),
      completedAt: this.parseDateProperty(props['Completed At']),
      durationMin: this.getNumberValue(props['Duration (min)']),
      stream: this.getSelectValue(props['Stream']),
      notes: this.getTextValue(props['Notes']),
      blockingIssues: this.getTextValue(props['Blocking Issues']),
      url: page.url,
      createdTime: new Date(page.created_time),
    };
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private extractPageId(url: string): string {
    // Extract page ID from Notion URL
    const match = url.match(/([a-f0-9]{32})/i);
    if (match) {
      const id = match[1];
      return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
    }
    return url;
  }
  
  /**
   * Get page ID from URL (for linking)
   */
  getPageIdFromUrl(url: string): string {
    return this.extractPageId(url);
  }
}

export default NotionClient;
