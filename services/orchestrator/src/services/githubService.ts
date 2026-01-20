/**
 * GitHub Service (Task 92)
 *
 * Handles GitHub integration for importing code artifacts,
 * linking repositories, and managing research code.
 */

const GITHUB_PAT = process.env.GITHUB_PAT || '';
const GITHUB_API_URL = 'https://api.github.com';
const FEATURE_GITHUB = process.env.FEATURE_GITHUB !== 'false';

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  private: boolean;
  language: string | null;
  updatedAt: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  downloadUrl: string | null;
  content?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

/**
 * Check if GitHub integration is configured
 */
export function isGitHubConfigured(): boolean {
  return FEATURE_GITHUB && !!GITHUB_PAT;
}

/**
 * Make authenticated request to GitHub API
 */
async function githubRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, any>
): Promise<any> {
  if (!GITHUB_PAT) {
    throw new Error('GitHub PAT not configured');
  }

  const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Get authenticated user info
 */
export async function getAuthenticatedUser(): Promise<{
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
} | null> {
  if (!isGitHubConfigured()) {
    return null;
  }

  try {
    const user = await githubRequest('/user');
    return {
      login: user.login,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
    };
  } catch (error: any) {
    console.error('[GitHubService] Error getting user:', error.message);
    return null;
  }
}

/**
 * List user's repositories
 */
export async function listRepositories(options?: {
  visibility?: 'all' | 'public' | 'private';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  perPage?: number;
}): Promise<GitHubRepo[]> {
  if (!isGitHubConfigured()) {
    console.log('[GitHubService] Not configured, returning empty list');
    return [];
  }

  try {
    const params = new URLSearchParams({
      visibility: options?.visibility || 'all',
      sort: options?.sort || 'updated',
      per_page: String(options?.perPage || 30),
    });

    const repos = await githubRequest(`/user/repos?${params}`);

    return repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      private: repo.private,
      language: repo.language,
      updatedAt: repo.updated_at,
    }));
  } catch (error: any) {
    console.error('[GitHubService] Error listing repos:', error.message);
    return [];
  }
}

/**
 * Get repository contents
 */
export async function getRepoContents(
  owner: string,
  repo: string,
  path: string = ''
): Promise<GitHubFile[]> {
  if (!isGitHubConfigured()) {
    return [];
  }

  try {
    const contents = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`);

    // Handle single file response
    if (!Array.isArray(contents)) {
      return [{
        name: contents.name,
        path: contents.path,
        sha: contents.sha,
        size: contents.size,
        type: contents.type,
        downloadUrl: contents.download_url,
        content: contents.content ? Buffer.from(contents.content, 'base64').toString() : undefined,
      }];
    }

    return contents.map((item: any) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      type: item.type,
      downloadUrl: item.download_url,
    }));
  } catch (error: any) {
    console.error('[GitHubService] Error getting contents:', error.message);
    return [];
  }
}

/**
 * Get file content
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  if (!isGitHubConfigured()) {
    return null;
  }

  try {
    const file = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`);

    if (file.type !== 'file' || !file.content) {
      return null;
    }

    return Buffer.from(file.content, 'base64').toString();
  } catch (error: any) {
    console.error('[GitHubService] Error getting file:', error.message);
    return null;
  }
}

/**
 * Get recent commits
 */
export async function getRecentCommits(
  owner: string,
  repo: string,
  options?: {
    sha?: string;
    path?: string;
    perPage?: number;
  }
): Promise<GitHubCommit[]> {
  if (!isGitHubConfigured()) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      per_page: String(options?.perPage || 10),
    });

    if (options?.sha) params.set('sha', options.sha);
    if (options?.path) params.set('path', options.path);

    const commits = await githubRequest(`/repos/${owner}/${repo}/commits?${params}`);

    return commits.map((commit: any) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
      },
      url: commit.html_url,
    }));
  } catch (error: any) {
    console.error('[GitHubService] Error getting commits:', error.message);
    return [];
  }
}

/**
 * Download a file from repository
 */
export async function downloadFile(downloadUrl: string): Promise<Buffer | null> {
  if (!isGitHubConfigured()) {
    return null;
  }

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error('[GitHubService] Error downloading file:', error.message);
    return null;
  }
}

/**
 * Import files from a repository path as artifacts
 */
export async function importFilesAsArtifacts(
  owner: string,
  repo: string,
  path: string,
  filePatterns?: string[]
): Promise<Array<{
  filename: string;
  path: string;
  content: Buffer | null;
  size: number;
}>> {
  if (!isGitHubConfigured()) {
    return [];
  }

  const contents = await getRepoContents(owner, repo, path);
  const files = contents.filter(f => f.type === 'file');

  // Filter by patterns if provided
  const filteredFiles = filePatterns
    ? files.filter(f => filePatterns.some(p => {
        const regex = new RegExp(p.replace('*', '.*'));
        return regex.test(f.name);
      }))
    : files;

  const artifacts = await Promise.all(
    filteredFiles.map(async (file) => {
      const content = file.downloadUrl ? await downloadFile(file.downloadUrl) : null;
      return {
        filename: file.name,
        path: file.path,
        content,
        size: file.size,
      };
    })
  );

  return artifacts;
}

/**
 * Parse GitHub repository URL
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /github\.com:([^\/]+)\/([^\/]+)\.git/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
      };
    }
  }

  return null;
}
