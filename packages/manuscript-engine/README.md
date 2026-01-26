# @researchflow/manuscript-engine

> Clinical data integration and AI-powered manuscript generation for ResearchFlow

## Overview

The manuscript-engine package transforms clinical data and literature searches into publication-ready medical manuscripts following IMRaD structure. It provides comprehensive tools for:

- Clinical data mapping to manuscript sections
- PHI protection with fail-closed security
- AI-assisted writing and generation
- Literature integration and citation management
- Multi-format export (Word, PDF, LaTeX)
- Compliance checking (ICMJE, CONSORT, STROBE, PRISMA)

## Installation

```bash
pnpm add @researchflow/manuscript-engine
```

## Quick Start

```typescript
import {
  getDataMapper,
  getPhiGuard,
  getTableTemplate
} from '@researchflow/manuscript-engine';

// Map clinical data to manuscript sections
const mapper = getDataMapper();
const sections = mapper.mapToManuscript(clinicalData);

// Generate demographics table
const demoTable = getTableTemplate('demographics');
```

## Features

### Core Services

#### PHI Guard Service (CRITICAL)

Fail-closed PHI protection for all manuscript content:

```typescript
import { getPhiGuard } from '@researchflow/manuscript-engine';

const phiGuard = getPhiGuard({ scanner, failClosed: true });
const result = await phiGuard.scanBeforeInsertion(content, {
  manuscriptId: 'ms-123',
  section: 'results',
  userId: 'user-456'
});

if (!result.passed) {
  // Content blocked - PHI detected
}
```

#### Data Mapper Service

Automatically maps clinical data to appropriate manuscript sections:

```typescript
import { getDataMapper } from '@researchflow/manuscript-engine';

const mapper = getDataMapper();

// Map to individual sections
const resultsText = mapper.mapToResults(clinicalData);
const methodsText = mapper.mapToMethods(clinicalData.metadata);
const abstractText = mapper.mapToAbstract(clinicalData);

// Or map to all sections at once
const allSections = mapper.mapToManuscript(clinicalData);
```

#### Data Tagger Service

Tags data points for section relevance:

```typescript
import { getDataTagger } from '@researchflow/manuscript-engine';

const tagger = getDataTagger();
const tags = tagger.tagForSection('pValue', 0.03);
// Returns: ['results', 'discussion']

const taggedData = tagger.tagDataset(clinicalData);
```

#### Version Control Service

Track manuscript versions with data snapshots:

```typescript
import { getVersionControl } from '@researchflow/manuscript-engine';

const versionControl = getVersionControl();
const version = versionControl.createVersion(
  manuscriptId,
  content,
  dataSnapshotHash,
  userId,
  'Added results section'
);

// Generate diff between versions
const diff = versionControl.generateDiff(oldVersionId, newVersionId);

// Rollback to previous version
const rolledBack = versionControl.rollback(manuscriptId, targetVersionId, userId);
```

### Templates

#### Table Templates

Pre-defined templates for common clinical tables:

```typescript
import { getTableTemplate, TABLE_TEMPLATES } from '@researchflow/manuscript-engine';

// Get demographics table template
const demoTable = getTableTemplate('demographics');

// Available templates:
// - demographics: Table 1 baseline characteristics
// - outcomes: Primary and secondary outcomes
// - comparison: Group comparisons
// - regression: Multivariable regression results

// Create custom table from data
import { createTableFromData } from '@researchflow/manuscript-engine';

const customTable = createTableFromData(
  'Custom Analysis',
  dataArray,
  'Table 5. Custom Analysis Results',
  ['Note: Data presented as mean ± SD']
);
```

### AI Integration

#### Abstract Generation

```typescript
import { buildAbstractPrompt } from '@researchflow/manuscript-engine';

const prompt = buildAbstractPrompt({
  objectives: 'To evaluate the effectiveness of...',
  methods: 'Retrospective cohort study of...',
  results: 'Mean age was 54.3 years, primary outcome...',
  conclusion: 'The intervention was associated with...'
});

// Use with @researchflow/ai-router
const abstract = await aiRouter.generate(prompt, { task: 'abstract_generate' });
```

## Architecture

### IMRaD Structure

The engine follows the IMRaD (Introduction, Methods, Results, And Discussion) manuscript structure:

- **Abstract**: Structured summary (Background, Methods, Results, Conclusions)
- **Introduction**: Background, gaps, objectives
- **Methods**: Study design, population, variables, analysis
- **Results**: Findings with statistics and figures
- **Discussion**: Interpretation, comparison, limitations, implications
- **References**: Auto-generated citation list

### Security Model

**PHI Protection (CRITICAL)**:
- Mandatory PHI scanning before any data enters manuscript
- Fail-closed behavior: operations block if PHI detected or scan fails
- All PHI detections logged to immutable audit trail
- 100% PHI detection rate required (zero false negatives)

**Audit Trail**:
- Hash-chained audit logs for all manuscript changes
- Track all AI assistance and data access
- Immutable and tamper-proof
- 7-year retention per HIPAA requirements

### Compliance

The engine supports multiple compliance frameworks:

- **ICMJE**: International Committee of Medical Journal Editors
- **CONSORT**: Randomized controlled trials
- **STROBE**: Observational studies
- **PRISMA**: Systematic reviews and meta-analyses

## Testing

```bash
# Run tests
pnpm test

# Run with coverage (90% target)
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Development

```bash
# Type checking
pnpm typecheck

# Build
pnpm build
```

## License

Private - ResearchFlow Production

## Co-Authored-By

Claude Sonnet 4.5 <noreply@anthropic.com>
