# Phase 1: Data Integration (Tasks 1-20)

> **Repository**: `researchflow-production`
> **Package**: `packages/manuscript-engine/`
> **Prerequisites**: Phase 0 complete

---

## Task 1: Data Schema Mapper Service

**File**: `packages/manuscript-engine/src/services/data-mapper.service.ts`

```typescript
import { v4 as uuid } from 'uuid';
import type { IMRaDSection } from '../types/imrad.types';

export interface ClinicalDataset {
  id: string;
  name: string;
  columns: DataColumn[];
  rows: Record<string, unknown>[];
  metadata: DatasetMetadata;
}

export interface DataColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'text' | 'identifier';
  role?: 'outcome' | 'exposure' | 'covariate' | 'demographic' | 'identifier';
  statistics?: ColumnStatistics;
}

export interface ColumnStatistics {
  count: number;
  missing: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  categories?: { value: string; count: number }[];
}

export interface DatasetMetadata {
  sourceFile: string;
  uploadedAt: Date;
  processedAt?: Date;
  studyDesign?: string;
  sampleSize: number;
  phiScanned: boolean;
  phiScanHash?: string;
}

export interface TableMapping {
  title: string;
  columns: string[];
  rows: TableRow[];
  footnotes?: string[];
  dataSourceId: string;
}

export interface TableRow {
  label: string;
  values: (string | number)[];
  isHeader?: boolean;
  indent?: number;
}

export interface OutcomeMapping {
  variable: string;
  description: string;
  value: number | string;
  confidenceInterval?: [number, number];
  pValue?: number;
  dataSourceId: string;
}

export interface ResultsContent {
  demographicsTable?: TableMapping;
  primaryOutcome?: OutcomeMapping;
  secondaryOutcomes?: OutcomeMapping[];
}

export class DataMapperService {
  mapToResults(data: ClinicalDataset): ResultsContent {
    const results: ResultsContent = {};
    const demographicCols = data.columns.filter(c => c.role === 'demographic');
    
    if (demographicCols.length > 0) {
      results.demographicsTable = this.buildDemographicsTable(data, demographicCols);
    }

    const outcomeCols = data.columns.filter(c => c.role === 'outcome');
    if (outcomeCols.length > 0) {
      results.primaryOutcome = this.mapOutcome(data, outcomeCols[0]);
      results.secondaryOutcomes = outcomeCols.slice(1).map(c => this.mapOutcome(data, c));
    }

    return results;
  }

  mapToMethods(metadata: DatasetMetadata, columns: DataColumn[]): string {
    const parts: string[] = [];

    if (metadata.studyDesign) {
      parts.push(`This ${metadata.studyDesign} study included ${metadata.sampleSize} participants.`);
    }

    const exposures = columns.filter(c => c.role === 'exposure');
    const outcomes = columns.filter(c => c.role === 'outcome');
    const covariates = columns.filter(c => c.role === 'covariate');

    if (exposures.length > 0) {
      parts.push(`The primary exposure variable was ${exposures[0].name}.`);
    }
    if (outcomes.length > 0) {
      parts.push(`Outcome variables included ${outcomes.map(o => o.name).join(', ')}.`);
    }
    if (covariates.length > 0) {
      parts.push(`Covariates adjusted for included ${covariates.map(c => c.name).join(', ')}.`);
    }

    return parts.join(' ');
  }

  mapToAbstract(data: ClinicalDataset): { methods: string; results: string } {
    const outcomes = data.columns.filter(c => c.role === 'outcome');
    return {
      methods: `${data.metadata.sampleSize} participants were included in this ${data.metadata.studyDesign || 'study'}.`,
      results: outcomes.length > 0 
        ? this.summarizeOutcome(data, outcomes[0])
        : 'Results were analyzed using appropriate statistical methods.'
    };
  }

  private buildDemographicsTable(data: ClinicalDataset, columns: DataColumn[]): TableMapping {
    const rows: TableRow[] = [];
    for (const col of columns) {
      if (col.statistics) {
        if (col.type === 'numeric' && col.statistics.mean !== undefined) {
          rows.push({
            label: col.name,
            values: [`${col.statistics.mean.toFixed(1)} ± ${col.statistics.std?.toFixed(1) || 'N/A'}`]
          });
        } else if (col.type === 'categorical' && col.statistics.categories) {
          rows.push({ label: col.name, values: [''], isHeader: true });
          for (const cat of col.statistics.categories) {
            const pct = ((cat.count / col.statistics.count) * 100).toFixed(1);
            rows.push({ label: `  ${cat.value}`, values: [`${cat.count} (${pct}%)`], indent: 1 });
          }
        }
      }
    }
    return { title: 'Table 1. Baseline Characteristics', columns: ['Characteristic', 'Value'], rows, dataSourceId: data.id };
  }

  private mapOutcome(data: ClinicalDataset, column: DataColumn): OutcomeMapping {
    return {
      variable: column.name,
      description: column.name,
      value: column.statistics?.mean || 0,
      confidenceInterval: column.statistics?.mean && column.statistics?.std
        ? [column.statistics.mean - 1.96 * column.statistics.std / Math.sqrt(column.statistics.count),
           column.statistics.mean + 1.96 * column.statistics.std / Math.sqrt(column.statistics.count)]
        : undefined,
      dataSourceId: data.id
    };
  }

  private summarizeOutcome(data: ClinicalDataset, column: DataColumn): string {
    if (column.statistics?.mean !== undefined) {
      return `The mean ${column.name} was ${column.statistics.mean.toFixed(2)} (SD ${column.statistics.std?.toFixed(2) || 'N/A'}).`;
    }
    return `${column.name} was analyzed.`;
  }
}

export const dataMapperService = new DataMapperService();
```

