# Phase 0: Manuscript Engine Package Setup

> **Target Repository**: `researchflow-production`
> **New Package**: `packages/manuscript-engine/`

## Context

You are extending the `researchflow-production` monorepo with a new `manuscript-engine` package. This package enables researchers to transform clinical data and literature into publication-ready IMRaD manuscripts.

### Current Repository Structure

```
researchflow-production/
├── .github/workflows/          # CI/CD pipelines
├── services/
│   ├── orchestrator/           # Node.js Express API
│   │   └── src/
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── services/
│   ├── worker/                 # Python FastAPI compute
│   │   └── src/
│   │       ├── jobs/
│   │       ├── validators/
│   │       └── workflow/
│   └── web/                    # React Vite frontend
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── pages/
├── packages/
│   ├── core/                   # @researchflow/core
│   ├── ai-router/              # @researchflow/ai-router
│   └── phi-engine/             # @researchflow/phi-engine
├── shared/
│   ├── schemas/                # JSON schemas
│   └── contracts/              # OpenAPI specs
├── infrastructure/
│   ├── docker/
│   └── kubernetes/
├── migrations/                 # SQL migrations
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Governance Requirements (MANDATORY)

All code must enforce:
1. **PHI Protection**: Integrate `@researchflow/phi-engine` before data exposure
2. **Audit Logging**: Hash-chained audit entries for all state changes
3. **RBAC Enforcement**: Role checks on all API endpoints
4. **Human Attestation**: Gates at critical workflow transitions
5. **Fail-Closed**: Deny on error, never allow

---

## Task 0.1: Create Package Directory Structure

**Script**: `scripts/setup-manuscript-engine.sh`

```bash
#!/bin/bash
set -e

echo "Creating manuscript-engine package structure..."

# Core package directories
mkdir -p packages/manuscript-engine/src/{services,types,utils,templates,prompts}
mkdir -p packages/manuscript-engine/src/templates/journal-templates
mkdir -p packages/manuscript-engine/src/prompts/section-prompts

# Test directories (matches existing test structure)
mkdir -p tests/unit/manuscript-engine
mkdir -p tests/integration/manuscript-engine
mkdir -p tests/e2e/manuscript-engine

# Service integration directories
mkdir -p services/orchestrator/src/routes/manuscript
mkdir -p services/orchestrator/src/services/manuscript
mkdir -p services/worker/src/jobs/manuscript
mkdir -p services/web/src/components/manuscript
mkdir -p services/web/src/pages/manuscript

# Shared resources
mkdir -p shared/schemas/manuscript
mkdir -p shared/contracts

