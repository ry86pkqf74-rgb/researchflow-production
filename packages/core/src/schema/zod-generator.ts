/**
 * Zod Schema Generator
 *
 * Generates Zod schemas for TypeScript runtime validation from schema definitions.
 * Supports conversion from Pandera schemas and manual schema definitions.
 *
 * Features:
 * - Type-safe runtime validation
 * - Automatic type inference
 * - Nested object support
 * - Custom validation rules
 * - Error message customization
 */

import { z } from 'zod';

export interface SchemaDefinition {
  name: string;
  version: string;
  description?: string;
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'object' | 'array';
  nullable: boolean;
  unique?: boolean;
  description?: string;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: Array<string | number>;
  itemType?: 'string' | 'number' | 'object';
}

export interface ValidationOptions {
  strict?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Generate Zod schema from schema definition
 */
export function generateZodSchema(
  schemaDef: SchemaDefinition,
  options: ValidationOptions = {}
): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of schemaDef.columns) {
    shape[col.name] = generateColumnSchema(col);
  }

  let schema = z.object(shape);

  // Apply options
  if (options.strict === false) {
    schema = schema.passthrough() as any;
  } else if (options.stripUnknown) {
    schema = schema.strip() as any;
  }

  return schema;
}

/**
 * Generate Zod schema for a single column
 */
function generateColumnSchema(col: ColumnDefinition): z.ZodTypeAny {
  let zodType: z.ZodTypeAny;

  // Base type
  switch (col.type) {
    case 'string':
      zodType = z.string();

      // Add string validations
      if (col.min !== undefined) {
        zodType = (zodType as z.ZodString).min(col.min);
      }
      if (col.max !== undefined) {
        zodType = (zodType as z.ZodString).max(col.max);
      }
      if (col.pattern) {
        zodType = (zodType as z.ZodString).regex(
          new RegExp(col.pattern),
          `${col.name} must match pattern: ${col.pattern}`
        );
      }
      if (col.enum) {
        zodType = z.enum(col.enum as [string, ...string[]]);
      }
      break;

    case 'integer':
      zodType = z.number().int();
      if (col.min !== undefined) {
        zodType = (zodType as z.ZodNumber).min(col.min);
      }
      if (col.max !== undefined) {
        zodType = (zodType as z.ZodNumber).max(col.max);
      }
      break;

    case 'number':
      zodType = z.number();
      if (col.min !== undefined) {
        zodType = (zodType as z.ZodNumber).min(col.min);
      }
      if (col.max !== undefined) {
        zodType = (zodType as z.ZodNumber).max(col.max);
      }
      break;

    case 'boolean':
      zodType = z.boolean();
      break;

    case 'date':
      zodType = z.coerce.date();
      break;

    case 'datetime':
      zodType = z.coerce.date();
      break;

    case 'array':
      const itemType = col.itemType || 'string';
      const itemSchema = generateColumnSchema({
        ...col,
        type: itemType as any,
        nullable: false
      });
      zodType = z.array(itemSchema);
      if (col.min !== undefined) {
        zodType = (zodType as z.ZodArray<any>).min(col.min);
      }
      if (col.max !== undefined) {
        zodType = (zodType as z.ZodArray<any>).max(col.max);
      }
      break;

    case 'object':
      zodType = z.record(z.unknown());
      break;

    default:
      zodType = z.unknown();
  }

  // Add nullability
  if (col.nullable) {
    zodType = zodType.nullable();
  }

  // Add description
  if (col.description) {
    zodType = zodType.describe(col.description);
  }

  return zodType;
}

/**
 * Convert Pandera schema JSON to Zod schema
 */
export function panderaToZod(panderaSchema: any): z.ZodObject<any> {
  const columns: ColumnDefinition[] = [];

  for (const [colName, colDef] of Object.entries<any>(panderaSchema.columns || {})) {
    columns.push({
      name: colName,
      type: mapPanderaTypeToZod(colDef.dtype),
      nullable: colDef.nullable ?? true,
      unique: colDef.unique ?? false,
      description: colDef.description,
    });
  }

  const schemaDef: SchemaDefinition = {
    name: panderaSchema.name || 'unknown',
    version: panderaSchema.version || '1.0.0',
    description: panderaSchema.description,
    columns
  };

  return generateZodSchema(schemaDef);
}

/**
 * Map Pandera dtype to Zod type
 */
function mapPanderaTypeToZod(panderaType: string): ColumnDefinition['type'] {
  const typeStr = panderaType.toLowerCase();

  if (typeStr.includes('int')) return 'integer';
  if (typeStr.includes('float') || typeStr.includes('double')) return 'number';
  if (typeStr.includes('bool')) return 'boolean';
  if (typeStr.includes('datetime')) return 'datetime';
  if (typeStr.includes('date')) return 'date';
  if (typeStr.includes('string') || typeStr.includes('str')) return 'string';
  if (typeStr.includes('object')) return 'object';

  return 'string'; // Default
}

