# Schema & Manifest System

Complete implementation of PR4 from Phase A: Core Hardening Implementation Plan.

## Overview

The Schema & Manifest System provides versioned schemas, lineage tracking, and FAIR metadata for ResearchFlow's data artifacts. This system ensures data quality, reproducibility, and compliance with research data standards.

## Features Implemented

### ✅ Task 3: Pandera Schema Inference
**Location**: `packages/core/src/schema/pandera-inference.py`

Automatically infers Pandera schemas from DataFrame samples with intelligent type detection and constraint inference.

```python
from pandera_inference import infer_schema_from_dataframe

df = pd.DataFrame({
    'patient_id': ['P001', 'P002'],
    'age': [45, 67]
})

schema = infer_schema_from_dataframe(df, 'patient_data')
```

**Features**:
- Automatic type detection
- Nullable column detection
- Unique constraint inference
- Range/pattern validation rules
- Export to JSON for versioning

---

### ✅ Task 4: Zod Runtime Schemas
**Location**: `packages/core/src/schema/zod-generator.ts`

Generates Zod schemas for TypeScript runtime validation.

```typescript
import { generateZodSchema, validateWithSchema } from '@researchflow/core/schema/zod-generator';

const schemaDef = {
  name: 'patient_data',
  version: '1.0.0',
  columns: [
    { name: 'patient_id', type: 'string', nullable: false, pattern: '^P\\d+$' },
    { name: 'age', type: 'integer', nullable: false, min: 0, max: 120 }
  ]
};

const zodSchema = generateZodSchema(schemaDef);
const result = validateWithSchema(zodSchema, data);

if (!result.success) {
  console.error('Validation errors:', result.errors);
}
```

**Features**:
- Type-safe runtime validation
- Custom validation rules
- Pattern matching (email, phone, etc.)
- TypeScript interface generation
- Pandera schema conversion

---

### ✅ Task 13: Schema Versioning
**Location**: `packages/core/src/schema/versioning.ts`

Implements semantic versioning for schemas with migration support.

```typescript
import { SchemaRegistry, SchemaVersion } from '@researchflow/core/schema/versioning';

const registry = new SchemaRegistry();

const v1: SchemaVersion = {
  version: '1.0.0',
  schema: { columns: {...} },
  createdAt: new Date().toISOString(),
  createdBy: 'admin',
  changelog: 'Initial schema'
};

registry.registerSchema('patient_data', v1);

// Check compatibility
const compat = registry.checkCompatibility('patient_data', '1.0.0', '2.0.0');
console.log(`Breaking changes: ${compat.breaking}`);
```

**Features**:
- Semantic versioning (MAJOR.MINOR.PATCH)
- Automatic compatibility detection
- Migration path calculation
- Version history tracking
- Breaking change detection

---

### ✅ Task 20: Lineage Tracking
**Location**: `packages/core/src/lineage/tracker.ts`

Tracks complete data provenance through transformations.

```typescript
import { LineageTracker, createLineageNode } from '@researchflow/core/lineage/tracker';

const tracker = new LineageTracker();

// Add nodes
tracker.addNode(createLineageNode('raw-001', 'input', { file: 'data.csv' }));
tracker.addNode(createLineageNode('clean-001', 'transformation', { op: 'clean' }));
tracker.addNode(createLineageNode('output-001', 'output', { format: 'parquet' }));

// Link nodes
tracker.addEdge({ from: 'raw-001', to: 'clean-001', relationship: 'transformed_by' });
tracker.addEdge({ from: 'clean-001', to: 'output-001', relationship: 'derived_from' });

// Query lineage
const upstream = tracker.getUpstream('output-001');
const graph = tracker.exportGraph();
const mermaid = tracker.exportMermaid();
```

**Features**:
- Input/output tracking
- Transformation logging
- Dependency graphs
- Backward/forward lineage
- Export to PROV-JSON, Mermaid

---

### ✅ Task 25: FAIR Metadata
**Location**: `packages/core/src/metadata/fair-metadata.ts`

Generates FAIR (Findable, Accessible, Interoperable, Reusable) metadata.

