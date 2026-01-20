/**
 * CLI API Client Library (Task 91)
 *
 * HTTP client for communicating with the ResearchFlow API.
 */

import got, { Got, HTTPError } from 'got';
import { getApiUrl, getApiToken, getSelectedOrgId } from './auth.js';

export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  subscriptionTier: string;
  role: string;
  joinedAt: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Artifact {
  id: string;
  researchId: string;
  artifactType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Create an API client instance
 */
export function createApiClient(): Got {
  const apiUrl = getApiUrl();
  const token = getApiToken();
  const orgId = getSelectedOrgId();

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (orgId) {
    headers['X-ORG-ID'] = orgId;
  }

  return got.extend({
    prefixUrl: apiUrl,
    headers,
    timeout: {
      request: 30000,
    },
    responseType: 'json',
    throwHttpErrors: false,
  });
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = createApiClient();

  try {
    const response = await client.get('api/auth/user');

    if (response.statusCode === 200) {
      return response.body as User;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * List user's organizations
 */
export async function listOrganizations(): Promise<Organization[]> {
  const client = createApiClient();

  const response = await client.get('api/org');

  if (response.statusCode === 200) {
    const data = response.body as { organizations: Organization[] };
    return data.organizations;
  }

  throw new Error((response.body as ApiError).error || 'Failed to list organizations');
}

/**
 * Get organization details
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const client = createApiClient();

  const response = await client.get(`api/org/${orgId}`);

  if (response.statusCode === 200) {
    return response.body as Organization;
  }

  if (response.statusCode === 404) {
    return null;
  }

  throw new Error((response.body as ApiError).error || 'Failed to get organization');
}

/**
 * List research projects for organization
 */
export async function listResearchProjects(orgId?: string): Promise<ResearchProject[]> {
  const client = createApiClient();
  const targetOrgId = orgId || getSelectedOrgId();

  if (!targetOrgId) {
    throw new Error('No organization selected. Use "rfc org select <slug>" first.');
  }

  const response = await client.get('api/research', {
    searchParams: { orgId: targetOrgId },
  });

  if (response.statusCode === 200) {
    const data = response.body as { projects: ResearchProject[] };
    return data.projects || [];
  }

  throw new Error((response.body as ApiError).error || 'Failed to list research projects');
}

/**
 * Get research project details
 */
export async function getResearchProject(researchId: string): Promise<ResearchProject | null> {
  const client = createApiClient();

  const response = await client.get(`api/research/${researchId}`);

  if (response.statusCode === 200) {
    return response.body as ResearchProject;
  }

  if (response.statusCode === 404) {
    return null;
  }

  throw new Error((response.body as ApiError).error || 'Failed to get research project');
}

/**
 * List artifacts for a research project
 */
export async function listArtifacts(researchId: string): Promise<Artifact[]> {
  const client = createApiClient();

  const response = await client.get(`api/artifacts`, {
    searchParams: { researchId },
  });

  if (response.statusCode === 200) {
    const data = response.body as { artifacts: Artifact[] };
    return data.artifacts || [];
  }

  throw new Error((response.body as ApiError).error || 'Failed to list artifacts');
}

/**
 * Download artifact
 */
export async function downloadArtifact(artifactId: string): Promise<{ content: string; filename: string }> {
  const client = createApiClient();

  const response = await client.get(`api/artifacts/${artifactId}`);

  if (response.statusCode === 200) {
    const data = response.body as Artifact & { content: string };
    return { content: data.content, filename: data.filename };
  }

  throw new Error((response.body as ApiError).error || 'Failed to download artifact');
}

/**
 * Search across artifacts and manuscripts
 */
export async function search(query: string, type?: string, limit?: number): Promise<any[]> {
  const client = createApiClient();

  const searchParams: Record<string, string | number> = { q: query };
  if (type) searchParams.type = type;
  if (limit) searchParams.limit = limit;

  const response = await client.get('api/search', { searchParams });

  if (response.statusCode === 200) {
    const data = response.body as { results: any[] };
    return data.results || [];
  }

  throw new Error((response.body as ApiError).error || 'Search failed');
}