---

## Task 2: Data Auto-Tagger Service

**File**: `packages/manuscript-engine/src/services/data-tagger.service.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';
import type { DataColumn, ClinicalDataset } from './data-mapper.service';

export interface SectionTag {
  section: IMRaDSection;
  relevance: number;
  reason: string;
}

export interface StatisticalSummary {
  sampleSize: number;
  continuousVariables: { name: string; n: number; mean: number; sd: number; range: [number, number] }[];
  categoricalVariables: { name: string; n: number; categories: { label: string; count: number; percentage: number }[] }[];
  suggestedTests: string[];
}

export class DataTaggerService {
  tagForSection(column: DataColumn): SectionTag[] {
    const tags: SectionTag[] = [];

    if (column.role === 'demographic') {
      tags.push({ section: 'results', relevance: 0.9, reason: 'Demographic data for Table 1' });
      tags.push({ section: 'tables', relevance: 0.95, reason: 'Baseline characteristics' });
    }
    if (column.role === 'outcome') {
      tags.push({ section: 'results', relevance: 1.0, reason: 'Primary/secondary outcome' });
      tags.push({ section: 'abstract', relevance: 0.8, reason: 'Key finding for abstract' });
    }
    if (column.role === 'exposure') {
      tags.push({ section: 'methods', relevance: 0.9, reason: 'Exposure variable definition' });
      tags.push({ section: 'results', relevance: 0.7, reason: 'Exposure distribution' });
    }
    if (column.role === 'covariate') {
      tags.push({ section: 'methods', relevance: 0.8, reason: 'Covariate for adjustment' });
    }
    if (column.type === 'identifier') {
      tags.push({ section: 'methods', relevance: 0.3, reason: 'Sample size reference only' });
    }

    return tags.sort((a, b) => b.relevance - a.relevance);
  }

  extractStatistics(data: ClinicalDataset): StatisticalSummary {
    const continuous: StatisticalSummary['continuousVariables'] = [];
    const categorical: StatisticalSummary['categoricalVariables'] = [];
    const suggestedTests: string[] = [];

    for (const col of data.columns) {
      if (col.type === 'identifier') continue;

      if (col.type === 'numeric' && col.statistics) {
        continuous.push({
          name: col.name,
          n: col.statistics.count - col.statistics.missing,
          mean: col.statistics.mean || 0,
          sd: col.statistics.std || 0,
          range: [col.statistics.min || 0, col.statistics.max || 0]
        });
      }
      if (col.type === 'categorical' && col.statistics?.categories) {
        categorical.push({
          name: col.name,
          n: col.statistics.count,
          categories: col.statistics.categories.map(c => ({
            label: c.value,
            count: c.count,
            percentage: (c.count / col.statistics!.count) * 100
          }))
        });
      }
    }

    if (continuous.length >= 2) suggestedTests.push('Pearson correlation');
    if (categorical.length >= 1 && continuous.length >= 1) suggestedTests.push('t-test or ANOVA');
    if (categorical.length >= 2) suggestedTests.push('Chi-square test');

    return { sampleSize: data.metadata.sampleSize, continuousVariables: continuous, categoricalVariables: categorical, suggestedTests };
  }

  tagDataset(data: ClinicalDataset): Map<string, SectionTag[]> {
    const tagMap = new Map<string, SectionTag[]>();
    for (const column of data.columns) {
      tagMap.set(column.name, this.tagForSection(column));
    }
    return tagMap;
  }
}

export const dataTaggerService = new DataTaggerService();
```

