/**
 * GDPR Consent Routes (Task 73)
 *
 * Provides endpoints for consent management:
 * - GET /api/consent/status - Get user's consent status
 * - POST /api/consent/grant - Grant consent
 * - POST /api/consent/revoke - Revoke consent
 * - GET /api/consent/history - Get consent history
 * - GET /api/consent/export - GDPR data export
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../db';
import { userConsents, auditLogs } from '@researchflow/core/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { logAction } from '../services/audit-service';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Current consent version from env
const CONSENT_VERSION = process.env.CONSENT_VERSION || '1.0.0';

/**
 * GET /api/consent/status
 * Get current consent status for the authenticated user
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    // Get all current (non-revoked) consents for user
    const consents = await db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, user.id),
          isNull(userConsents.revokedAt)
        )
      )
      .orderBy(desc(userConsents.createdAt));

    // Map to status format
    const consentStatus = consents.reduce((acc, consent) => {
      acc[consent.consentType] = {
        granted: consent.granted,
        version: consent.consentVersion,
        grantedAt: consent.grantedAt,
        expiresAt: consent.expiresAt,
        legalBasis: consent.legalBasis
      };
      return acc;
    }, {} as Record<string, unknown>);

    // Check if current version is accepted
    const hasCurrentVersion = consents.some(c =>
      c.consentVersion === CONSENT_VERSION && c.granted
    );

    res.json({
      userId: user.id,
      consents: consentStatus,
      currentVersion: CONSENT_VERSION,
      hasCurrentVersionConsent: hasCurrentVersion,
      requiresConsentUpdate: !hasCurrentVersion && process.env.GDPR_CONSENT_REQUIRED === 'true'
    });
  })
);

/**
 * POST /api/consent/grant
 * Grant consent for specific types
 */
