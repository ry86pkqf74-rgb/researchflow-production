/**
 * GitHub Integration Provider
 * Task 167: GitHub integration for research tracking
 */

import { IntegrationProvider, IntegrationConfig, SyncResult } from '../types';

interface GitHubConfig extends IntegrationConfig {
  token: string;
  owner?: string;
  repo?: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export class GitHubProvider implements IntegrationProvider {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async sync(): Promise<SyncResult> {
    const results: SyncResult = {
      success: true,
      itemsSynced: 0,
      errors: [],
    };

    try {
      if (this.config.owner && this.config.repo) {
        const issues = await this.listIssues();
        results.itemsSynced = issues.length;
      }
    } catch (error: any) {
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }

  async disconnect(): Promise<void> {
    // GitHub tokens need manual revocation via settings
  }

  async listIssues(labels?: string[]): Promise<GitHubIssue[]> {
    const params = new URLSearchParams();
    if (labels?.length) {
      params.set('labels', labels.join(','));
    }
    params.set('state', 'all');
    params.set('per_page', '100');

    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues?${params}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.map(this.mapIssue);
  }

  async createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<GitHubIssue> {
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ title, body, labels }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create GitHub issue: ${response.status}`);
    }

    const data = await response.json();
    return this.mapIssue(data);
  }

  async updateIssue(
    issueNumber: number,
    updates: { title?: string; body?: string; state?: string; labels?: string[] }
  ): Promise<GitHubIssue> {
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update GitHub issue: ${response.status}`);
    }

    const data = await response.json();
    return this.mapIssue(data);
  }

  async addComment(issueNumber: number, body: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ body }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.status}`);
    }
  }

  async createResearchIssue(research: {
    id: string;
    title: string;
    description: string;
    findings?: string[];
    status: string;
  }): Promise<GitHubIssue> {
    const body = `
## Research Summary

${research.description}

${
  research.findings?.length
    ? `## Key Findings

${research.findings.map((f) => `- ${f}`).join('\n')}`
    : ''
}

---

**Research ID:** \`${research.id}\`
**Status:** ${research.status}

_This issue was automatically created by ResearchFlow._
    `.trim();

    return this.createIssue(research.title, body, ['research', research.status]);
  }

  async syncResearchStatus(
    issueNumber: number,
    status: string,
    message?: string
  ): Promise<void> {
    // Update labels based on status
    const statusLabels = ['pending', 'in-progress', 'completed', 'failed'];
    const issue = await this.getIssue(issueNumber);
    const newLabels = issue.labels
      .filter((l) => !statusLabels.includes(l))
      .concat([status]);

    await this.updateIssue(issueNumber, {
      labels: newLabels,
      state: status === 'completed' || status === 'failed' ? 'closed' : 'open',
    });

    if (message) {
      await this.addComment(issueNumber, message);
    }
  }

  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to get issue: ${response.status}`);
    }

    const data = await response.json();
    return this.mapIssue(data);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  private mapIssue(issue: any): GitHubIssue {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      url: issue.html_url,
      labels: issue.labels.map((l: any) => l.name),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }
}