---

## Task 3: Visualization Service

**File**: `packages/manuscript-engine/src/services/visualization.service.ts`

```typescript
export type ChartType = 'bar' | 'line' | 'scatter' | 'box' | 'histogram' | 'kaplan_meier' | 'forest';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xAxis: { label: string; column?: string };
  yAxis: { label: string; column?: string };
  data: { name: string; values: { x: number | string; y: number }[] }[];
}

export interface GeneratedChart {
  id: string;
  config: ChartConfig;
  dataSourceId: string;
  figureNumber?: number;
  caption: string;
  altText: string;
  format: 'svg' | 'png';
}

export class VisualizationService {
  generateCaption(config: ChartConfig, figureNumber: number): string {
    const types: Record<ChartType, string> = {
      bar: 'Bar chart showing', line: 'Line graph depicting', scatter: 'Scatter plot illustrating',
      box: 'Box plot comparing', histogram: 'Distribution of', kaplan_meier: 'Kaplan-Meier survival curve for', forest: 'Forest plot of'
    };
    return `Figure ${figureNumber}. ${types[config.type] || 'Figure showing'} ${config.yAxis.label} by ${config.xAxis.label}.`;
  }

  generateAltText(config: ChartConfig): string {
    const dataDesc = config.data.map(s => `${s.name}: ${s.values.length} points`).join('; ');
    return `${config.type} chart titled "${config.title}". X-axis: ${config.xAxis.label}. Y-axis: ${config.yAxis.label}. Data: ${dataDesc}.`;
  }

  createRenderJob(chart: GeneratedChart): object {
    return {
      jobType: 'render_chart',
      payload: { chartId: chart.id, config: chart.config, format: chart.format, width: 800, height: 600, dpi: 300 }
    };
  }
}

export const visualizationService = new VisualizationService();
```

---

## Task 4: Data Citation Service

**File**: `packages/manuscript-engine/src/services/data-citation.service.ts`

```typescript
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';

export interface DataCitation {
  id: string;
  manuscriptId: string;
  datasetId: string;
  datasetName: string;
  accessDate: Date;
  columns?: string[];
  rowRange?: [number, number];
  filterCriteria?: string;
  auditHash: string;
  sectionUsed: string[];
}

export class DataCitationService {
  private citations: Map<string, DataCitation> = new Map();

  createCitation(request: {
    manuscriptId: string;
    datasetId: string;
    datasetName: string;
    columns?: string[];
    rowRange?: [number, number];
    filterCriteria?: string;
    section: string;
  }): DataCitation {
    const id = uuid();
    const auditHash = createHash('sha256').update(JSON.stringify({
      datasetId: request.datasetId,
      columns: request.columns?.sort(),
      rowRange: request.rowRange,
      timestamp: new Date().toISOString()
    })).digest('hex');

    const citation: DataCitation = {
      id,
      manuscriptId: request.manuscriptId,
      datasetId: request.datasetId,
      datasetName: request.datasetName,
      accessDate: new Date(),
      columns: request.columns,
      rowRange: request.rowRange,
      filterCriteria: request.filterCriteria,
      auditHash,
      sectionUsed: [request.section]
    };

    this.citations.set(id, citation);
    return citation;
  }

  addSectionToCitation(id: string, section: string): DataCitation | null {
    const citation = this.citations.get(id);
    if (citation && !citation.sectionUsed.includes(section)) {
      citation.sectionUsed.push(section);
    }
    return citation || null;
  }

  getCitationsForManuscript(manuscriptId: string): DataCitation[] {
    return Array.from(this.citations.values()).filter(c => c.manuscriptId === manuscriptId);
  }
}

export const dataCitationService = new DataCitationService();
```

---

## Task 5: Data Filter Types

**File**: `packages/manuscript-engine/src/types/data-filter.types.ts`

```typescript
import { z } from 'zod';

export const FilterOperatorSchema = z.enum([
  'equals', 'not_equals', 'greater_than', 'less_than', 'between', 'contains', 'in_list', 'is_null', 'is_not_null'
]);

export const DataFilterSchema = z.object({
  id: z.string().uuid(),
  column: z.string(),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]).optional(),
  valueTo: z.number().optional()
});
export type DataFilter = z.infer<typeof DataFilterSchema>;

export const DataSelectionSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  datasetId: z.string().uuid(),
  targetSection: z.string(),
  selectedColumns: z.array(z.string()),
  filters: z.array(DataFilterSchema),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().positive().optional(),
  createdAt: z.date(),
  createdBy: z.string().uuid()
});
export type DataSelection = z.infer<typeof DataSelectionSchema>;
```

