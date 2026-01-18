import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataMapperService,
  DataTaggerService,
  ManuscriptVersionService,
  DataCitationService
} from '@researchflow/manuscript-engine';
import type { ClinicalDataset } from '@researchflow/manuscript-engine';

const createSyntheticDataset = (): ClinicalDataset => ({
  id: 'test-001',
  name: 'Synthetic Cardiology Study',
  columns: [
    {
      name: 'Age',
      type: 'numeric',
      role: 'demographic',
      statistics: {
        count: 150,
        missing: 2,
        mean: 62.5,
        std: 11.3,
        min: 35,
        max: 88
      }
    },
    {
      name: 'Sex',
      type: 'categorical',
      role: 'demographic',
      statistics: {
        count: 150,
        missing: 0,
        categories: [
          { value: 'Male', count: 87 },
          { value: 'Female', count: 63 }
        ]
      }
    },
    {
      name: 'EjectionFraction',
      type: 'numeric',
      role: 'outcome',
      statistics: {
        count: 150,
        missing: 3,
        mean: 45.2,
        std: 12.8,
        min: 15,
        max: 70
      }
    }
  ],
  rows: [],
  metadata: {
    sourceFile: 'test.csv',
    uploadedAt: new Date(),
    studyDesign: 'RCT',
    sampleSize: 150,
    phiScanned: true
  }
});

describe('Data Integration Pipeline', () => {
  let dataset: ClinicalDataset;

  beforeEach(() => {
    dataset = createSyntheticDataset();
  });

  it('maps dataset to Results content', () => {
    const mapper = new DataMapperService();
    const results = mapper.mapToResults(dataset);

    expect(results.demographicsTable).toBeDefined();
    expect(results.demographicsTable?.title).toContain('Baseline Characteristics');
    expect(results.primaryOutcome?.variable).toBe('EjectionFraction');
    expect(results.primaryOutcome?.dataSourceId).toBe(dataset.id);
  });

  it('tags columns appropriately for sections', () => {
    const tagger = new DataTaggerService();
    const tags = tagger.tagDataset(dataset);

    expect(tags.get('Age')?.some(t => t.section === 'tables')).toBe(true);
    expect(tags.get('EjectionFraction')?.some(t => t.relevance === 1.0)).toBe(true);
    expect(tags.get('EjectionFraction')?.some(t => t.section === 'results')).toBe(true);
  });

  it('creates hash-chained versions', async () => {
    const versionService = new ManuscriptVersionService();

    const v1 = await versionService.createVersion({
      manuscriptId: 'ms-001',
      content: { abstract: 'Version 1 content' },
      dataSnapshotHash: 'hash1',
      createdBy: 'user-1'
    });

    const v2 = await versionService.createVersion({
      manuscriptId: 'ms-001',
      content: { abstract: 'Version 2 content' },
      dataSnapshotHash: 'hash2',
      createdBy: 'user-1'
    });

    expect(v2.previousHash).toBe(v1.currentHash);
    expect(versionService.verifyChainIntegrity('ms-001').valid).toBe(true);
    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
  });

  it('creates data citations with audit hash', () => {
    const citationService = new DataCitationService();

    const citation = citationService.createCitation({
      manuscriptId: 'ms-001',
      datasetId: dataset.id,
      datasetName: dataset.name,
      section: 'results'
    });

    expect(citation.auditHash).toHaveLength(64);
    expect(citation.sectionUsed).toContain('results');
    expect(citation.datasetId).toBe(dataset.id);
  });

  it('extracts statistical summary from dataset', () => {
    const tagger = new DataTaggerService();
    const summary = tagger.extractStatistics(dataset);

    expect(summary.sampleSize).toBe(150);
    expect(summary.continuousVariables).toHaveLength(2); // Age and EjectionFraction
    expect(summary.categoricalVariables).toHaveLength(1); // Sex
    expect(summary.suggestedTests).toContain('t-test or ANOVA');
  });

  it('generates methods text from dataset metadata', () => {
    const mapper = new DataMapperService();
    const methodsText = mapper.mapToMethods(dataset.metadata, dataset.columns);

    expect(methodsText).toContain('RCT');
    expect(methodsText).toContain('150 participants');
    expect(methodsText).toContain('EjectionFraction');
  });

  it('compares versions and shows diffs', async () => {
    const versionService = new ManuscriptVersionService();

    await versionService.createVersion({
      manuscriptId: 'ms-002',
      content: { introduction: 'Old intro', methods: 'Old methods' },
      dataSnapshotHash: 'hash1',
      createdBy: 'user-1'
    });

    await versionService.createVersion({
      manuscriptId: 'ms-002',
      content: { introduction: 'New intro', methods: 'Old methods', results: 'New results' },
      dataSnapshotHash: 'hash2',
      createdBy: 'user-1'
    });

    const diffs = versionService.compareVersions('ms-002', 1, 2);

    expect(diffs.some(d => d.section === 'introduction' && d.type === 'modified')).toBe(true);
    expect(diffs.some(d => d.section === 'results' && d.type === 'added')).toBe(true);
  });
});
