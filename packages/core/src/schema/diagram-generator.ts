/**
 * Schema Diagram Generator
 *
 * Generates visual diagrams from schema definitions in various formats:
 * - Mermaid ER diagrams
 * - PlantUML class diagrams
 * - GraphViz DOT format
 * - ASCII art tables
 *
 * Useful for documentation and schema visualization.
 */

export interface SchemaDefinition {
  name: string;
  version?: string;
  description?: string;
  columns: Record<string, ColumnDefinition>;
}

export interface ColumnDefinition {
  dtype: string;
  nullable: boolean;
  unique?: boolean;
  description?: string;
  primary_key?: boolean;
  foreign_key?: { table: string; column: string };
}

/**
 * Generate Mermaid ER diagram
 */
export function generateMermaidDiagram(schema: SchemaDefinition): string {
  const lines: string[] = ['erDiagram'];

  const tableName = schema.name.toUpperCase();
  lines.push(`  ${tableName} {`);

  for (const [colName, colDef] of Object.entries(schema.columns)) {
    const typeStr = mapTypeToMermaid(colDef.dtype);
    const constraints: string[] = [];

    if (colDef.primary_key) constraints.push('PK');
    if (colDef.foreign_key) constraints.push('FK');
    if (colDef.unique && !colDef.primary_key) constraints.push('UK');
    if (!colDef.nullable) constraints.push('NOT NULL');

    const constraintStr = constraints.length > 0 ? ` "${constraints.join(',')}"` : '';

    lines.push(`    ${typeStr} ${colName}${constraintStr}`);
  }

  lines.push('  }');

  return lines.join('\n');
}

/**
 * Generate Mermaid diagram with relationships between multiple schemas
 */