```typescript
import { generateFAIRMetadata, validateFAIRMetadata } from '@researchflow/core/metadata/fair-metadata';

const artifact = {
  id: 'thyroid-001',
  title: 'Thyroid Cancer Data',
  description: 'Clinical data from thyroid cancer patients',
  createdBy: 'Dr. Smith',
  createdAt: '2024-01-01T00:00:00Z'
};

const metadata = generateFAIRMetadata(artifact, {
  creator: { name: 'Dr. Smith', orcid: '0000-0001-2345-6789' },
  license: 'CC-BY-4.0',
  keywords: ['thyroid', 'cancer', 'clinical']
});

// Validate completeness
const validation = validateFAIRMetadata(metadata);
console.log(`FAIR score: ${validation.score}/20`);
```

**Features**:
- Dublin Core compliant
- DataCite metadata schema
- Schema.org JSON-LD export
- Completeness validation
- Citation generation

---

### ✅ Task 29: Schema Linting
**Location**: `packages/core/src/schema/linter.ts`

Validates schemas against best practices.

```typescript
import { SchemaLinter } from '@researchflow/core/schema/linter';

const linter = new SchemaLinter();
const result = linter.lint(schema);

if (!result.valid) {
  console.log(linter.formatReport(result));
}
```

**Checks**:
- ✅ Naming conventions (snake_case)
- ✅ Required documentation
- ✅ Semantic versioning
- ✅ Reserved keyword conflicts
- ✅ Type safety (explicit nullability)
- ✅ Structural integrity

---

### ✅ Task 39: Tamper-Evident Logging
**Location**: `packages/core/src/logging/tamper-evident.ts`

Creates cryptographically signed logs with hash chaining.

```typescript
import { TamperEvidentLogger } from '@researchflow/core/logging/tamper-evident';

const logger = new TamperEvidentLogger('secret-key-32-chars-minimum!');

// Log events
const entry1 = logger.log({ event: 'user_login', user: 'alice' });
const entry2 = logger.log({ event: 'data_access', resource: 'patient_123' });

// Verify integrity
const result = logger.verifyChain([entry1, entry2]);
console.log(`Chain valid: ${result.valid}`);

if (!result.valid) {
  console.log('Tampering detected:', result.errors);
}
```

**Features**:
- HMAC-SHA256 signatures
- Hash chaining (blockchain-like)
- Timestamp verification
- Tampering detection
- Merkle tree support

---

### ✅ Task 43: Schema Diagram Generation
**Location**: `packages/core/src/schema/diagram-generator.ts`

Generates visual diagrams from schemas.

```typescript
import {
  generateMermaidDiagram,
  generateASCIITable,
  generateMarkdownTable
} from '@researchflow/core/schema/diagram-generator';

const schema = {
  name: 'patient_data',
  version: '1.0.0',
  columns: {
    id: { dtype: 'string', nullable: false, primary_key: true },
    name: { dtype: 'string', nullable: false },
    age: { dtype: 'int64', nullable: false }
  }
};

// Mermaid ER diagram
const mermaid = generateMermaidDiagram(schema);

// ASCII table
const ascii = generateASCIITable(schema);

// Markdown table
const markdown = generateMarkdownTable(schema);
```

**Formats**:
- Mermaid ER diagrams
- PlantUML class diagrams
- GraphViz DOT
- ASCII art tables
- Markdown tables
- HTML tables

---

## Usage Examples

### Complete Workflow

```typescript
// 1. Infer schema from data
const df = await loadDataFrame('data.csv');
const schema = inferSchemaFromDataframe(df, 'patient_data');

// 2. Lint schema
const linter = new SchemaLinter();
const lintResult = linter.lint(schema);

if (!lintResult.valid) {
  throw new Error('Schema validation failed');
}

// 3. Version and register
const registry = new SchemaRegistry();
registry.registerSchema('patient_data', {
  version: '1.0.0',
  schema,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  changelog: 'Initial schema from data inference'
});

// 4. Generate runtime validator
const zodSchema = generateZodSchema(schema);

// 5. Track lineage
const tracker = new LineageTracker();
tracker.addNode(createLineageNode('ingest-001', 'input', { source: 'data.csv' }));
tracker.addNode(createLineageNode('validate-001', 'validation', { schema: '1.0.0' }));

// 6. Generate FAIR metadata
const metadata = generateFAIRMetadata({
  id: 'patient-data-001',
  title: 'Patient Clinical Data',
  createdBy: 'Dr. Smith',
  createdAt: new Date().toISOString()
});

// 7. Log with tamper-evident system
const auditLogger = new TamperEvidentLogger(process.env.AUDIT_SECRET);
auditLogger.log({
  action: 'schema_registered',
  schema: 'patient_data',
  version: '1.0.0'
});

// 8. Generate documentation
const diagram = generateMermaidDiagram(schema);
const table = generateMarkdownTable(schema);
```

