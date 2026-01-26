import { db } from '../lib/db';
import { orgCustomFields, entityCustomFieldValues, auditLogs } from '@researchflow/core/types/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Field Definition Schema
 *
 * Defines the structure of a custom field with validation rules
 */
export const FieldDefinitionSchema = z.object({
  fieldKey: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  inputType: z.enum(['text', 'number', 'select', 'multiselect', 'date', 'boolean']),
  required: z.boolean(),
  options: z.array(z.string()).optional(), // For select/multiselect
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
  order: z.number().int(),
  helpText: z.string().optional(),
});

export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

/**
 * Custom Fields Schema Validator
 */
export const CustomFieldsSchemaValidator = z.array(FieldDefinitionSchema);

/**
 * Custom Fields Service
 *
 * Manages organization-level custom field schemas and entity-level field values.
 *
 * PHI Safety:
 * - Logs warnings when PHI-risky field types are created
 * - Never logs actual field values
 * - Scoped to organization level
 */
export class CustomFieldsService {
  /**
   * Get the custom field schema for an entity type in an org
   *
   * @param orgId - Organization ID
   * @param entityType - Entity type ('project', 'dataset', 'artifact')
   * @returns Array of field definitions or empty array if not found
   */
  async getFieldsSchema(orgId: string, entityType: string): Promise<FieldDefinition[]> {
    try {
      const result = await db.select()
        .from(orgCustomFields)
        .where(
          and(
            eq(orgCustomFields.orgId, orgId),
            eq(orgCustomFields.entityType, entityType)
          )
        )
        .limit(1);

      return result.length > 0 ? (result[0].schemaJson as FieldDefinition[]) : [];
    } catch (error) {
      console.error(`[CustomFields] Error fetching schema for ${orgId}:${entityType}:`, error);
      return [];
    }
  }

