/**
 * Cloud Storage Integration Routes
 *
 * Provides endpoints for uploading files to Box and Dropbox.
 * Based on integrations_4.pdf specification.
 *
 * IMPORTANT: Only enable these integrations in configurations that
 * match your institutional policy for regulated data.
 *
 * Environment Variables Required:
 * - BOX_CLIENT_ID, BOX_CLIENT_SECRET (for OAuth flow)
 * - DROPBOX_APP_KEY, DROPBOX_APP_SECRET (for OAuth flow)
 */

import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { logAction } from '../services/audit-service';

const router = Router();

// Feature flag check
function isStorageIntegrationEnabled(): boolean {
  return process.env.ENABLE_CLOUD_STORAGE === 'true';
}

/**
 * Middleware to check if cloud storage is enabled
 */
function requireStorageEnabled(req: Request, res: Response, next: Function) {
  if (!isStorageIntegrationEnabled()) {
    return res.status(403).json({
      error: 'FEATURE_DISABLED',
      message: 'Cloud storage integrations are not enabled. Contact your administrator.'
    });
  }
  next();
}

// ============================================================================
// Box Integration
// ============================================================================

/**
 * POST /api/integrations/box/upload
 * Upload a file to Box
 *
 * Request body:
 * {
 *   accessToken: string;      // User's Box OAuth token
 *   folderId: string;         // Box folder ID ("0" for root)
 *   filename: string;         // Desired filename
 *   content: string;          // Base64-encoded file content
 *   createSharedLink?: boolean;
 * }
 */
router.post(
  '/box/upload',
  requireStorageEnabled,
  requirePermission('EXPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    const { accessToken, folderId, filename, content, createSharedLink } = req.body;

    // Validate required fields
    if (!accessToken || !folderId || !filename || !content) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'accessToken, folderId, filename, and content are required'
      });
    }

    // Decode base64 content
    const contentBytes = Buffer.from(content, 'base64');

    // Call Box API
    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;

    const form = new FormData();
    form.append('attributes', JSON.stringify({
      name: filename,
      parent: { id: folderId }
    }));
    form.append('file', contentBytes, { filename });

    const uploadResponse = await fetch('https://upload.box.com/api/2.0/files/content', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      return res.status(uploadResponse.status).json({
        error: 'BOX_UPLOAD_FAILED',
        message: errorData.message || 'Box upload failed',
        details: errorData
      });
    }

    const uploadData = await uploadResponse.json() as any;
    const fileEntry = uploadData.entries?.[0] || uploadData;

    // Optionally create shared link
    let sharedLink = null;
    if (createSharedLink && fileEntry.id) {
      const linkResponse = await fetch(`https://api.box.com/2.0/files/${fileEntry.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shared_link: { access: 'open' }
        })
      });

      if (linkResponse.ok) {
        const linkData = await linkResponse.json() as any;
        sharedLink = linkData.shared_link;
      }
    }

    // Log the action
    await logAction({
      userId: user.id,
      action: 'UPLOAD_TO_BOX',
      resourceType: 'file',
      resourceId: fileEntry.id,
      metadata: {
        filename,
        folderId,
        size: contentBytes.length
      }
    });

    res.json({
      success: true,
      file: {
        id: fileEntry.id,
        name: fileEntry.name,
        size: fileEntry.size
      },
      sharedLink
    });
  })
);

// ============================================================================
// Dropbox Integration
// ============================================================================

/**
 * POST /api/integrations/dropbox/upload
 * Upload a file to Dropbox
 *
 * Request body:
 * {
 *   accessToken: string;      // User's Dropbox OAuth token
 *   path: string;             // Dropbox path (must start with /)
 *   content: string;          // Base64-encoded file content
 *   createSharedLink?: boolean;
 * }
 */
router.post(
  '/dropbox/upload',
  requireStorageEnabled,
  requirePermission('EXPORT'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    const { accessToken, path, content, createSharedLink } = req.body;

    // Validate required fields
    if (!accessToken || !path || !content) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'accessToken, path, and content are required'
      });
    }

    // Ensure path starts with /
    const dropboxPath = path.startsWith('/') ? path : '/' + path;

    // Decode base64 content
    const contentBytes = Buffer.from(content, 'base64');

    const fetch = (await import('node-fetch')).default;

    // Dropbox uses content-upload style API
    const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'overwrite',
          autorename: false,
          mute: false
        }),
        'Content-Type': 'application/octet-stream'
      },
      body: contentBytes
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      return res.status(uploadResponse.status).json({
        error: 'DROPBOX_UPLOAD_FAILED',
        message: errorData.error_summary || 'Dropbox upload failed',
        details: errorData
      });
    }

    const uploadData = await uploadResponse.json() as any;

    // Optionally create shared link
    let sharedLink = null;
    if (createSharedLink) {
      try {
        const linkResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: dropboxPath,
            settings: { requested_visibility: 'public' }
          })
        });

        if (linkResponse.ok) {
          sharedLink = await linkResponse.json();
        } else if (linkResponse.status === 409) {
          // Link already exists, get it
          const existingResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: dropboxPath, direct_only: true })
          });
          if (existingResponse.ok) {
            const existingData = await existingResponse.json() as any;
            sharedLink = existingData.links?.[0];
          }
        }
      } catch (e) {
        // Shared link creation is optional, don't fail the whole request
        console.error('Failed to create shared link:', e);
      }
    }

    // Log the action
    await logAction({
      userId: user.id,
      action: 'UPLOAD_TO_DROPBOX',
      resourceType: 'file',
      resourceId: uploadData.id,
      metadata: {
        path: dropboxPath,
        size: contentBytes.length
      }
    });

    res.json({
      success: true,
      file: {
        id: uploadData.id,
        name: uploadData.name,
        path: uploadData.path_display,
        size: uploadData.size
      },
      sharedLink
    });
  })
);

/**
 * GET /api/integrations/status
 * Check which integrations are enabled
 */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      cloudStorage: {
        enabled: isStorageIntegrationEnabled(),
        providers: {
          box: isStorageIntegrationEnabled(),
          dropbox: isStorageIntegrationEnabled()
        }
      }
    });
  })
);

export default router;