router.post(
  '/grant',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const {
      consentType,
      legalBasis = 'consent',
      purpose,
      dataCategories,
      retentionPeriodDays
    } = req.body;

    if (!consentType) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'consentType is required'
      });
    }

    // Validate consent type
    const validConsentTypes = ['data_processing', 'ai_usage', 'phi_access', 'marketing', 'research_participation', 'data_sharing', 'analytics'];
    if (!validConsentTypes.includes(consentType)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid consentType. Must be one of: ${validConsentTypes.join(', ')}`
      });
    }

    // Revoke any existing consent of this type first
    await db
      .update(userConsents)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(userConsents.userId, user.id),
          eq(userConsents.consentType, consentType),
          isNull(userConsents.revokedAt)
        )
      );

    // Calculate expiration if retention period specified
    let expiresAt: Date | null = null;
    if (retentionPeriodDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionPeriodDays);
    }

    // Create new consent record
    const [consent] = await db.insert(userConsents).values({
      userId: user.id,
      consentType,
      consentVersion: CONSENT_VERSION,
      granted: true,
      grantedAt: new Date(),
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
      legalBasis,
      purpose,
      dataCategories: dataCategories || null,
      retentionPeriodDays: retentionPeriodDays || null,
      expiresAt,
      metadata: {
        source: 'api',
        timestamp: new Date().toISOString()
      }
    }).returning();

    // Audit log
    await logAction({
      eventType: 'CONSENT',
      action: 'GRANTED',
      userId: user.id,
      resourceType: 'user_consent',
      resourceId: consent.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        consentType,
        version: CONSENT_VERSION,
        legalBasis
      }
    });

    res.status(201).json({
      message: 'Consent granted successfully',
      consentId: consent.id,
      consentType,
      version: CONSENT_VERSION,
      grantedAt: consent.grantedAt,
      expiresAt: consent.expiresAt
    });
  })
);

/**
 * POST /api/consent/revoke
 * Revoke consent for specific types
 */
router.post(
  '/revoke',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const { consentType, reason } = req.body;

    if (!consentType) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'consentType is required'
      });
    }

    // Find and revoke existing consent
    const updated = await db
      .update(userConsents)
      .set({
        revokedAt: new Date(),
        granted: false,
        metadata: {
          revocationReason: reason,
          revokedAt: new Date().toISOString(),
          revokedVia: 'api'
        }
      })
      .where(
        and(
          eq(userConsents.userId, user.id),
          eq(userConsents.consentType, consentType),
          isNull(userConsents.revokedAt)
        )
      )
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'No active consent found for this type'
      });
    }

    // Audit log
    await logAction({
      eventType: 'CONSENT',
      action: 'REVOKED',
      userId: user.id,
      resourceType: 'user_consent',
      resourceId: updated[0].id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        consentType,
        reason
      }
    });

    res.json({
      message: 'Consent revoked successfully',
      consentType,
      revokedAt: updated[0].revokedAt
    });
  })
);

/**
 * GET /api/consent/history
 * Get consent history for the authenticated user
 */
router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await db
      .select()
      .from(userConsents)
      .where(eq(userConsents.userId, user.id))
      .orderBy(desc(userConsents.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      history: history.map(h => ({
        id: h.id,
        consentType: h.consentType,
        version: h.consentVersion,
        granted: h.granted,
        grantedAt: h.grantedAt,
        revokedAt: h.revokedAt,
        legalBasis: h.legalBasis,
        expiresAt: h.expiresAt,
        createdAt: h.createdAt
      })),
      total: history.length,
      limit,
      offset
    });
  })
);

/**
 * GET /api/consent/export
 * GDPR data export - export all user data
 */
router.get(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    // Get all consents
    const consents = await db
      .select()
      .from(userConsents)
      .where(eq(userConsents.userId, user.id))
      .orderBy(desc(userConsents.createdAt));

    // Get audit logs for this user (limited to consent-related)
    const auditHistory = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.userId, user.id),
          eq(auditLogs.eventType, 'CONSENT')
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(1000);

    // Audit this export
    await logAction({
      eventType: 'CONSENT',
      action: 'DATA_EXPORT',
      userId: user.id,
      resourceType: 'gdpr_export',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        consentRecords: consents.length,
        auditRecords: auditHistory.length
      }
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      userId: user.id,
      consents: consents.map(c => ({
        id: c.id,
        type: c.consentType,
        version: c.consentVersion,
        granted: c.granted,
        grantedAt: c.grantedAt,
        revokedAt: c.revokedAt,
        legalBasis: c.legalBasis,
        purpose: c.purpose,
        dataCategories: c.dataCategories,
        retentionPeriodDays: c.retentionPeriodDays,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt
      })),
      auditHistory: auditHistory.map(a => ({
        id: a.id,
        eventType: a.eventType,
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        createdAt: a.createdAt
        // Note: details excluded to avoid PHI leakage
      })),
      dataRetentionPolicy: {
        retentionPeriodDays: parseInt(process.env.DATA_RETENTION_DAYS || '365', 10),
        description: 'Data is retained for the specified period after last activity'
      },
      rights: {
        access: 'You have the right to access your personal data',
        rectification: 'You have the right to correct inaccurate personal data',
        erasure: 'You have the right to request deletion of your personal data',
        portability: 'You have the right to receive your data in a structured format',
        restriction: 'You have the right to restrict processing of your data',
        objection: 'You have the right to object to processing of your data'
      }
    };

    // Set content type for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=gdpr-export-${user.id}-${Date.now()}.json`);

    res.json(exportData);
  })
);

/**
 * POST /api/consent/batch
 * Grant multiple consents at once (for onboarding)
 */
router.post(
  '/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const { consents: consentRequests } = req.body;

    if (!Array.isArray(consentRequests) || consentRequests.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'consents array is required'
      });
    }

    const results = [];

    for (const consentReq of consentRequests) {
      const { consentType, granted, legalBasis = 'consent', purpose } = consentReq;

      if (!consentType) continue;

      // Revoke existing
      await db
        .update(userConsents)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(userConsents.userId, user.id),
            eq(userConsents.consentType, consentType),
            isNull(userConsents.revokedAt)
          )
        );

      // Create new
      const [consent] = await db.insert(userConsents).values({
        userId: user.id,
        consentType,
        consentVersion: CONSENT_VERSION,
        granted: granted !== false,
        grantedAt: granted !== false ? new Date() : null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        legalBasis,
        purpose
      }).returning();

      results.push({
        consentType,
        granted: consent.granted,
        consentId: consent.id
      });
    }

    // Audit log
    await logAction({
      eventType: 'CONSENT',
      action: 'BATCH_UPDATE',
      userId: user.id,
      resourceType: 'user_consent',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        count: results.length,
        types: results.map(r => r.consentType)
      }
    });

    res.status(201).json({
      message: 'Consents updated successfully',
      results,
      version: CONSENT_VERSION
    });
  })
);

export default router;