---

## Task 6: PHI Guard Service (CRITICAL)

**File**: `packages/manuscript-engine/src/services/phi-guard.service.ts`

```typescript
import { createHash } from 'crypto';
// Integrates with: @researchflow/phi-engine

export interface ManuscriptPHIScanResult {
  isClean: boolean;
  scanTimestamp: Date;
  scanHash: string;
  matches: { type: string; text: string; position: number }[];
  blockedReason?: string;
}

export interface AuditContext {
  manuscriptId: string;
  section: string;
  userId: string;
  action: 'scan' | 'redact' | 'insert';
}

export class ManuscriptPHIGuard {
  /**
   * FAIL-CLOSED: If scan fails, block insertion
   */
  async scanBeforeInsertion(content: string, context: AuditContext): Promise<ManuscriptPHIScanResult> {
    try {
      // Import PHI scanner from phi-engine package
      const { PHIScanner } = await import('@researchflow/phi-engine');
      const scanner = new PHIScanner({ patterns: 'all', strictMode: true });
      const result = await scanner.scan(content);
      
      const scanHash = createHash('sha256').update(JSON.stringify({
        contentHash: createHash('sha256').update(content).digest('hex'),
        matchCount: result.matches.length,
        timestamp: new Date().toISOString()
      })).digest('hex');

      await this.logAudit(context, 'scan', { contentLength: content.length, matchCount: result.matches.length, scanHash });

      return {
        isClean: result.matches.length === 0,
        scanTimestamp: new Date(),
        scanHash,
        matches: result.matches
      };
    } catch (error) {
      // FAIL-CLOSED
      await this.logAudit(context, 'scan_error', { error: String(error) });
      return {
        isClean: false,
        scanTimestamp: new Date(),
        scanHash: '',
        matches: [],
        blockedReason: 'PHI scan failed - insertion blocked for safety'
      };
    }
  }

  async redactAndLog(
    content: string,
    options: { strategy: 'mask' | 'remove' | 'generalize'; maskChar?: string },
    context: AuditContext
  ): Promise<{ content: string; result: ManuscriptPHIScanResult }> {
    const scanResult = await this.scanBeforeInsertion(content, context);
    if (scanResult.isClean) return { content, result: scanResult };

    let redacted = content;
    for (const match of scanResult.matches) {
      const replacement = options.strategy === 'mask' 
        ? (options.maskChar || '*').repeat(match.text.length)
        : '[REDACTED]';
      redacted = redacted.replace(match.text, replacement);
    }

    await this.logAudit(context, 'redact', { originalLength: content.length, redactedLength: redacted.length, redactionCount: scanResult.matches.length });
    return { content: redacted, result: { ...scanResult, isClean: true } };
  }

  async validateForExport(manuscriptId: string, content: string, userId: string): Promise<{ approved: boolean; reason?: string }> {
    const result = await this.scanBeforeInsertion(content, { manuscriptId, section: 'full_document', userId, action: 'scan' });
    if (!result.isClean) {
      return { approved: false, reason: `PHI detected: ${result.matches.length} identifiers found` };
    }
    return { approved: true };
  }

  private async logAudit(context: AuditContext, eventType: string, details: Record<string, unknown>): Promise<void> {
    console.log(`[PHI_GUARD] ${eventType}`, { ...context, ...details, timestamp: new Date().toISOString() });
    // TODO: Integrate with services/orchestrator/src/services/audit.service.ts
  }
}

export const manuscriptPHIGuard = new ManuscriptPHIGuard();
```

---

## Task 7: Table Templates

**File**: `packages/manuscript-engine/src/templates/table-templates.ts`

