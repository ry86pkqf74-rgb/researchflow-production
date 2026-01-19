/**
 * Schema Validator Middleware for Orchestrator
 *
 * Runtime validation middleware using Zod schemas for API endpoints.
 * Integrates with the schema registry to validate incoming data.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  generateZodSchema,
  validateWithSchema,
  SchemaDefinition,
  panderaToZod
} from '../../../../packages/core/src/schema/zod-generator.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Schema cache to avoid re-loading schemas on every request
 */
const schemaCache = new Map<string, z.ZodSchema>();

/**
 * Load schema from registry
 */
export async function loadSchemaFromRegistry(
  datasetName: string,
  version?: string
): Promise<z.ZodSchema | null> {
  const cacheKey = version ? `${datasetName}:${version}` : `${datasetName}:latest`;

  // Check cache
  if (schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey)!;
  }

  // Load from file system
  const schemaDir = process.env.SCHEMA_DIR || '/data/schemas';

  try {
    let schemaPath: string;

    if (version) {
      schemaPath = path.join(schemaDir, `${datasetName}_v${version}.json`);
    } else {
      // Load latest from registry
      const registryPath = path.join(schemaDir, 'schema_registry.json');
      const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'));

      const latestVersion = registry.schemas[datasetName]?.latest;
      if (!latestVersion) {
        return null;
      }

      schemaPath = path.join(schemaDir, `${datasetName}_v${latestVersion}.json`);
    }

    // Load schema file
    const schemaJson = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));

    // Convert to Zod
    const zodSchema = panderaToZod(schemaJson);

    // Cache it
    schemaCache.set(cacheKey, zodSchema);

    return zodSchema;
  } catch (error) {
    console.error(`Failed to load schema for ${datasetName}:`, error);
    return null;
  }
}

/**
 * Express middleware to validate request body against schema
 */
export function validateSchema(datasetName: string, version?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Load schema
      const schema = await loadSchemaFromRegistry(datasetName, version);

      if (!schema) {
        return res.status(500).json({
          error: 'Schema not found',
          dataset: datasetName,
          version: version || 'latest'
        });
      }

      // Validate request body
      const result = validateWithSchema(schema, req.body);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          dataset: datasetName,
          validationErrors: 'errors' in result ? 'errors' in result ? result.errors : [] : []
        });
      }

      // Attach validated data to request
      req.validatedData = result.data;

      next();
    } catch (error) {
      console.error('Schema validation error:', error);
      return res.status(500).json({
        error: 'Internal validation error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validateWithSchema(schema, req.query);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        validationErrors: 'errors' in result ? result.errors : []
      });
    }

    req.validatedQuery = result.data;
    next();
  };
}

/**
 * Validate array of objects (for batch endpoints)
 */
export function validateBatch(datasetName: string, version?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({
          error: 'Request body must be an array'
        });
      }

      // Load schema
      const itemSchema = await loadSchemaFromRegistry(datasetName, version);

      if (!itemSchema) {
        return res.status(500).json({
          error: 'Schema not found',
          dataset: datasetName
        });
      }

      // Create array schema
      const arraySchema = z.array(itemSchema);

      // Validate
      const result = validateWithSchema(arraySchema, req.body);

      if (!result.success) {
        return res.status(400).json({
          error: 'Batch validation failed',
          validationErrors: 'errors' in result ? result.errors : []
        });
      }

      req.validatedData = result.data;
      next();
    } catch (error) {
      console.error('Batch validation error:', error);
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
}

/**
 * Create validation middleware from inline schema definition
 */
export function validate(schemaDef: SchemaDefinition | z.ZodSchema) {
  const schema = schemaDef instanceof z.ZodSchema
    ? schemaDef
    : generateZodSchema(schemaDef);

  return (req: Request, res: Response, next: NextFunction) => {
    const result = validateWithSchema(schema, req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        validationErrors: 'errors' in result ? result.errors : []
      });
    }

    req.validatedData = result.data;
    next();
  };
}

/**
 * Clear schema cache (useful for hot-reloading in development)
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: schemaCache.size,
    entries: Array.from(schemaCache.keys())
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      validatedQuery?: any;
    }
  }
}

// Common validation schemas for API endpoints
export const CommonValidators = {
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }),

  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  }),

  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  }).refine(data => data.endDate >= data.startDate, {
    message: 'End date must be after start date'
  }),

  search: z.object({
    q: z.string().min(1),
    fields: z.array(z.string()).optional()
  }),

  jobSubmission: z.object({
    datasetName: z.string().min(1),
    fileUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).optional()
  })
};

// Example usage in routes:
/*
import { validateSchema, validateQuery, CommonValidators } from './validation/schema-validator';

// Validate body against registered schema
router.post('/artifacts/:dataset',
  validateSchema('patient_data'),
  async (req, res) => {
    const validatedData = req.validatedData;
    // ... handle request
  }
);

// Validate query parameters
router.get('/artifacts',
  validateQuery(CommonValidators.pagination),
  async (req, res) => {
    const { page, limit } = req.validatedQuery;
    // ... handle request
  }
);

// Validate batch upload
router.post('/artifacts/:dataset/batch',
  validateBatch('patient_data'),
  async (req, res) => {
    const validatedBatch = req.validatedData;
    // ... handle batch
  }
);

// Inline schema validation
router.post('/custom-endpoint',
  validate({
    name: 'custom_schema',
    version: '1.0.0',
    columns: [
      { name: 'id', type: 'string', nullable: false },
      { name: 'value', type: 'number', nullable: false }
    ]
  }),
  async (req, res) => {
    // ... handle request
  }
);
*/