export function generateMermaidWithRelationships(schemas: SchemaDefinition[]): string {
  const lines: string[] = ['erDiagram'];

  // Add each table
  for (const schema of schemas) {
    const tableName = schema.name.toUpperCase();
    lines.push(`  ${tableName} {`);

    for (const [colName, colDef] of Object.entries(schema.columns)) {
      const typeStr = mapTypeToMermaid(colDef.dtype);
      const constraints: string[] = [];

      if (colDef.primary_key) constraints.push('PK');
      if (colDef.foreign_key) constraints.push('FK');
      if (colDef.unique && !colDef.primary_key) constraints.push('UK');

      const constraintStr = constraints.length > 0 ? ` "${constraints.join(',')}"` : '';
      lines.push(`    ${typeStr} ${colName}${constraintStr}`);
    }

    lines.push('  }');
  }

  // Add relationships
  for (const schema of schemas) {
    for (const [colName, colDef] of Object.entries(schema.columns)) {
      if (colDef.foreign_key) {
        const fromTable = schema.name.toUpperCase();
        const toTable = colDef.foreign_key.table.toUpperCase();
        lines.push(`  ${fromTable} ||--o{ ${toTable} : references`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate PlantUML class diagram
 */
export function generatePlantUML(schema: SchemaDefinition): string {
  const lines: string[] = ['@startuml'];

  lines.push(`class ${schema.name} {`);

  for (const [colName, colDef] of Object.entries(schema.columns)) {
    const typeStr = mapTypeToPlantuml(colDef.dtype);
    const modifier = colDef.primary_key ? '{field} ' : '';

    lines.push(`  ${modifier}${typeStr} ${colName}`);
  }

  lines.push('}');
  lines.push('@enduml');

  return lines.join('\n');
}

/**
 * Generate GraphViz DOT format
 */
export function generateGraphVizDot(schema: SchemaDefinition): string {
  const lines: string[] = [
    'digraph schema {',
    '  rankdir=TB;',
    '  node [shape=record];',
    ''
  ];

  const tableName = schema.name;

  // Build table record
  let tableLabel = `{${tableName}|`;

  const fields: string[] = [];
  for (const [colName, colDef] of Object.entries(schema.columns)) {
    const typeStr = mapTypeToGraphViz(colDef.dtype);
    const constraints: string[] = [];

    if (colDef.primary_key) constraints.push('PK');
    if (!colDef.nullable) constraints.push('NOT NULL');

    const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
    fields.push(`${colName}: ${typeStr}${constraintStr}`);
  }

  tableLabel += fields.join('\\l') + '\\l}';

  lines.push(`  ${tableName} [label="${tableLabel}"];`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate ASCII art table
 */
export function generateASCIITable(schema: SchemaDefinition): string {
  const lines: string[] = [];

  // Title
  lines.push(`┌─ ${schema.name} ${schema.version ? `(v${schema.version})` : ''}`);
  if (schema.description) {
    lines.push(`│  ${schema.description}`);
  }
  lines.push('│');

  // Calculate column widths
  const colNameWidth = Math.max(
    10,
    ...Object.keys(schema.columns).map(c => c.length)
  );
  const typeWidth = 15;
  const constraintsWidth = 20;

  // Header
  lines.push(`├${'─'.repeat(colNameWidth + 2)}┬${'─'.repeat(typeWidth + 2)}┬${'─'.repeat(constraintsWidth + 2)}┐`);
  lines.push(`│ ${'Column'.padEnd(colNameWidth)} │ ${'Type'.padEnd(typeWidth)} │ ${'Constraints'.padEnd(constraintsWidth)} │`);
  lines.push(`├${'─'.repeat(colNameWidth + 2)}┼${'─'.repeat(typeWidth + 2)}┼${'─'.repeat(constraintsWidth + 2)}┤`);

  // Rows
  for (const [colName, colDef] of Object.entries(schema.columns)) {
    const constraints: string[] = [];

    if (colDef.primary_key) constraints.push('PK');
    if (colDef.unique && !colDef.primary_key) constraints.push('UNIQUE');
    if (!colDef.nullable) constraints.push('NOT NULL');
    if (colDef.foreign_key) constraints.push(`FK → ${colDef.foreign_key.table}`);

    const constraintStr = constraints.join(', ');

    lines.push(
      `│ ${colName.padEnd(colNameWidth)} │ ${colDef.dtype.padEnd(typeWidth)} │ ${constraintStr.padEnd(constraintsWidth)} │`
    );
  }

  lines.push(`└${'─'.repeat(colNameWidth + 2)}┴${'─'.repeat(typeWidth + 2)}┴${'─'.repeat(constraintsWidth + 2)}┘`);

  return lines.join('\n');
}

/**
 * Generate Markdown table
 */
export function generateMarkdownTable(schema: SchemaDefinition): string {
  const lines: string[] = [];

  lines.push(`# ${schema.name}${schema.version ? ` (v${schema.version})` : ''}`);
  lines.push('');

  if (schema.description) {
    lines.push(schema.description);
    lines.push('');
  }

  lines.push('| Column | Type | Constraints | Description |');
  lines.push('|--------|------|-------------|-------------|');

  for (const [colName, colDef] of Object.entries(schema.columns)) {
    const constraints: string[] = [];

    if (colDef.primary_key) constraints.push('PK');
    if (colDef.unique && !colDef.primary_key) constraints.push('UNIQUE');
    if (!colDef.nullable) constraints.push('NOT NULL');

    const constraintStr = constraints.length > 0 ? constraints.join(', ') : '-';
    const descStr = colDef.description || '-';

    lines.push(`| ${colName} | ${colDef.dtype} | ${constraintStr} | ${descStr} |`);
  }

  return lines.join('\n');
}

/**
 * Generate HTML table
 */
export function generateHTMLTable(schema: SchemaDefinition): string {
  const lines: string[] = [];

  lines.push('<div class="schema-table">');
  lines.push(`  <h2>${schema.name}${schema.version ? ` <span class="version">v${schema.version}</span>` : ''}</h2>`);

  if (schema.description) {
    lines.push(`  <p class="description">${schema.description}</p>`);
  }

  lines.push('  <table>');
  lines.push('    <thead>');
  lines.push('      <tr>');
  lines.push('        <th>Column</th>');
  lines.push('        <th>Type</th>');
  lines.push('        <th>Constraints</th>');
  lines.push('        <th>Description</th>');
  lines.push('      </tr>');
  lines.push('    </thead>');
  lines.push('    <tbody>');

  for (const [colName, colDef] of Object.entries(schema.columns)) {
    const constraints: string[] = [];

    if (colDef.primary_key) constraints.push('<span class="pk">PK</span>');
    if (colDef.unique && !colDef.primary_key) constraints.push('<span class="unique">UNIQUE</span>');
    if (!colDef.nullable) constraints.push('<span class="not-null">NOT NULL</span>');

    const constraintStr = constraints.length > 0 ? constraints.join(' ') : '-';
    const descStr = colDef.description || '-';

    lines.push('      <tr>');
    lines.push(`        <td><code>${colName}</code></td>`);
    lines.push(`        <td><code>${colDef.dtype}</code></td>`);
    lines.push(`        <td>${constraintStr}</td>`);
    lines.push(`        <td>${descStr}</td>`);
    lines.push('      </tr>');
  }

  lines.push('    </tbody>');
  lines.push('  </table>');
  lines.push('</div>');

  return lines.join('\n');
}

// Type mapping functions

function mapTypeToMermaid(dtype: string): string {
  const lower = dtype.toLowerCase();
  if (lower.includes('int')) return 'int';
  if (lower.includes('float') || lower.includes('double')) return 'float';
  if (lower.includes('string') || lower.includes('varchar') || lower.includes('text')) return 'string';
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('date')) return 'date';
  if (lower.includes('timestamp')) return 'timestamp';
  return 'string';
}

function mapTypeToPlantuml(dtype: string): string {
  const lower = dtype.toLowerCase();
  if (lower.includes('int')) return 'int';
  if (lower.includes('float') || lower.includes('double')) return 'float';
  if (lower.includes('string') || lower.includes('varchar') || lower.includes('text')) return 'String';
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('date')) return 'Date';
  return 'Object';
}

function mapTypeToGraphViz(dtype: string): string {
  return dtype; // Use as-is for GraphViz
}

// Example usage
if (require.main === module) {
  const exampleSchema: SchemaDefinition = {
    name: 'patient_data',
    version: '2.0.0',
    description: 'Patient clinical data with medical history',
    columns: {
      id: {
        dtype: 'string',
        nullable: false,
        unique: true,
        primary_key: true,
        description: 'Unique patient identifier'
      },
      name: {
        dtype: 'string',
        nullable: false,
        description: 'Patient full name'
      },
      age: {
        dtype: 'int64',
        nullable: false,
        description: 'Patient age in years'
      },
      diagnosis: {
        dtype: 'string',
        nullable: true,
        description: 'Primary diagnosis'
      },
      admission_date: {
        dtype: 'datetime',
        nullable: false,
        description: 'Date of hospital admission'
      }
    }
  };

  console.log('=== Mermaid ER Diagram ===');
  console.log(generateMermaidDiagram(exampleSchema));
  console.log('\n');

  console.log('=== PlantUML Diagram ===');
  console.log(generatePlantUML(exampleSchema));
  console.log('\n');

  console.log('=== ASCII Table ===');
  console.log(generateASCIITable(exampleSchema));
  console.log('\n');

  console.log('=== Markdown Table ===');
  console.log(generateMarkdownTable(exampleSchema));
  console.log('\n');

  console.log('=== GraphViz DOT ===');
  console.log(generateGraphVizDot(exampleSchema));
}