/**
 * Validate data against Zod schema with detailed error reporting
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
      expected: getExpectedType(err),
      received: getReceivedValue(err)
    }))
  };
}

interface ValidationError {
  path: string;
  message: string;
  code: string;
  expected?: string;
  received?: any;
}

function getExpectedType(err: z.ZodIssue): string | undefined {
  if ('expected' in err) {
    return String(err.expected);
  }
  return undefined;
}

function getReceivedValue(err: z.ZodIssue): any {
  if ('received' in err) {
    return err.received;
  }
  return undefined;
}

/**
 * Generate TypeScript interface from schema definition
 */
export function generateTypeScriptInterface(schemaDef: SchemaDefinition): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * ${schemaDef.name}`);
  if (schemaDef.description) {
    lines.push(` * ${schemaDef.description}`);
  }
  lines.push(` * @version ${schemaDef.version}`);
  lines.push(` */`);
  lines.push(`export interface ${toPascalCase(schemaDef.name)} {`);

  for (const col of schemaDef.columns) {
    if (col.description) {
      lines.push(`  /** ${col.description} */`);
    }
    const optional = col.nullable ? '?' : '';
    const tsType = mapZodTypeToTypeScript(col.type, col.nullable);
    lines.push(`  ${col.name}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

function mapZodTypeToTypeScript(
  zodType: ColumnDefinition['type'],
  nullable: boolean
): string {
  let tsType: string;

  switch (zodType) {
    case 'string':
      tsType = 'string';
      break;
    case 'number':
    case 'integer':
      tsType = 'number';
      break;
    case 'boolean':
      tsType = 'boolean';
      break;
    case 'date':
    case 'datetime':
      tsType = 'Date';
      break;
    case 'array':
      tsType = 'unknown[]';
      break;
    case 'object':
      tsType = 'Record<string, unknown>';
      break;
    default:
      tsType = 'unknown';
  }

  return nullable ? `${tsType} | null` : tsType;
}

function toPascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Create a validator function from schema definition
 */
export function createValidator<T = any>(
  schemaDef: SchemaDefinition,
  options: ValidationOptions = {}
) {
  const schema = generateZodSchema(schemaDef, options);

  return (data: unknown): T => {
    const result = validateWithSchema(schema, data);

    if (!result.success && 'errors' in result) {
      const errorMsg = result.errors
        .map(err => `${err.path}: ${err.message}`)
        .join('\n');
      throw new Error(`Validation failed:\n${errorMsg}`);
    }

    return result.data as T;
  };
}

// Example usage and exports
export const CommonPatterns = {
  email: /^[\w\.-]+@[\w\.-]+\.\w+$/,
  phone: /^\d{3}-\d{3}-\d{4}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  url: /^https?:\/\/.+/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  iso8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
};

/**
 * Pre-built schema validators for common patterns
 */
export const CommonSchemas = {
  email: z.string().email(),
  url: z.string().url(),
  uuid: z.string().uuid(),
  positiveInt: z.number().int().positive(),
  nonNegative: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
  isoDate: z.string().datetime(),
};

// Example usage
if (require.main === module) {
  // Define a schema
  const patientSchema: SchemaDefinition = {
    name: 'patient_data',
    version: '1.0.0',
    description: 'Patient clinical data schema',
    columns: [
      {
        name: 'patient_id',
        type: 'string',
        nullable: false,
        unique: true,
        pattern: '^P\\d{3,}$',
        description: 'Unique patient identifier'
      },
      {
        name: 'age',
        type: 'integer',
        nullable: false,
        min: 0,
        max: 120,
        description: 'Patient age in years'
      },
      {
        name: 'diagnosis',
        type: 'string',
        nullable: true,
        description: 'Primary diagnosis'
      },
      {
        name: 'visit_date',
        type: 'date',
        nullable: false,
        description: 'Date of visit'
      }
    ]
  };

  // Generate Zod schema
  const zodSchema = generateZodSchema(patientSchema);

  // Generate TypeScript interface
  const tsInterface = generateTypeScriptInterface(patientSchema);
  console.log('Generated TypeScript interface:');
  console.log(tsInterface);
  console.log('\n');

  // Validate sample data
  const sampleData = {
    patient_id: 'P001',
    age: 45,
    diagnosis: 'cancer',
    visit_date: new Date('2024-01-01')
  };

  const result = validateWithSchema(zodSchema, sampleData);

  if (result.success) {
    console.log('✓ Validation passed');
    console.log('Validated data:', result.data);
  } else if ('errors' in result) {
    console.log('✗ Validation failed');
    console.log('Errors:', result.errors);
  }

  // Test invalid data
  const invalidData = {
    patient_id: 'INVALID',
    age: 150,
    diagnosis: 'cancer'
    // missing visit_date
  };

  const invalidResult = validateWithSchema(zodSchema, invalidData);
  if (!invalidResult.success && 'errors' in invalidResult) {
    console.log('\nExpected validation errors:');
    invalidResult.errors.forEach(err => {
      console.log(`- ${err.path}: ${err.message}`);
    });
  }
}
