import express from 'express';
import { customFieldsService, CustomFieldsSchemaValidator } from '../services/customFieldsService';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';

const router = express.Router();

/**
 * GET /api/custom-fields/:entityType/schema
 * Get the custom field schema for an entity type
 *
 * Query params:
 * - orgId: Organization ID (required, from header or query)
 *
 * Returns: { schema: FieldDefinition[], version: number }
 */
router.get('/:entityType/schema',
  // TODO: Add requirePermission('VIEW') middleware
  asyncHandler(async (req, res) => {
    const { entityType } = req.params;
    const orgId = req.headers['x-organization-id'] as string || req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED',
      });
    }

    // Validate entity type
    const validEntityTypes = ['project', 'dataset', 'artifact'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        code: 'INVALID_ENTITY_TYPE',
        validTypes: validEntityTypes,
      });
    }

    const schema = await customFieldsService.getFieldsSchema(orgId, entityType);
    const version = await customFieldsService.getSchemaVersion(orgId, entityType);

    res.json({
      schema,
      version: version || 0,
    });
  })
);

/**
 * PUT /api/custom-fields/:entityType/schema
 * Update the custom field schema for an entity type (ADMIN only)
 *
 * Body: { schema: FieldDefinition[] }
 *
 * Returns: { success: boolean, version: number }
 */
router.put('/:entityType/schema',
  // TODO: Add blockInStandby() middleware
  // TODO: Add requireRole('ADMIN') middleware
  asyncHandler(async (req, res) => {
    const { entityType } = req.params;
    const orgId = req.headers['x-organization-id'] as string || req.query.orgId as string;
    const userId = req.user?.id || 'system';

    if (!orgId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED',
      });
    }

    // Validate entity type
    const validEntityTypes = ['project', 'dataset', 'artifact'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        code: 'INVALID_ENTITY_TYPE',
        validTypes: validEntityTypes,
      });
    }

    const updateSchemaBody = z.object({
      schema: CustomFieldsSchemaValidator,
    });

    const { schema } = updateSchemaBody.parse(req.body);

    await customFieldsService.updateFieldsSchema(orgId, entityType, schema, userId);

    const newVersion = await customFieldsService.getSchemaVersion(orgId, entityType);

    res.json({
      success: true,
      version: newVersion,
      fieldCount: schema.length,
    });
  })
);

/**
 * GET /api/custom-fields/:entityType/:entityId/values
 * Get custom field values for an entity
 *
 * Returns: { values: Record<string, unknown> }
 */
router.get('/:entityType/:entityId/values',
  // TODO: Add requirePermission('VIEW') middleware
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const orgId = req.headers['x-organization-id'] as string || req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED',
      });
    }

    const values = await customFieldsService.getFieldValues(orgId, entityType, entityId);

    res.json({ values });
  })
);

/**
 * PUT /api/custom-fields/:entityType/:entityId/values
 * Set custom field values for an entity
 *
 * Body: { values: Record<string, unknown> }
 *
 * Returns: { success: boolean }
 */
router.put('/:entityType/:entityId/values',
  // TODO: Add blockInStandby() middleware
  // TODO: Add requirePermission('CREATE') middleware
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const orgId = req.headers['x-organization-id'] as string || req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED',
      });
    }

    const setValuesBody = z.object({
      values: z.record(z.unknown()),
    });

    const { values } = setValuesBody.parse(req.body);

    await customFieldsService.setFieldValues(orgId, entityType, entityId, values);

    res.json({ success: true });
  })
);

/**
 * DELETE /api/custom-fields/:entityType/:entityId/values
 * Delete custom field values for an entity
 *
 * Returns: { success: boolean }
 */
router.delete('/:entityType/:entityId/values',
  // TODO: Add blockInStandby() middleware
  // TODO: Add requirePermission('DELETE') middleware
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const orgId = req.headers['x-organization-id'] as string || req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED',
      });
    }

    await customFieldsService.deleteFieldValues(orgId, entityType, entityId);

    res.json({ success: true });
  })
);

/**
 * GET /api/custom-fields/:entityType/entities
 * Get all entities with custom field values (for an entity type)
 *
 * Query params:
 * - limit: Max results (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * Returns: { entities: Array<{ entityId, values }>, total: number }
 */
router.get('/:entityType/entities',
  // TODO: Add requirePermission('VIEW') middleware
  asyncHandler(async (req, res) => {
    const { entityType } = req.params;
    const orgId = req.headers['x-organization-id'] as string || req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({
        error: 'Organization ID required',
        code: 'ORG_ID_REQUIRED',
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // This would need a DB query to fetch all entities with values
    // For now, return a placeholder
    res.json({
      entities: [],
      total: 0,
      limit,
      offset,
    });
  })
);

export default router;