```typescript
export interface TableTemplate {
  id: string;
  name: string;
  description: string;
  columns: string[];
  rowGroups: { label: string; indent: number; variables: string[]; format: 'mean_sd' | 'median_iqr' | 'n_percent' | 'range' }[];
  footnotes?: string[];
}

export const DEMOGRAPHICS_TABLE: TableTemplate = {
  id: 'demographics',
  name: 'Table 1. Baseline Characteristics',
  description: 'Standard demographics table',
  columns: ['Characteristic', 'Overall (N={n})', 'Group 1 (n={n1})', 'Group 2 (n={n2})', 'P-value'],
  rowGroups: [
    { label: 'Demographics', indent: 0, variables: ['age', 'sex', 'race'], format: 'mean_sd' },
    { label: 'Clinical', indent: 0, variables: ['bmi', 'comorbidities'], format: 'n_percent' }
  ],
  footnotes: ['Data presented as mean ± SD or n (%).']
};

export const OUTCOMES_TABLE: TableTemplate = {
  id: 'outcomes',
  name: 'Table 2. Primary and Secondary Outcomes',
  description: 'Outcomes comparison table',
  columns: ['Outcome', 'Group 1', 'Group 2', 'Difference (95% CI)', 'P-value'],
  rowGroups: [
    { label: 'Primary Outcome', indent: 0, variables: ['primary_outcome'], format: 'mean_sd' },
    { label: 'Secondary Outcomes', indent: 0, variables: ['secondary_1', 'secondary_2'], format: 'mean_sd' }
  ]
};

export const REGRESSION_TABLE: TableTemplate = {
  id: 'regression',
  name: 'Table 3. Regression Analysis',
  description: 'Regression model results',
  columns: ['Variable', 'Coefficient/OR', '95% CI', 'P-value'],
  rowGroups: []
};

export const TABLE_TEMPLATES: Record<string, TableTemplate> = {
  demographics: DEMOGRAPHICS_TABLE,
  outcomes: OUTCOMES_TABLE,
  regression: REGRESSION_TABLE
};

export function formatTableValue(
  value: number | string | null,
  format: 'mean_sd' | 'median_iqr' | 'n_percent' | 'range',
  stats?: { sd?: number; iqr?: [number, number]; total?: number }
): string {
  if (value === null) return '—';
  switch (format) {
    case 'mean_sd': return stats?.sd ? `${Number(value).toFixed(1)} ± ${stats.sd.toFixed(1)}` : String(value);
    case 'n_percent': return stats?.total ? `${value} (${((Number(value) / stats.total) * 100).toFixed(1)}%)` : String(value);
    default: return String(value);
  }
}
```

---

## Task 8: Abstract Generator Prompt

**File**: `packages/manuscript-engine/src/prompts/abstract-generator.prompt.ts`

```typescript
export interface AbstractGeneratorInput {
  studyType: string;
  objectives: string;
  methods: string;
  keyResults: string[];
  primaryConclusion: string;
  sampleSize: number;
  wordLimit?: number;
}

export const ABSTRACT_SYSTEM_PROMPT = `You are an expert medical manuscript writer.
Generate clear, concise abstracts that:
- Follow standard medical writing conventions
- Present data objectively
- Respect word limits strictly
- Never include PHI or fabricate data`;

export const STRUCTURED_ABSTRACT_PROMPT = `Generate a structured abstract with sections: BACKGROUND, METHODS, RESULTS, CONCLUSIONS.

Input:
- Study Type: {studyType}
- Sample Size: {sampleSize}
- Objectives: {objectives}
- Methods: {methods}
- Key Results: {keyResults}
- Conclusion: {primaryConclusion}

Word limit: {wordLimit} words maximum.
Return JSON: { background, methods, results, conclusions }`;

export function buildAbstractPrompt(input: AbstractGeneratorInput, structured = true): string {
  return STRUCTURED_ABSTRACT_PROMPT
    .replace('{studyType}', input.studyType)
    .replace('{sampleSize}', String(input.sampleSize))
    .replace('{objectives}', input.objectives)
    .replace('{methods}', input.methods)
    .replace('{keyResults}', input.keyResults.join('; '))
    .replace('{primaryConclusion}', input.primaryConclusion)
    .replace('{wordLimit}', String(input.wordLimit || 300));
}
```

---

## Task 9: Version Control Service

**File**: `packages/manuscript-engine/src/services/version-control.service.ts`

