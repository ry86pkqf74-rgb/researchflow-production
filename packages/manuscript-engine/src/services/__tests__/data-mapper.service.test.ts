/**
 * Data Mapper Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataMapperService } from '../data-mapper.service';
import type { ClinicalDataset } from '../../types';

describe('DataMapperService', () => {
  let mapper: DataMapperService;

  beforeEach(() => {
    mapper = DataMapperService.getInstance();
  });

  describe('mapToResults', () => {
    it('should map clinical data to results section', () => {
      const data: ClinicalDataset = {
        id: 'dataset-1',
        name: 'Test Study',
        type: 'trial',
        metadata: {
          studyDesign: 'randomized controlled trial',
          population: 'adults with hypertension',
          sampleSize: 150,
          variables: ['blood pressure', 'heart rate'],
        },
        data: [],
        statistics: {
          summary: {},
          tests: [
            {
              name: 'Independent t-test',
              pValue: 0.032,
              statistic: 2.15,
              confidenceInterval: [0.5, 2.8],
            },
          ],
        },
      };

      const results = mapper.mapToResults(data);

      expect(results).toContain('150');
      expect(results).toContain('adults with hypertension');
      expect(results).toContain('Independent t-test');
      expect(results).toContain('p = 0.03');
      expect(results).toContain('2.15');
    });

    it('should handle data without statistics', () => {
      const data: ClinicalDataset = {
        id: 'dataset-2',
        name: 'Simple Study',
        type: 'observational',
        metadata: {
          studyDesign: 'cohort study',
          population: 'elderly patients',
          sampleSize: 75,
          variables: ['age'],
        },
        data: [],
      };

      const results = mapper.mapToResults(data);

      expect(results).toContain('75');
      expect(results).toContain('elderly patients');
    });
  });

  describe('mapToMethods', () => {
    it('should map metadata to methods section', () => {
      const metadata: ClinicalDataset['metadata'] = {
        studyDesign: 'retrospective cohort study',
        population: 'diabetic patients',
        sampleSize: 200,
        variables: ['HbA1c', 'BMI', 'age'],
        timeframe: 'from January 2020 to December 2022',
      };

      const methods = mapper.mapToMethods(metadata);

      expect(methods).toContain('retrospective cohort study');
      expect(methods).toContain('diabetic patients');
      expect(methods).toContain('200');
      expect(methods).toContain('HbA1c, BMI, age');
      expect(methods).toContain('January 2020 to December 2022');
    });
  });

  describe('mapToAbstract', () => {
    it('should create abstract summary from data', () => {
      const data: ClinicalDataset = {
        id: 'dataset-3',
        name: 'Abstract Test',
        type: 'trial',
        metadata: {
          studyDesign: 'randomized controlled trial',
          population: 'postoperative patients',
          sampleSize: 120,
          variables: ['pain score'],
        },
        data: [],
        statistics: {
          summary: {},
          tests: [
            {
              name: 'Mann-Whitney U test',
              pValue: 0.001,
            },
          ],
        },
      };

      const abstract = mapper.mapToAbstract(data);

      expect(abstract).toContain('Background');
      expect(abstract).toContain('Methods');
      expect(abstract).toContain('Results');
      expect(abstract).toContain('postoperative patients');
      expect(abstract).toContain('n=120');
      expect(abstract).toContain('p = <0.001');
    });
  });

  describe('extractStatistics', () => {
    it('should extract statistical summary', () => {
      const data: ClinicalDataset = {
        id: 'dataset-4',
        name: 'Stats Test',
        type: 'observational',
        metadata: {
          studyDesign: 'cross-sectional study',
          population: 'healthy volunteers',
          sampleSize: 50,
          variables: ['weight'],
        },
        data: [],
        statistics: {
          summary: {
            mean: 70.5,
            sd: 12.3,
            median: 68.0,
            range: [45, 95],
          },
          tests: [
            {
              name: 'One-sample t-test',
              pValue: 0.05,
              statistic: 1.96,
              confidenceInterval: [65.2, 75.8],
            },
          ],
        },
      };

      const stats = mapper.extractStatistics(data);

      expect(stats).toBeDefined();
      expect(stats?.descriptive.n).toBe(50);
      expect(stats?.descriptive.mean).toBe(70.5);
      expect(stats?.descriptive.median).toBe(68.0);
      expect(stats?.inferential?.test).toBe('One-sample t-test');
      expect(stats?.inferential?.pValue).toBe(0.05);
    });

    it('should return null for data without statistics', () => {
      const data: ClinicalDataset = {
        id: 'dataset-5',
        name: 'No Stats',
        type: 'case_report',
        metadata: {
          studyDesign: 'case report',
          population: 'single patient',
          sampleSize: 1,
          variables: [],
        },
        data: [],
      };

      const stats = mapper.extractStatistics(data);

      expect(stats).toBeNull();
    });
  });
});
