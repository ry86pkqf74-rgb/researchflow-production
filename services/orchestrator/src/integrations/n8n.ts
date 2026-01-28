/**
 * n8n Cloud Integration
 *
 * Provides workflow automation capabilities for ResearchFlow:
 * - GitHub → Notion task sync
 * - CI/CD trigger automation
 * - Multi-service orchestration
 */

import { config } from '../config';

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: 'success' | 'error' | 'waiting';
}

interface N8nWebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  source: string;
}

class N8nClient {
  private baseUrl: string;
  private apiKey: string;
  private mcpServerUrl: string;
  private mcpToken: string;

  constructor() {
    this.baseUrl = process.env.N8N_BASE_URL || 'https://loganglosser13.app.n8n.cloud';
    this.apiKey = process.env.N8N_API_KEY || '';
    this.mcpServerUrl = process.env.N8N_MCP_SERVER_URL || 'https://loganglosser13.app.n8n.cloud/mcp-server/http';
    this.mcpToken = process.env.N8N_MCP_TOKEN || '';
  }

  /**
   * Get MCP server configuration for client connections
   */
  getMcpConfig() {
    return {
      serverUrl: this.mcpServerUrl,
      token: this.mcpToken,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `n8n API error (${response.status}): ${errorText}` };
      }

      const data = await response.json() as T;
      return { data };
    } catch (error) {
      return { error: `n8n request failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<{ data?: N8nWorkflow[]; error?: string }> {
    return this.request<N8nWorkflow[]>('/workflows');
  }

  /**
   * Get a specific workflow
   */
  async getWorkflow(workflowId: string): Promise<{ data?: N8nWorkflow; error?: string }> {
    return this.request<N8nWorkflow>(`/workflows/${workflowId}`);
  }

  /**
   * Activate a workflow
   */
  async activateWorkflow(workflowId: string): Promise<{ data?: N8nWorkflow; error?: string }> {
    return this.request<N8nWorkflow>(`/workflows/${workflowId}/activate`, {
      method: 'POST',
    });
  }

  /**
   * Deactivate a workflow
   */
  async deactivateWorkflow(workflowId: string): Promise<{ data?: N8nWorkflow; error?: string }> {
    return this.request<N8nWorkflow>(`/workflows/${workflowId}/deactivate`, {
      method: 'POST',
    });
  }

  /**
   * Execute a workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    data?: Record<string, unknown>
  ): Promise<{ data?: N8nExecution; error?: string }> {
    return this.request<N8nExecution>(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<{ data?: N8nExecution; error?: string }> {
    return this.request<N8nExecution>(`/executions/${executionId}`);
  }

  /**
   * List recent executions
   */
  async listExecutions(params?: {
    workflowId?: string;
    status?: 'success' | 'error' | 'waiting';
    limit?: number;
  }): Promise<{ data?: N8nExecution[]; error?: string }> {
    const queryParams = new URLSearchParams();
    if (params?.workflowId) queryParams.set('workflowId', params.workflowId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const query = queryParams.toString();
    return this.request<N8nExecution[]>(`/executions${query ? `?${query}` : ''}`);
  }

  /**
   * Trigger webhook endpoint (for external triggers)
   */
  async triggerWebhook(
    webhookPath: string,
    payload: N8nWebhookPayload
  ): Promise<{ data?: unknown; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/webhook/${webhookPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { error: `Webhook trigger failed: ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: `Webhook trigger error: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
  }
}

// Singleton instance
export const n8nClient = new N8nClient();

/**
 * Predefined workflow triggers for ResearchFlow
 */
export const n8nWorkflows = {
  /**
   * Sync GitHub issue to Notion task
   */
  syncGitHubToNotion: async (issue: {
    title: string;
    body: string;
    number: number;
    labels: string[];
    state: string;
  }) => {
    return n8nClient.triggerWebhook('github-notion-sync', {
      event: 'github.issue.sync',
      data: issue,
      timestamp: new Date().toISOString(),
      source: 'researchflow-orchestrator',
    });
  },

  /**
   * Trigger CI/CD pipeline from Notion status change
   */
  triggerCIFromNotion: async (task: {
    id: string;
    status: string;
    title: string;
  }) => {
    return n8nClient.triggerWebhook('notion-ci-trigger', {
      event: 'notion.task.status_change',
      data: task,
      timestamp: new Date().toISOString(),
      source: 'researchflow-orchestrator',
    });
  },

  /**
   * Notify Slack on deployment completion
   */
  notifyDeployment: async (deployment: {
    service: string;
    version: string;
    status: 'success' | 'failed';
    url?: string;
  }) => {
    return n8nClient.triggerWebhook('deployment-notify', {
      event: 'deployment.complete',
      data: deployment,
      timestamp: new Date().toISOString(),
      source: 'researchflow-orchestrator',
    });
  },

  /**
   * Sync workflow stage completion to external systems
   */
  syncStageCompletion: async (stage: {
    stageId: number;
    stageName: string;
    projectId: string;
    status: string;
    outputs: Record<string, unknown>;
  }) => {
    return n8nClient.triggerWebhook('stage-completion', {
      event: 'workflow.stage.complete',
      data: stage,
      timestamp: new Date().toISOString(),
      source: 'researchflow-orchestrator',
    });
  },
};

export default n8nClient;