---

## Integration with Pipeline

### Worker Pipeline Integration

```python
# services/worker/src/pipelines/main_pipeline.py

from ingestion.schema_inference import infer_schema_stage
from ingestion.schema_migrations import schema_migration_stage
from provenance.lineage_logger import lineage_tracking_stage

async def process_data(job_spec):
    # Infer schema
    job_spec = await infer_schema_stage(job_spec)

    # Migrate if needed
    job_spec = await schema_migration_stage(job_spec)

    # Track lineage
    job_spec = await lineage_tracking_stage(job_spec, 'validation', 'pandera_validate')

    return job_spec
```

### Orchestrator API Integration

```typescript
// services/orchestrator/src/routes/artifacts.ts

import { validateSchema } from './validation/schema-validator';

router.post('/artifacts/:dataset',
  validateSchema('patient_data'), // Validates against registered schema
  async (req, res) => {
    const validatedData = req.validatedData;
    // ... process artifact
  }
);
```

---

## Testing

Run tests:
```bash
cd packages/core
npm test src/schema/__tests__/schema-system.test.ts
```

All 8 tasks have comprehensive test coverage:
- ✅ Schema inference
- ✅ Zod validation
- ✅ Version management
- ✅ Lineage tracking
- ✅ FAIR metadata
- ✅ Schema linting
- ✅ Tamper-evident logs
- ✅ Diagram generation

---

## Documentation

- [Versioning Guide](./versioning.md)
- [Lineage Tracking Guide](./lineage.md)
- [FAIR Metadata Guide](./fair-metadata.md)

---

## Dependencies Added

### TypeScript (packages/core/package.json)
```json
{
  "dependencies": {
    "semver": "^7.6.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/semver": "^7.5.0"
  }
}
```

### Python (services/worker/requirements.txt)
```
pandera==0.18.0
```

---

## Files Created

### TypeScript
- `packages/core/src/schema/zod-generator.ts`
- `packages/core/src/schema/versioning.ts`
- `packages/core/src/schema/linter.ts`
- `packages/core/src/schema/diagram-generator.ts`
- `packages/core/src/lineage/tracker.ts`
- `packages/core/src/metadata/fair-metadata.ts`
- `packages/core/src/logging/tamper-evident.ts`

### Python
- `packages/core/src/schema/pandera-inference.py`
- `services/worker/src/ingestion/schema_inference.py`
- `services/worker/src/ingestion/schema_migrations.py`
- `services/worker/src/provenance/lineage_logger.py`

### Integration
- `services/orchestrator/src/validation/schema-validator.ts`

### Tests
- `packages/core/src/schema/__tests__/schema-system.test.ts`

### Documentation
- `docs/schema/README.md` (this file)

---

## Next Steps

After PR4 implementation:

1. **PR5: Orchestrator APIs** (7 tasks)
   - GraphQL with Apollo Server
   - Redis caching
   - Streaming uploads
   - S3 integration

2. **PR6: Literature Workflow** (12 tasks)
   - Citation formatting
   - AI literature review
   - Zotero sync

3. **PR7: Operational Excellence** (3 tasks)
   - Redis vector caching
   - HPA for workers
   - Artifact compression

4. **PR8: E2E Integration** (1 task)
   - Full system integration test

---

## Status

**PR4: Schema & Manifest System** - ✅ **COMPLETE**

- ✅ Task 3: Pandera Schema Inference
- ✅ Task 4: Zod Runtime Schemas
- ✅ Task 13: Schema Versioning
- ✅ Task 20: Lineage Tracking
- ✅ Task 25: FAIR Metadata
- ✅ Task 29: Schema Linting
- ✅ Task 39: Tamper-Evident Logging
- ✅ Task 43: Schema Diagram Generation

**19/50 tasks complete → 27/50 tasks complete (54%)**