```typescript
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import type { ManuscriptVersion } from '../types/manuscript.types';

export interface VersionDiff {
  section: string;
  type: 'added' | 'removed' | 'modified';
  oldContent?: string;
  newContent?: string;
  wordCountChange: number;
}

export class ManuscriptVersionService {
  private versions: Map<string, ManuscriptVersion[]> = new Map();
  private lastHash: Map<string, string> = new Map();

  async createVersion(request: {
    manuscriptId: string;
    content: Record<string, unknown>;
    dataSnapshotHash: string;
    createdBy: string;
    changeDescription?: string;
  }): Promise<ManuscriptVersion> {
    const manuscriptVersions = this.versions.get(request.manuscriptId) || [];
    const versionNumber = manuscriptVersions.length + 1;
    const previousHash = this.lastHash.get(request.manuscriptId);

    const wordCount = this.calculateWordCount(request.content);
    const currentHash = createHash('sha256').update(JSON.stringify({
      manuscriptId: request.manuscriptId,
      content: request.content,
      dataSnapshotHash: request.dataSnapshotHash,
      previousHash,
      timestamp: new Date().toISOString()
    })).digest('hex');

    const version: ManuscriptVersion = {
      id: uuid(),
      manuscriptId: request.manuscriptId,
      versionNumber,
      content: request.content,
      dataSnapshotHash: request.dataSnapshotHash,
      wordCount,
      createdAt: new Date(),
      createdBy: request.createdBy,
      changeDescription: request.changeDescription,
      previousHash,
      currentHash
    };

    manuscriptVersions.push(version);
    this.versions.set(request.manuscriptId, manuscriptVersions);
    this.lastHash.set(request.manuscriptId, currentHash);
    return version;
  }

  getVersionHistory(manuscriptId: string): ManuscriptVersion[] {
    return this.versions.get(manuscriptId) || [];
  }

  getVersion(manuscriptId: string, versionNumber: number): ManuscriptVersion | null {
    return this.versions.get(manuscriptId)?.find(v => v.versionNumber === versionNumber) || null;
  }

  compareVersions(manuscriptId: string, from: number, to: number): VersionDiff[] {
    const fromV = this.getVersion(manuscriptId, from);
    const toV = this.getVersion(manuscriptId, to);
    if (!fromV || !toV) throw new Error('Version not found');

    const diffs: VersionDiff[] = [];
    const allSections = new Set([...Object.keys(fromV.content), ...Object.keys(toV.content)]);

    for (const section of allSections) {
      const old = fromV.content[section] as string | undefined;
      const curr = toV.content[section] as string | undefined;
      if (!old && curr) diffs.push({ section, type: 'added', newContent: curr, wordCountChange: this.countWords(curr) });
      else if (old && !curr) diffs.push({ section, type: 'removed', oldContent: old, wordCountChange: -this.countWords(old) });
      else if (old !== curr) diffs.push({ section, type: 'modified', oldContent: old, newContent: curr, wordCountChange: this.countWords(curr || '') - this.countWords(old || '') });
    }
    return diffs;
  }

  verifyChainIntegrity(manuscriptId: string): { valid: boolean; brokenAt?: number } {
    const versions = this.versions.get(manuscriptId) || [];
    for (let i = 1; i < versions.length; i++) {
      if (versions[i].previousHash !== versions[i - 1].currentHash) {
        return { valid: false, brokenAt: versions[i].versionNumber };
      }
    }
    return { valid: true };
  }

  private calculateWordCount(content: Record<string, unknown>): number {
    return Object.values(content).reduce((total, v) => total + (typeof v === 'string' ? this.countWords(v) : 0), 0);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const versionControlService = new ManuscriptVersionService();
```

---

## Task 10: Data Format Validator

**File**: `packages/manuscript-engine/src/utils/data-validator.ts`

```typescript
import type { IMRaDSection } from '../types/imrad.types';

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string; code: string }[];
  warnings: { field: string; message: string; suggestion?: string }[];
}

export class DataFormatValidator {
  validateForSection(data: unknown, section: IMRaDSection): ValidationResult {
    if (data === null || data === undefined) {
      return { valid: false, errors: [{ field: 'data', message: 'Data cannot be null', code: 'NULL_DATA' }], warnings: [] };
    }
    switch (section) {
      case 'results': return this.validateForResults(data);
      case 'abstract': return this.validateForAbstract(data);
      default: return { valid: true, errors: [], warnings: [] };
    }
  }

  validateNumericPrecision(value: number, context: 'p_value' | 'percentage' | 'mean' | 'count'): { valid: boolean; formatted: string; warning?: string } {
    switch (context) {
      case 'p_value': return value < 0.001 ? { valid: true, formatted: '<0.001' } : { valid: true, formatted: value.toFixed(3) };
      case 'percentage': return { valid: value >= 0 && value <= 100, formatted: value.toFixed(1), warning: value < 0 || value > 100 ? 'Outside 0-100' : undefined };
      case 'count': return { valid: true, formatted: Math.round(value).toString(), warning: !Number.isInteger(value) ? 'Rounded' : undefined };
      default: return { valid: true, formatted: value.toFixed(2) };
    }
  }

  private validateForResults(data: unknown): ValidationResult {
    const warnings: ValidationResult['warnings'] = [];
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (!obj.sampleSize && !obj.n) warnings.push({ field: 'sampleSize', message: 'Sample size not specified' });
    }
    return { valid: true, errors: [], warnings };
  }

  private validateForAbstract(data: unknown): ValidationResult {
    const warnings: ValidationResult['warnings'] = [];
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      for (const field of ['methods', 'results', 'conclusions']) {
        if (!obj[field]) warnings.push({ field, message: `Missing ${field} section` });
      }
    }
    return { valid: true, errors: [], warnings };
  }
}

export const dataFormatValidator = new DataFormatValidator();
```