  /**
   * Update the custom field schema for an entity type
   *
   * Includes PHI risk detection for field types that commonly capture PHI
   *
   * @param orgId - Organization ID
   * @param entityType - Entity type
   * @param schema - Array of field definitions
   * @param userId - User performing the update
   */
  async updateFieldsSchema(
    orgId: string,
    entityType: string,
    schema: unknown,
    userId: string
  ): Promise<void> {
    // Validate schema
    const validatedSchema = CustomFieldsSchemaValidator.parse(schema);

    // PHI Risk Detection: Warn if field types commonly capture PHI
    const riskyFields = validatedSchema.filter(f => {
      const label = f.label.toLowerCase();
      return (
        f.inputType === 'text' &&
        (
          label.includes('name') ||
          label.includes('email') ||
          label.includes('phone') ||
          label.includes('address') ||
          label.includes('ssn') ||
          label.includes('mrn') ||
          label.includes('date of birth') ||
          label.includes('dob')
        )
      );
    });

    if (riskyFields.length > 0) {
      console.warn(
        `[CustomFields] PHI RISK: Org ${orgId} created potentially PHI-capturing fields: ` +
        `${riskyFields.map(f => f.fieldKey).join(', ')}. ` +
        `Ensure these fields are not used for actual PHI data.`
      );

      // TODO: Could optionally block or require additional approval for risky fields
    }

    try {
      // Upsert the schema
      await db.insert(orgCustomFields)
        .values({
          orgId,
          entityType,
          schemaJson: validatedSchema,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [orgCustomFields.orgId, orgCustomFields.entityType],
          set: {
            schemaJson: validatedSchema,
            version: sql`${orgCustomFields.version} + 1`,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        });

      // Audit log
      await db.insert(auditLogs).values({
        eventType: 'CUSTOM_FIELDS',
        action: 'UPDATE_SCHEMA',
        userId,
        resourceType: 'org_custom_fields',
        resourceId: `${orgId}:${entityType}`,
        details: {
          fieldCount: validatedSchema.length,
          riskyFieldCount: riskyFields.length,
        },
      });

      console.log(
        `[CustomFields] Schema updated for ${orgId}:${entityType} ` +
        `(${validatedSchema.length} fields, version incremented)`
      );
    } catch (error) {
      console.error(`[CustomFields] Error updating schema for ${orgId}:${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Get custom field values for an entity
   *
   * @param orgId - Organization ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns Object with field values or empty object if not found
   */
  async getFieldValues(
    orgId: string,
    entityType: string,
    entityId: string
  ): Promise<Record<string, unknown>> {
    try {
      const result = await db.select()
        .from(entityCustomFieldValues)
        .where(
          and(
            eq(entityCustomFieldValues.orgId, orgId),
            eq(entityCustomFieldValues.entityType, entityType),
            eq(entityCustomFieldValues.entityId, entityId)
          )
        )
        .limit(1);

      return result.length > 0 ? (result[0].valuesJson as Record<string, unknown>) : {};
    } catch (error) {
      console.error(
        `[CustomFields] Error fetching values for ${orgId}:${entityType}:${entityId}:`,
        error
      );
      return {};
    }
  }

  /**
   * Set custom field values for an entity
   *
   * Validates required fields against the schema
   *
   * @param orgId - Organization ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param values - Field values object
   */
  async setFieldValues(
    orgId: string,
    entityType: string,
    entityId: string,
    values: Record<string, unknown>
  ): Promise<void> {
    // Get the schema to validate against
    const schema = await this.getFieldsSchema(orgId, entityType);

    if (schema.length === 0) {
      throw new Error(`No custom field schema defined for ${orgId}:${entityType}`);
    }

    // Validate required fields
    const requiredFields = schema.filter(f => f.required).map(f => f.fieldKey);
    const missingFields = requiredFields.filter(key => !(key in values));

    if (missingFields.length > 0) {
      throw new Error(`Required fields missing: ${missingFields.join(', ')}`);
    }

    // Validate field types (basic validation)
    for (const field of schema) {
      const value = values[field.fieldKey];

      if (value === undefined || value === null) {
        if (field.required) {
          throw new Error(`Required field ${field.fieldKey} is missing`);
        }
        continue;
      }

      // Type validation
      switch (field.inputType) {
        case 'number':
          if (typeof value !== 'number') {
            throw new Error(`Field ${field.fieldKey} must be a number`);
          }
          if (field.validation?.min !== undefined && value < field.validation.min) {
            throw new Error(`Field ${field.fieldKey} must be at least ${field.validation.min}`);
          }
          if (field.validation?.max !== undefined && value > field.validation.max) {
            throw new Error(`Field ${field.fieldKey} must be at most ${field.validation.max}`);
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            throw new Error(`Field ${field.fieldKey} must be a boolean`);
          }
          break;

        case 'select':
          if (typeof value !== 'string') {
            throw new Error(`Field ${field.fieldKey} must be a string`);
          }
          if (field.options && !field.options.includes(value)) {
            throw new Error(
              `Field ${field.fieldKey} must be one of: ${field.options.join(', ')}`
            );
          }
          break;

        case 'multiselect':
          if (!Array.isArray(value)) {
            throw new Error(`Field ${field.fieldKey} must be an array`);
          }
          if (field.options) {
            const invalidOptions = value.filter(v => !field.options!.includes(v));
            if (invalidOptions.length > 0) {
              throw new Error(
                `Field ${field.fieldKey} contains invalid options: ${invalidOptions.join(', ')}`
              );
            }
          }
          break;

        case 'date':
          // Check if value is a valid ISO date string or Date object
          if (typeof value !== 'string' && !(value instanceof Date)) {
            throw new Error(`Field ${field.fieldKey} must be a valid date`);
          }
          break;
      }
    }

    try {
      // Upsert values
      await db.insert(entityCustomFieldValues)
        .values({
          orgId,
          entityType,
          entityId,
          valuesJson: values,
        })
        .onConflictDoUpdate({
          target: [
            entityCustomFieldValues.entityType,
            entityCustomFieldValues.entityId,
            entityCustomFieldValues.orgId,
          ],
          set: {
            valuesJson: values,
            updatedAt: new Date(),
          },
        });

      console.log(
        `[CustomFields] Values updated for ${orgId}:${entityType}:${entityId} ` +
        `(${Object.keys(values).length} fields)`
      );
    } catch (error) {
      console.error(
        `[CustomFields] Error setting values for ${orgId}:${entityType}:${entityId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete custom field values for an entity
   *
   * @param orgId - Organization ID
   * @param entityType - Entity type
   * @param entityId - Entity ID
   */
  async deleteFieldValues(
    orgId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    try {
      await db.delete(entityCustomFieldValues)
        .where(
          and(
            eq(entityCustomFieldValues.orgId, orgId),
            eq(entityCustomFieldValues.entityType, entityType),
            eq(entityCustomFieldValues.entityId, entityId)
          )
        );

      console.log(`[CustomFields] Values deleted for ${orgId}:${entityType}:${entityId}`);
    } catch (error) {
      console.error(
        `[CustomFields] Error deleting values for ${orgId}:${entityType}:${entityId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get schema version for an entity type
   *
   * @param orgId - Organization ID
   * @param entityType - Entity type
   * @returns Version number or null if not found
   */
  async getSchemaVersion(orgId: string, entityType: string): Promise<number | null> {
    try {
      const result = await db.select()
        .from(orgCustomFields)
        .where(
          and(
            eq(orgCustomFields.orgId, orgId),
            eq(orgCustomFields.entityType, entityType)
          )
        )
        .limit(1);

      return result.length > 0 ? result[0].version : null;
    } catch (error) {
      console.error(`[CustomFields] Error fetching schema version for ${orgId}:${entityType}:`, error);
      return null;
    }
  }
}

export const customFieldsService = new CustomFieldsService();