echo "✓ Directory structure created"
```

**Run**: `chmod +x scripts/setup-manuscript-engine.sh && ./scripts/setup-manuscript-engine.sh`

---

## Task 0.2: Package Configuration

**File**: `packages/manuscript-engine/package.json`

```json
{
  "name": "@researchflow/manuscript-engine",
  "version": "0.1.0",
  "description": "Manuscript writing engine with IMRaD support for ResearchFlow",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@researchflow/core": "workspace:*",
    "@researchflow/phi-engine": "workspace:*",
    "@researchflow/ai-router": "workspace:*",
    "zod": "^3.22.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Task 0.3: TypeScript Configuration

**File**: `packages/manuscript-engine/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": [
    { "path": "../core" },
    { "path": "../phi-engine" },
    { "path": "../ai-router" }
  ]
}
```

---

## Task 0.4: Core Type Definitions

**File**: `packages/manuscript-engine/src/types/manuscript.types.ts`

```typescript
import { z } from 'zod';

export const ManuscriptStatusSchema = z.enum([
  'draft',
  'in_review',
  'revision_requested',
  'approved',
  'submitted',
  'published',
  'archived'
]);
export type ManuscriptStatus = z.infer<typeof ManuscriptStatusSchema>;

export const TemplateTypeSchema = z.enum([
  'imrad',
  'case_report',
  'systematic_review',
  'meta_analysis',
  'letter',
  'editorial',
  'review_article'
]);
export type TemplateType = z.infer<typeof TemplateTypeSchema>;

export const CitationStyleSchema = z.enum([
  'AMA', 'APA', 'Vancouver', 'NLM', 'Chicago', 'IEEE', 'Harvard'
]);
export type CitationStyle = z.infer<typeof CitationStyleSchema>;

export const ManuscriptSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().max(500),
  status: ManuscriptStatusSchema,
  templateType: TemplateTypeSchema,
  citationStyle: CitationStyleSchema.default('AMA'),
  targetJournal: z.string().optional(),
  currentVersionId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.unknown()).optional()
});
export type Manuscript = z.infer<typeof ManuscriptSchema>;

export const ManuscriptVersionSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  content: z.record(z.unknown()),
  dataSnapshotHash: z.string().length(64),
  wordCount: z.number().int().nonnegative(),
  createdAt: z.date(),
  createdBy: z.string().uuid(),
  changeDescription: z.string().optional(),
  previousHash: z.string().length(64).optional(),
  currentHash: z.string().length(64)
});
export type ManuscriptVersion = z.infer<typeof ManuscriptVersionSchema>;

export const AuthorSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  orcid: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).optional(),
  affiliations: z.array(z.string()),
  isCorresponding: z.boolean().default(false),
  orderIndex: z.number().int().nonnegative()
});
export type Author = z.infer<typeof AuthorSchema>;
```

---

## Task 0.5: IMRaD Section Types

**File**: `packages/manuscript-engine/src/types/imrad.types.ts`

```typescript
import { z } from 'zod';

export const IMRaDSectionSchema = z.enum([
  'title', 'abstract', 'keywords', 'introduction', 'methods',
  'results', 'discussion', 'conclusion', 'acknowledgments',
  'references', 'appendices', 'figures', 'tables', 'supplementary'
]);
export type IMRaDSection = z.infer<typeof IMRaDSectionSchema>;

export const SectionContentSchema = z.object({
  section: IMRaDSectionSchema,
  content: z.string(),
  wordCount: z.number().int().nonnegative(),
  citations: z.array(z.string().uuid()),
  figures: z.array(z.string().uuid()),
  tables: z.array(z.string().uuid()),
  dataSources: z.array(z.string().uuid()),
  lastModified: z.date(),
  modifiedBy: z.string().uuid()
});
export type SectionContent = z.infer<typeof SectionContentSchema>;

export const StructuredAbstractSchema = z.object({
  background: z.string().optional(),
  objectives: z.string().optional(),
  methods: z.string(),
  results: z.string(),
  conclusions: z.string(),
  trialRegistration: z.string().optional()
});
export type StructuredAbstract = z.infer<typeof StructuredAbstractSchema>;

export const WordCountLimitsSchema = z.object({
  abstract: z.object({ min: z.number(), max: z.number() }),
  introduction: z.object({ max: z.number() }).optional(),
  methods: z.object({ max: z.number() }).optional(),
  results: z.object({ max: z.number() }).optional(),
  discussion: z.object({ max: z.number() }).optional(),
  total: z.object({ min: z.number().optional(), max: z.number() })
});
export type WordCountLimits = z.infer<typeof WordCountLimitsSchema>;
```

---

## Task 0.6: Citation Types

**File**: `packages/manuscript-engine/src/types/citation.types.ts`

```typescript
import { z } from 'zod';

export const CitationSourceTypeSchema = z.enum([
  'pubmed', 'doi', 'pmcid', 'arxiv', 'isbn', 'url', 'manual'
]);
export type CitationSourceType = z.infer<typeof CitationSourceTypeSchema>;

export const CitationSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  sourceType: CitationSourceTypeSchema,
  externalId: z.string(),
  title: z.string(),
  authors: z.array(z.object({
    lastName: z.string(),
    firstName: z.string().optional(),
    initials: z.string().optional()
  })),
  journal: z.string().optional(),
  year: z.number().int(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  url: z.string().url().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  meshTerms: z.array(z.string()).optional(),
  sections: z.array(z.string()),
  orderInDocument: z.number().int().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Citation = z.infer<typeof CitationSchema>;

export const LitSearchResultSchema = z.object({
  query: z.string(),
  source: z.enum(['pubmed', 'semantic_scholar', 'arxiv']),
  totalResults: z.number().int(),
  results: z.array(z.object({
    externalId: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number().int(),
    abstract: z.string().optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    citationCount: z.number().int().optional()
  })),
  searchedAt: z.date()
});
export type LitSearchResult = z.infer<typeof LitSearchResultSchema>;
```

---

## Task 0.7: Package Entry Point

**File**: `packages/manuscript-engine/src/index.ts`

```typescript
// Types
export * from './types/manuscript.types';
export * from './types/imrad.types';
export * from './types/citation.types';

// Services - exported as implemented in subsequent phases
// export * from './services/data-mapper.service';
// export * from './services/phi-guard.service';
// export * from './services/version-control.service';
```

---

## Task 0.8: Database Migration

**File**: `migrations/003_create_manuscript_tables.sql`

```sql
-- ============================================
-- Migration: Create Manuscript Tables
-- ResearchFlow Production
-- ============================================

BEGIN;

-- Manuscripts table
CREATE TABLE IF NOT EXISTS manuscripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    template_type VARCHAR(50) NOT NULL DEFAULT 'imrad',
    citation_style VARCHAR(20) NOT NULL DEFAULT 'AMA',
    target_journal VARCHAR(200),
    current_version_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_manuscript_status CHECK (status IN (
        'draft', 'in_review', 'revision_requested', 
        'approved', 'submitted', 'published', 'archived'
    )),
    CONSTRAINT chk_template_type CHECK (template_type IN (
        'imrad', 'case_report', 'systematic_review', 
        'meta_analysis', 'letter', 'editorial', 'review_article'
    ))
);

-- Manuscript versions (hash-chained)
CREATE TABLE IF NOT EXISTS manuscript_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    data_snapshot_hash VARCHAR(64) NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    change_description TEXT,
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(manuscript_id, version_number)
);

-- Add FK after versions table created
ALTER TABLE manuscripts 
    ADD CONSTRAINT fk_current_version 
    FOREIGN KEY (current_version_id) 
    REFERENCES manuscript_versions(id) 
    ON DELETE SET NULL;

-- Authors
CREATE TABLE IF NOT EXISTS manuscript_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    orcid VARCHAR(19),
    affiliations TEXT[] DEFAULT '{}',
    is_corresponding BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_orcid_format CHECK (
        orcid IS NULL OR orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'
    )
);

-- Citations
CREATE TABLE IF NOT EXISTS manuscript_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    authors JSONB NOT NULL DEFAULT '[]',
    journal VARCHAR(500),
    year INTEGER NOT NULL,
    volume VARCHAR(50),
    issue VARCHAR(50),
    pages VARCHAR(50),
    doi VARCHAR(100),
    pmid VARCHAR(20),
    pmcid VARCHAR(20),
    url TEXT,
    abstract TEXT,
    keywords TEXT[] DEFAULT '{}',
    mesh_terms TEXT[] DEFAULT '{}',
    sections TEXT[] DEFAULT '{}',
    order_in_document INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(manuscript_id, source_type, external_id)
);

-- Audit log (hash-chained for immutability)
CREATE TABLE IF NOT EXISTS manuscript_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL
);

-- Performance indexes
CREATE INDEX idx_manuscripts_user_id ON manuscripts(user_id);
CREATE INDEX idx_manuscripts_status ON manuscripts(status);
CREATE INDEX idx_manuscripts_project_id ON manuscripts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_manuscript_versions_manuscript ON manuscript_versions(manuscript_id);
CREATE INDEX idx_manuscript_citations_manuscript ON manuscript_citations(manuscript_id);
CREATE INDEX idx_manuscript_citations_pmid ON manuscript_citations(pmid) WHERE pmid IS NOT NULL;
CREATE INDEX idx_manuscript_citations_doi ON manuscript_citations(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_manuscript_audit_manuscript ON manuscript_audit_log(manuscript_id);
CREATE INDEX idx_manuscript_audit_timestamp ON manuscript_audit_log(timestamp);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_manuscript_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manuscripts_updated
    BEFORE UPDATE ON manuscripts
    FOR EACH ROW EXECUTE FUNCTION update_manuscript_timestamp();

CREATE TRIGGER trg_manuscript_citations_updated
    BEFORE UPDATE ON manuscript_citations
    FOR EACH ROW EXECUTE FUNCTION update_manuscript_timestamp();

COMMIT;
```

---

## Task 0.9: Update Root Workspace

**Edit**: `package.json` (root)

Add to workspaces array:
```json
{
  "workspaces": [
    "packages/core",
    "packages/ai-router",
    "packages/phi-engine",
    "packages/manuscript-engine",
    "services/orchestrator",
    "services/web"
  ]
}
```

---

## Task 0.10: Add Makefile Commands

**Edit**: `Makefile`

Add manuscript-engine targets:
```makefile
# ============================================
# Manuscript Engine Commands
# ============================================

.PHONY: manuscript-setup manuscript-build manuscript-test

manuscript-setup:
	@echo "Setting up manuscript-engine package..."
	@./scripts/setup-manuscript-engine.sh
	@cd packages/manuscript-engine && npm install

manuscript-build:
	@echo "Building manuscript-engine..."
	@cd packages/manuscript-engine && npm run build

manuscript-test:
	@echo "Testing manuscript-engine..."
	@npm run test -- --filter=manuscript-engine

manuscript-migrate:
	@echo "Running manuscript migrations..."
	@psql $(DATABASE_URL) -f migrations/003_create_manuscript_tables.sql
```

---

## Task 0.11: OpenAPI Contract

**File**: `shared/contracts/manuscript-api.yaml`

```yaml
openapi: 3.0.3
info:
  title: ResearchFlow Manuscript API
  description: API for manuscript creation, editing, and management
  version: 0.1.0

servers:
  - url: http://localhost:3001
    description: Development

paths:
  /api/manuscripts:
    get:
      summary: List user manuscripts
      tags: [Manuscripts]
      security:
        - bearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            $ref: '#/components/schemas/ManuscriptStatus'
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Manuscripts list
          content:
            application/json:
              schema:
                type: object
                properties:
                  manuscripts:
                    type: array
                    items:
                      $ref: '#/components/schemas/Manuscript'
                  total:
                    type: integer

    post:
      summary: Create manuscript
      tags: [Manuscripts]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateManuscriptRequest'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Manuscript'

  /api/manuscripts/{id}:
    get:
      summary: Get manuscript
      tags: [Manuscripts]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Manuscript details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ManuscriptWithContent'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    ManuscriptStatus:
      type: string
      enum: [draft, in_review, revision_requested, approved, submitted, published, archived]

    TemplateType:
      type: string
      enum: [imrad, case_report, systematic_review, meta_analysis, letter, editorial, review_article]

    Manuscript:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        status:
          $ref: '#/components/schemas/ManuscriptStatus'
        templateType:
          $ref: '#/components/schemas/TemplateType'
        citationStyle:
          type: string
        targetJournal:
          type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    CreateManuscriptRequest:
      type: object
      required: [title, templateType]
      properties:
        title:
          type: string
          maxLength: 500
        templateType:
          $ref: '#/components/schemas/TemplateType'
        citationStyle:
          type: string
          default: AMA
        targetJournal:
          type: string

    ManuscriptWithContent:
      allOf:
        - $ref: '#/components/schemas/Manuscript'
        - type: object
          properties:
            content:
              type: object
            authors:
              type: array
            citations:
              type: array
            wordCount:
              type: integer
```

---

## Task 0.12: JSON Schema for Job Specs

**File**: `shared/schemas/manuscript/manuscript-job.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "manuscript-job.schema.json",
  "title": "ManuscriptJob",
  "description": "Job specification for manuscript processing tasks",
  "type": "object",
  "required": ["jobType", "manuscriptId", "userId"],
  "properties": {
    "jobType": {
      "type": "string",
      "enum": [
        "generate_section",
        "validate_data",
        "render_figure",
        "format_citations",
        "export_document",
        "phi_scan",
        "compliance_check"
      ]
    },
    "manuscriptId": {
      "type": "string",
      "format": "uuid"
    },
    "userId": {
      "type": "string",
      "format": "uuid"
    },
    "payload": {
      "type": "object"
    },
    "priority": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5
    },
    "attestationRequired": {
      "type": "boolean",
      "default": false
    }
  }
}
```

---

## Verification Checklist

Run these commands to verify Phase 0:

```bash
# 1. Run setup script
make manuscript-setup

# 2. Install dependencies
npm install

# 3. Build package
make manuscript-build

# 4. Type check
cd packages/manuscript-engine && npm run typecheck

# 5. Run migration (dev only)
make manuscript-migrate
```

### Expected Results:
- [ ] `packages/manuscript-engine/` directory exists
- [ ] `package.json` has correct workspace references
- [ ] TypeScript compiles without errors
- [ ] Database migration runs successfully
- [ ] Makefile commands work

---

## Next Phase

→ **PHASE_1_DATA_INTEGRATION.md** (Tasks 1-20)
