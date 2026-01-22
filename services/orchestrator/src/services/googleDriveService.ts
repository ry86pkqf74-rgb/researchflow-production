/**
 * Google Drive Integration Service
 * Task: Google Docs/Drive Export Integration
 *
 * Provides:
 * - OAuth2 flow for Google authentication
 * - Upload manuscripts to Google Drive
 * - Convert to Google Docs format
 * - Manage shared documents
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const GoogleDriveConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

export const UploadOptionsSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().default('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  convertToGoogleDocs: z.boolean().default(true),
  folderId: z.string().optional(),
  description: z.string().optional(),
});

export type GoogleDriveConfig = z.infer<typeof GoogleDriveConfigSchema>;
export type UploadOptions = z.infer<typeof UploadOptionsSchema>;

export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  createdTime: string;
  modifiedTime: string;
}

export interface UploadResult {
  success: boolean;
  file?: GoogleFile;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// In-Memory Token Storage (in production, use secure DB storage)
// ─────────────────────────────────────────────────────────────

const tokenStore = new Map<string, {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}>();

// ─────────────────────────────────────────────────────────────
// OAuth2 Configuration
// ─────────────────────────────────────────────────────────────

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

// ─────────────────────────────────────────────────────────────
// OAuth2 Functions
// ─────────────────────────────────────────────────────────────

/**
 * Generate OAuth2 authorization URL
 */
export function getAuthorizationUrl(config: GoogleDriveConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: GoogleDriveConfig,
  code: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  config: GoogleDriveConfig,
  refreshToken: string
): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Store tokens for an organization
 */
export function storeTokens(
  orgId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  tokenStore.set(orgId, {
    accessToken,
    refreshToken,
    expiresAt,
  });
}

/**
 * Get valid access token for an organization (refreshing if needed)
 */
export async function getValidAccessToken(
  orgId: string,
  config: GoogleDriveConfig
): Promise<string | null> {
  const stored = tokenStore.get(orgId);

  if (!stored) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = stored.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired && stored.refreshToken) {
    try {
      const { accessToken, expiresIn } = await refreshAccessToken(
        config,
        stored.refreshToken
      );
      storeTokens(orgId, accessToken, stored.refreshToken, expiresIn);
      return accessToken;
    } catch (error) {
      console.error('[GoogleDrive] Token refresh failed:', error);
      return null;
    }
  }

  return stored.accessToken;
}

// ─────────────────────────────────────────────────────────────
// Google Drive API Functions
// ─────────────────────────────────────────────────────────────

/**
 * Upload a file to Google Drive
 */
export async function uploadFile(
  accessToken: string,
  content: Buffer | string,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    // Determine target MIME type
    const targetMimeType = options.convertToGoogleDocs
      ? 'application/vnd.google-apps.document'
      : options.mimeType;

    // Create file metadata
    const metadata: Record<string, any> = {
      name: options.fileName,
      mimeType: targetMimeType,
    };

    if (options.folderId) {
      metadata.parents = [options.folderId];
    }

    if (options.description) {
      metadata.description = options.description;
    }

    // Create multipart upload
    const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
    const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${options.mimeType}`,
      'Content-Transfer-Encoding: base64',
      '',
      contentBuffer.toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');

    const response = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    const file = await response.json();

    return {
      success: true,
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      },
    };
  } catch (error: any) {
    console.error('[GoogleDrive] Upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List files in Google Drive
 */
export async function listFiles(
  accessToken: string,
  folderId?: string,
  pageSize = 50
): Promise<GoogleFile[]> {
  let query = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";

  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  const params = new URLSearchParams({
    q: query,
    pageSize: pageSize.toString(),
    fields: 'files(id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime)',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * List folders in Google Drive
 */
export async function listFolders(
  accessToken: string,
  parentId?: string
): Promise<GoogleFile[]> {
  let query = "trashed = false and mimeType = 'application/vnd.google-apps.folder'";

  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const params = new URLSearchParams({
    q: query,
    pageSize: '100',
    fields: 'files(id,name,mimeType,webViewLink,createdTime,modifiedTime)',
    orderBy: 'name',
  });

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list folders: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Get file metadata
 */
export async function getFile(
  accessToken: string,
  fileId: string
): Promise<GoogleFile | null> {
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    throw new Error(`Failed to get file: ${error}`);
  }

  return response.json();
}

/**
 * Check if Google Drive is configured for an organization
 */
export function isConfigured(orgId: string): boolean {
  return tokenStore.has(orgId);
}

/**
 * Remove stored tokens for an organization (disconnect)
 */
export function disconnect(orgId: string): boolean {
  return tokenStore.delete(orgId);
}

// ─────────────────────────────────────────────────────────────
// Export Default
// ─────────────────────────────────────────────────────────────

export default {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  storeTokens,
  getValidAccessToken,
  uploadFile,
  listFiles,
  listFolders,
  getFile,
  isConfigured,
  disconnect,
};
