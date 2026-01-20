/**
 * Notion Service (Task 86)
 *
 * Handles Notion integration for syncing artifacts and manuscripts.
 * Stub implementation - actual Notion API calls would be added in production.
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const FEATURE_NOTION = process.env.FEATURE_NOTION !== 'false';

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  createdTime: string;
  lastEditedTime: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
}

export interface NotionSyncConfig {
  databaseId: string;
  autoSync: boolean;
  syncDirection: 'push' | 'pull' | 'bidirectional';
  fieldMappings: Record<string, string>;
}

/**
 * Check if Notion integration is configured
 */
export function isNotionConfigured(): boolean {
  return FEATURE_NOTION && !!NOTION_API_KEY;
}

/**
 * Make authenticated request to Notion API
 */
async function notionRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, any>
): Promise<any> {
  if (!NOTION_API_KEY) {
    throw new Error('Notion API key not configured');
  }

  const response = await fetch(`${NOTION_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Notion API error: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * List databases accessible to the integration
 */
export async function listDatabases(): Promise<NotionDatabase[]> {
  if (!isNotionConfigured()) {
    console.log('[NotionService] Not configured, returning empty list');
    return [];
  }

  try {
    const response = await notionRequest('/search', 'POST', {
      filter: { property: 'object', value: 'database' },
    });

    return response.results.map((db: any) => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled',
      url: db.url,
    }));
  } catch (error: any) {
    console.error('[NotionService] Error listing databases:', error.message);
    return [];
  }
}

/**
 * Create a page in a database
 */
export async function createPage(
  databaseId: string,
  properties: Record<string, any>,
  content?: string
): Promise<NotionPage | null> {
  if (!isNotionConfigured()) {
    console.log('[NotionService] Not configured, skipping page creation');
    return null;
  }

  try {
    const children = content
      ? [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content } }],
            },
          },
        ]
      : undefined;

    const response = await notionRequest('/pages', 'POST', {
      parent: { database_id: databaseId },
      properties,
      children,
    });

    return {
      id: response.id,
      url: response.url,
      title: properties.Name?.title?.[0]?.text?.content || 'Untitled',
      createdTime: response.created_time,
      lastEditedTime: response.last_edited_time,
    };
  } catch (error: any) {
    console.error('[NotionService] Error creating page:', error.message);
    return null;
  }
}

/**
 * Update an existing page
 */
export async function updatePage(
  pageId: string,
  properties: Record<string, any>
): Promise<NotionPage | null> {
  if (!isNotionConfigured()) {
    console.log('[NotionService] Not configured, skipping page update');
    return null;
  }

  try {
    const response = await notionRequest(`/pages/${pageId}`, 'PATCH', {
      properties,
    });

    return {
      id: response.id,
      url: response.url,
      title: properties.Name?.title?.[0]?.text?.content || 'Untitled',
      createdTime: response.created_time,
      lastEditedTime: response.last_edited_time,
    };
  } catch (error: any) {
    console.error('[NotionService] Error updating page:', error.message);
    return null;
  }
}

/**
 * Get a page by ID
 */
export async function getPage(pageId: string): Promise<NotionPage | null> {
  if (!isNotionConfigured()) {
    return null;
  }

  try {
    const response = await notionRequest(`/pages/${pageId}`);

    return {
      id: response.id,
      url: response.url,
      title: 'Untitled', // Would need to parse properties
      createdTime: response.created_time,
      lastEditedTime: response.last_edited_time,
    };
  } catch (error: any) {
    console.error('[NotionService] Error getting page:', error.message);
    return null;
  }
}

/**
 * Convert artifact to Notion properties
 */
export function artifactToNotionProperties(artifact: {
  id: string;
  filename: string;
  artifactType: string;
  createdAt: Date;
  researchTitle?: string;
}): Record<string, any> {
  return {
    Name: {
      title: [{ text: { content: artifact.filename } }],
    },
    Type: {
      select: { name: artifact.artifactType },
    },
    'Created At': {
      date: { start: artifact.createdAt.toISOString() },
    },
    'Research Project': {
      rich_text: [{ text: { content: artifact.researchTitle || '' } }],
    },
    'Artifact ID': {
      rich_text: [{ text: { content: artifact.id } }],
    },
  };
}

/**
 * Convert manuscript to Notion properties
 */
export function manuscriptToNotionProperties(manuscript: {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  researchTitle?: string;
}): Record<string, any> {
  return {
    Name: {
      title: [{ text: { content: manuscript.title } }],
    },
    Status: {
      select: { name: manuscript.status },
    },
    'Created At': {
      date: { start: manuscript.createdAt.toISOString() },
    },
    'Research Project': {
      rich_text: [{ text: { content: manuscript.researchTitle || '' } }],
    },
    'Manuscript ID': {
      rich_text: [{ text: { content: manuscript.id } }],
    },
  };
}

/**
 * Sync artifact to Notion
 */
export async function syncArtifactToNotion(
  config: NotionSyncConfig,
  artifact: {
    id: string;
    filename: string;
    artifactType: string;
    createdAt: Date;
    researchTitle?: string;
  },
  existingPageId?: string
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  if (!isNotionConfigured()) {
    return { success: false, error: 'Notion not configured' };
  }

  const properties = artifactToNotionProperties(artifact);

  try {
    if (existingPageId) {
      await updatePage(existingPageId, properties);
      return { success: true, pageId: existingPageId };
    } else {
      const page = await createPage(config.databaseId, properties);
      return page
        ? { success: true, pageId: page.id }
        : { success: false, error: 'Failed to create page' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