---

## Task 11: Manuscript Data API Routes

**File**: `services/orchestrator/src/routes/manuscript/data.routes.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rbacMiddleware } from '../../middleware/rbac.middleware';
import { auditLog } from '../../services/audit.service';
import { manuscriptPHIGuard } from '@researchflow/manuscript-engine';

const router = Router();

router.use(rbacMiddleware(['researcher', 'author', 'admin']));

// GET /api/manuscripts/:manuscriptId/data
router.get('/:manuscriptId/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { manuscriptId } = req.params;
    const userId = req.user!.id;
    // TODO: Implement data source listing
    await auditLog({ action: 'manuscript_data_list', userId, resourceId: manuscriptId, resourceType: 'manuscript' });
    res.json({ dataSources: [] });
  } catch (error) { next(error); }
});

// POST /api/manuscripts/:manuscriptId/data/select
const SelectionSchema = z.object({
  datasetId: z.string().uuid(),
  targetSection: z.string(),
  selectedColumns: z.array(z.string()),
  filters: z.array(z.object({ column: z.string(), operator: z.string(), value: z.unknown() })).optional()
});

router.post('/:manuscriptId/data/select', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { manuscriptId } = req.params;
    const userId = req.user!.id;
    const selection = SelectionSchema.parse(req.body);

    // PHI scan before returning
    const mockData = JSON.stringify({ columns: selection.selectedColumns });
    const scanResult = await manuscriptPHIGuard.scanBeforeInsertion(mockData, { manuscriptId, section: selection.targetSection, userId, action: 'scan' });

    if (!scanResult.isClean) {
      return res.status(400).json({ error: 'PHI detected', matches: scanResult.matches.length });
    }

    await auditLog({ action: 'manuscript_data_select', userId, resourceId: manuscriptId, resourceType: 'manuscript', details: { datasetId: selection.datasetId, scanHash: scanResult.scanHash } });
    res.json({ selection, phiScanHash: scanResult.scanHash });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.errors });
    next(error);
  }
});

export default router;
```

**Register in**: `services/orchestrator/src/routes/index.ts`
```typescript
import manuscriptDataRoutes from './manuscript/data.routes';
router.use('/api/manuscripts', manuscriptDataRoutes);
```

---

## Task 12: Data Lineage Service

**File**: `packages/manuscript-engine/src/services/data-lineage.service.ts`

```typescript
import { v4 as uuid } from 'uuid';

export type LineageNodeType = 'upload' | 'processing' | 'extraction' | 'transformation' | 'phi_scan' | 'section_insert' | 'export';

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  timestamp: Date;
  userId: string;
  sourceId?: string;
  auditHash?: string;
  manuscriptSection?: string;
  details?: Record<string, unknown>;
}

export interface LineageEdge {
  from: string;
  to: string;
  relationship: 'derived_from' | 'processed_by' | 'inserted_into' | 'exported_from';
  timestamp: Date;
}

export class DataLineageService {
  private nodes: Map<string, LineageNode> = new Map();
  private edges: LineageEdge[] = [];

  recordEvent(params: {
    manuscriptId: string;
    type: LineageNodeType;
    label: string;
    userId: string;
    sourceId?: string;
    section?: string;
    auditHash?: string;
    details?: Record<string, unknown>;
  }): LineageNode {
    const node: LineageNode = {
      id: uuid(),
      type: params.type,
      label: params.label,
      timestamp: new Date(),
      userId: params.userId,
      sourceId: params.sourceId,
      manuscriptSection: params.section,
      auditHash: params.auditHash,
      details: { ...params.details, manuscriptId: params.manuscriptId }
    };

    this.nodes.set(node.id, node);

    if (params.sourceId && this.nodes.has(params.sourceId)) {
      this.edges.push({
        from: params.sourceId,
        to: node.id,
        relationship: this.inferRelationship(params.type),
        timestamp: new Date()
      });
    }

    return node;
  }

  traceToSource(nodeId: string): LineageNode[] {
    const path: LineageNode[] = [];
    let currentId: string | undefined = nodeId;

    while (currentId) {
      const node = this.nodes.get(currentId);
      if (!node) break;
      path.unshift(node);
      const edge = this.edges.find(e => e.to === currentId);
      currentId = edge?.from;
    }

    return path;
  }

  private inferRelationship(type: LineageNodeType): LineageEdge['relationship'] {
    switch (type) {
      case 'processing': case 'transformation': return 'processed_by';
      case 'section_insert': return 'inserted_into';
      case 'export': return 'exported_from';
      default: return 'derived_from';
    }
  }
}

export const dataLineageService = new DataLineageService();
```

