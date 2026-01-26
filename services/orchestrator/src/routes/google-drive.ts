/**
 * Google Drive Integration Routes
 * Routes for Google Drive/Docs export and sync
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as googleDriveService from '../services/googleDriveService';
import { db } from '../../db';
import { orgIntegrations } from '@researchflow/core/types/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/governance';
import { resolveOrgContext, requireOrgMember, requireOrgCapability } from '../middleware/org-context';

export const googleDriveRouter = Router();

// Authentication required for all routes
googleDriveRouter.use(requireAuth);
googleDriveRouter.use(resolveOrgContext);
googleDriveRouter.use(requireOrgMember);

// ─────────────────────────────────────────────────────────────
// OAuth2 Flow
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/google-drive/authorize
 * Start OAuth2 flow - redirect to Google consent screen
 */
googleDriveRouter.get('/authorize', requireOrgCapability('integrations'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    // Get Google OAuth config from environment or org settings
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/integrations/google-drive/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      orgId,
      timestamp: Date.now(),
    })).toString('base64url');

    const authUrl = googleDriveService.getAuthorizationUrl(
      { clientId, clientSecret, redirectUri },
      state
    );

    res.json({ authUrl });
  } catch (error: any) {
    console.error('[GoogleDrive] Error starting OAuth:', error);
    res.status(500).json({ error: 'Failed to start OAuth flow' });
  }
});

/**
 * GET /api/integrations/google-drive/callback
 * OAuth2 callback - exchange code for tokens
 */
googleDriveRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Decode and validate state
    let stateData: { orgId: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString());
    } catch {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    // Check timestamp (5 minute expiry)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return res.redirect('/settings/integrations?error=expired');
    }

    const orgId = stateData.orgId;

    // Get Google OAuth config
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/integrations/google-drive/callback`;

    // Exchange code for tokens
    const tokens = await googleDriveService.exchangeCodeForTokens(
      { clientId, clientSecret, redirectUri },
      code as string
    );

    // Store tokens
    googleDriveService.storeTokens(
      orgId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn
    );

    // Save integration record in database
    const [existing] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, 'google_drive')
      ))
      .limit(1);

    if (existing) {
      await db
        .update(orgIntegrations)
        .set({
          isActive: true,
          config: { connected: true, connectedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(orgIntegrations.id, existing.id));
    } else {
      await db.insert(orgIntegrations).values({
        orgId,
        integrationType: 'google_drive',
        isActive: true,
        config: { connected: true, connectedAt: new Date().toISOString() },
      });
    }

    res.redirect('/settings/integrations?success=google_drive');
  } catch (error: any) {
    console.error('[GoogleDrive] OAuth callback error:', error);
    res.redirect(`/settings/integrations?error=${encodeURIComponent(error.message)}`);
  }
});

// ─────────────────────────────────────────────────────────────
// Status & Disconnect
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/google-drive/status
 * Get Google Drive integration status
 */
googleDriveRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    const [integration] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, 'google_drive')
      ))
      .limit(1);

    const isConfigured = googleDriveService.isConfigured(orgId);

    res.json({
      configured: isConfigured,
      active: integration?.isActive ?? false,
      connectedAt: integration?.config?.connectedAt,
    });
  } catch (error: any) {
    console.error('[GoogleDrive] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/integrations/google-drive
 * Disconnect Google Drive integration
 */
googleDriveRouter.delete('/', requireOrgCapability('integrations'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    // Remove stored tokens
    googleDriveService.disconnect(orgId);

    // Update database record
    await db
      .update(orgIntegrations)
      .set({
        isActive: false,
        config: { connected: false, disconnectedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, 'google_drive')
      ));

    res.json({ success: true, message: 'Google Drive disconnected' });
  } catch (error: any) {
    console.error('[GoogleDrive] Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ─────────────────────────────────────────────────────────────
// File Operations
// ─────────────────────────────────────────────────────────────

const UploadRequestSchema = z.object({
  content: z.string().min(1), // Base64 encoded content or text
  fileName: z.string().min(1),
  mimeType: z.string().default('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  convertToGoogleDocs: z.boolean().default(true),
  folderId: z.string().optional(),
  description: z.string().optional(),
});

/**
 * POST /api/integrations/google-drive/upload
 * Upload a file to Google Drive
 */
googleDriveRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    const parseResult = UploadRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid upload request',
        details: parseResult.error.issues,
      });
    }

    const options = parseResult.data;

    // Get valid access token
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';

    const accessToken = await googleDriveService.getValidAccessToken(
      orgId,
      { clientId, clientSecret, redirectUri }
    );

    if (!accessToken) {
      return res.status(401).json({ error: 'Google Drive not connected. Please authorize first.' });
    }

    // Decode content if base64
    let content: Buffer;
    try {
      content = Buffer.from(options.content, 'base64');
    } catch {
      content = Buffer.from(options.content, 'utf-8');
    }

    // Upload file
    const result = await googleDriveService.uploadFile(accessToken, content, {
      fileName: options.fileName,
      mimeType: options.mimeType,
      convertToGoogleDocs: options.convertToGoogleDocs,
      folderId: options.folderId,
      description: options.description,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      file: result.file,
    });
  } catch (error: any) {
    console.error('[GoogleDrive] Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * GET /api/integrations/google-drive/files
 * List files in Google Drive
 */
googleDriveRouter.get('/files', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const folderId = req.query.folderId as string | undefined;

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';

    const accessToken = await googleDriveService.getValidAccessToken(
      orgId,
      { clientId, clientSecret, redirectUri }
    );

    if (!accessToken) {
      return res.status(401).json({ error: 'Google Drive not connected' });
    }

    const files = await googleDriveService.listFiles(accessToken, folderId);

    res.json({ files });
  } catch (error: any) {
    console.error('[GoogleDrive] Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * GET /api/integrations/google-drive/folders
 * List folders in Google Drive
 */
googleDriveRouter.get('/folders', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const parentId = req.query.parentId as string | undefined;

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';

    const accessToken = await googleDriveService.getValidAccessToken(
      orgId,
      { clientId, clientSecret, redirectUri }
    );

    if (!accessToken) {
      return res.status(401).json({ error: 'Google Drive not connected' });
    }

    const folders = await googleDriveService.listFolders(accessToken, parentId);

    res.json({ folders });
  } catch (error: any) {
    console.error('[GoogleDrive] Error listing folders:', error);
    res.status(500).json({ error: 'Failed to list folders' });
  }
});

export default googleDriveRouter;