---

## Tasks 13-20: Additional Services

**File**: `packages/manuscript-engine/src/services/chart-embed.service.ts` (Task 13)
**File**: `packages/manuscript-engine/src/services/pre-draft-validator.service.ts` (Task 14)
**File**: `packages/manuscript-engine/src/services/comparison-importer.service.ts` (Task 15)
**File**: `packages/manuscript-engine/src/services/data-sync.service.ts` (Task 16)
**File**: `packages/manuscript-engine/src/utils/metadata-extractor.ts` (Task 17)
**File**: `packages/manuscript-engine/src/services/quarantine.service.ts` (Task 18)
**File**: `packages/manuscript-engine/src/services/data-search.service.ts` (Task 19)

*(See previous detailed implementations - included in full prompt)*

---

## Task 20: Integration Tests

**File**: `tests/integration/manuscript-engine/data-integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DataMapperService, ClinicalDataset } from '@researchflow/manuscript-engine';
import { DataTaggerService } from '@researchflow/manuscript-engine';
import { ManuscriptVersionService } from '@researchflow/manuscript-engine';
import { DataCitationService } from '@researchflow/manuscript-engine';

const createSyntheticDataset = (): ClinicalDataset => ({
  id: 'test-001',
  name: 'Synthetic Cardiology Study',
  columns: [
    { name: 'Age', type: 'numeric', role: 'demographic', statistics: { count: 150, missing: 2, mean: 62.5, std: 11.3, min: 35, max: 88 } },
    { name: 'Sex', type: 'categorical', role: 'demographic', statistics: { count: 150, missing: 0, categories: [{ value: 'Male', count: 87 }, { value: 'Female', count: 63 }] } },
    { name: 'EjectionFraction', type: 'numeric', role: 'outcome', statistics: { count: 150, missing: 3, mean: 45.2, std: 12.8, min: 15, max: 70 } }
  ],
  rows: [],
  metadata: { sourceFile: 'test.csv', uploadedAt: new Date(), studyDesign: 'RCT', sampleSize: 150, phiScanned: true }
});

describe('Data Integration Pipeline', () => {
  let dataset: ClinicalDataset;

  beforeEach(() => { dataset = createSyntheticDataset(); });

  it('maps dataset to Results content', () => {
    const mapper = new DataMapperService();
    const results = mapper.mapToResults(dataset);
    expect(results.demographicsTable).toBeDefined();
    expect(results.primaryOutcome?.variable).toBe('EjectionFraction');
  });

  it('tags columns appropriately', () => {
    const tagger = new DataTaggerService();
    const tags = tagger.tagDataset(dataset);
    expect(tags.get('Age')?.some(t => t.section === 'tables')).toBe(true);
    expect(tags.get('EjectionFraction')?.some(t => t.relevance === 1.0)).toBe(true);
  });

  it('creates hash-chained versions', async () => {
    const versionService = new ManuscriptVersionService();
    const v1 = await versionService.createVersion({ manuscriptId: 'ms-001', content: { abstract: 'V1' }, dataSnapshotHash: 'hash', createdBy: 'user-1' });
    const v2 = await versionService.createVersion({ manuscriptId: 'ms-001', content: { abstract: 'V2' }, dataSnapshotHash: 'hash', createdBy: 'user-1' });
    expect(v2.previousHash).toBe(v1.currentHash);
    expect(versionService.verifyChainIntegrity('ms-001').valid).toBe(true);
  });

  it('creates data citations with audit hash', () => {
    const citationService = new DataCitationService();
    const citation = citationService.createCitation({ manuscriptId: 'ms-001', datasetId: dataset.id, datasetName: dataset.name, section: 'results' });
    expect(citation.auditHash).toHaveLength(64);
  });
});
```

---

## Verification Checklist

```bash
# Build package
make manuscript-build

# Run tests
npm run test -- --filter=manuscript-engine

# Type check
cd packages/manuscript-engine && npm run typecheck
```

- [ ] All services compile without errors
- [ ] Integration tests pass
- [ ] PHI guard blocks unsafe content
- [ ] Version chain integrity verified

---

## Next Phase

→ **PHASE_2_LITERATURE_INTEGRATION.md** (Tasks 21-40)
