/**
 * FHIR Transformation Tests
 * INF-15: FHIR Transformation Library
 * 
 * Tests for:
 * - Observation transformation with synthetic data
 * - Bundle creation
 * - Validation of produced JSON structure
 * - Verification that no network calls are made
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  transformToFHIRObservation,
  transformToFHIRBundle,
  validateFHIRResource,
  batchTransformToFHIRObservations,
  transformResultsToBundle,
} from '@apps/api-node/fhir/transforms';
import {
  AnalysisResult,
  FHIRObservation,
  FHIR_SYSTEMS,
} from '@apps/api-node/fhir/types';

describe('FHIR Transformation Library', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => {
      throw new Error('Network call detected - transformations must be pure functions');
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('transformToFHIRObservation', () => {
    it('should transform a PROM analysis result to FHIR Observation', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalTime: '2024-01-15T14:30:00Z',
        signalType: 'PROM',
        signalName: 'promis_fatigue',
        signalValueNum: 17.0,
        unit: '/20',
        sourceSystem: 'mobile_app',
        collectionMode: 'self_report',
        episodeId: 'EP001',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const obs = result.data!;
      expect(obs.resourceType).toBe('Observation');
      expect(obs.status).toBe('final');
      expect(obs.subject.identifier?.value).toBe('R001');
      expect(obs.effectiveDateTime).toBe('2024-01-15T14:30:00Z');
      expect(obs.valueQuantity?.value).toBe(17.0);
      expect(obs.valueQuantity?.unit).toBe('/20');
    });

    it('should transform a symptom with text value', () => {
      const input: AnalysisResult = {
        researchId: 'R002',
        signalTime: '2024-01-18T09:15:00Z',
        signalType: 'symptom',
        signalName: 'neck_tightness',
        signalValueText: 'moderate',
        collectionMode: 'self_report',
        episodeId: 'EP003',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      const obs = result.data!;
      expect(obs.valueString).toBe('moderate');
      expect(obs.valueQuantity).toBeUndefined();
      expect(obs.category?.[0].coding?.[0].code).toBe('vital-signs');
    });

    it('should transform wearable data with device reference', () => {
      const input: AnalysisResult = {
        researchId: 'R003',
        signalTime: '2024-01-20T23:59:00Z',
        signalType: 'wearable',
        signalName: 'steps_daily',
        signalValueNum: 8432.0,
        unit: 'steps',
        sourceSystem: 'fitbit',
        collectionMode: 'passive_sensing',
        episodeId: 'EP004',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      const obs = result.data!;
      expect(obs.device?.display).toBe('Fitbit');
      expect(obs.device?.identifier?.value).toBe('fitbit');
      expect(obs.method?.coding?.[0].code).toBe('device-automated');
    });

    it('should set status to entered-in-error for invalid quality flag', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalType: 'PROM',
        signalName: 'pain_score',
        signalValueNum: 5.0,
        qualityFlag: 'invalid',
        signalTime: '2024-01-15T10:00:00Z',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('entered-in-error');
    });

    it('should fail validation when researchId is missing', () => {
      const input = {
        signalType: 'PROM',
        signalName: 'pain_score',
        signalValueNum: 5.0,
        signalTime: '2024-01-15T10:00:00Z',
      } as AnalysisResult;

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('researchId is required');
    });

    it('should fail validation when no value is provided', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalType: 'PROM',
        signalName: 'pain_score',
        signalTime: '2024-01-15T10:00:00Z',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Either signalValueNum or signalValueText must be provided');
    });

    it('should use correct FHIR systems for coding', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalType: 'PROM',
        signalName: 'anxiety_score',
        signalValueNum: 10.0,
        signalTime: '2024-01-15T10:00:00Z',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      const obs = result.data!;
      
      expect(obs.category?.[0].coding?.[0].system).toBe(FHIR_SYSTEMS.OBSERVATION_CATEGORY);
      expect(obs.code.coding?.[0].system).toBe(FHIR_SYSTEMS.ROS_SIGNALS);
      expect(obs.subject.identifier?.system).toBe(FHIR_SYSTEMS.ROS_PATIENTS);
    });

    it('should include notes when provided', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalType: 'symptom',
        signalName: 'headache',
        signalValueText: 'severe',
        signalTime: '2024-01-15T10:00:00Z',
        notes: 'Patient reported sudden onset',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      expect(result.data?.note?.[0].text).toBe('Patient reported sudden onset');
    });

    it('should include encounter reference when episodeId provided', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalType: 'PROM',
        signalName: 'fatigue',
        signalValueNum: 7.0,
        signalTime: '2024-01-15T10:00:00Z',
        episodeId: 'EP-001',
      };

      const result = transformToFHIRObservation(input);

      expect(result.success).toBe(true);
      expect(result.data?.encounter?.identifier?.value).toBe('EP-001');
      expect(result.data?.encounter?.identifier?.system).toBe(FHIR_SYSTEMS.ROS_EPISODES);
    });
  });

  describe('transformToFHIRBundle', () => {
    it('should create a bundle from observations array', () => {
      const observations: FHIRObservation[] = [
        {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: FHIR_SYSTEMS.ROS_SIGNALS, code: 'test1' }] },
          subject: { identifier: { value: 'R001' } },
        },
        {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: FHIR_SYSTEMS.ROS_SIGNALS, code: 'test2' }] },
          subject: { identifier: { value: 'R002' } },
        },
      ];

      const result = transformToFHIRBundle(observations);

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Bundle');
      expect(result.data?.type).toBe('collection');
      expect(result.data?.total).toBe(2);
      expect(result.data?.entry?.length).toBe(2);
    });

    it('should create empty bundle for empty array', () => {
      const result = transformToFHIRBundle([]);

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(0);
      expect(result.data?.entry?.length).toBe(0);
    });

    it('should include timestamp in bundle', () => {
      const result = transformToFHIRBundle([]);

      expect(result.success).toBe(true);
      expect(result.data?.timestamp).toBeDefined();
      expect(new Date(result.data!.timestamp!).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should assign fullUrl to each entry', () => {
      const observations: FHIRObservation[] = [
        {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ code: 'test' }] },
          subject: { identifier: { value: 'R001' } },
        },
      ];

      const result = transformToFHIRBundle(observations);

      expect(result.data?.entry?.[0].fullUrl).toBe('urn:uuid:observation-0');
    });

    it('should fail if input is not an array', () => {
      const result = transformToFHIRBundle(null as unknown as FHIRObservation[]);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('observations must be an array');
    });
  });

  describe('validateFHIRResource', () => {
    it('should validate a well-formed Observation', () => {
      const observation: FHIRObservation = {
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
        valueQuantity: { value: 10 },
      };

      const result = validateFHIRResource(observation);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject null resource', () => {
      const result = validateFHIRResource(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Resource must be a non-null object');
    });

    it('should reject resource without resourceType', () => {
      const result = validateFHIRResource({ status: 'final' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resourceType is required and must be a string');
    });

    it('should reject Observation without status', () => {
      const result = validateFHIRResource({
        resourceType: 'Observation',
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Observation.status is required');
    });

    it('should reject Observation with invalid status', () => {
      const result = validateFHIRResource({
        resourceType: 'Observation',
        status: 'invalid-status',
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid Observation.status: invalid-status');
    });

    it('should reject Observation without code', () => {
      const result = validateFHIRResource({
        resourceType: 'Observation',
        status: 'final',
        subject: { identifier: { value: 'R001' } },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Observation.code is required');
    });

    it('should reject Observation without subject', () => {
      const result = validateFHIRResource({
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ code: 'test' }] },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Observation.subject is required');
    });

    it('should reject Observation with both valueQuantity and valueString', () => {
      const result = validateFHIRResource({
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
        valueQuantity: { value: 10 },
        valueString: 'test',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Observation cannot have both valueQuantity and valueString');
    });

    it('should warn if Observation has no value', () => {
      const result = validateFHIRResource({
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Observation should have either valueQuantity or valueString');
    });

    it('should validate a well-formed Bundle', () => {
      const result = validateFHIRResource({
        resourceType: 'Bundle',
        type: 'collection',
        entry: [],
      });

      expect(result.valid).toBe(true);
    });

    it('should reject Bundle with invalid type', () => {
      const result = validateFHIRResource({
        resourceType: 'Bundle',
        type: 'invalid-type',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid Bundle.type: invalid-type');
    });

    it('should warn for unknown resource types', () => {
      const result = validateFHIRResource({
        resourceType: 'UnknownResource',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown resource type: UnknownResource');
    });
  });

  describe('batchTransformToFHIRObservations', () => {
    it('should transform multiple analysis results', () => {
      const inputs: AnalysisResult[] = [
        { researchId: 'R001', signalType: 'PROM', signalName: 'pain', signalValueNum: 5, signalTime: '2024-01-15T10:00:00Z' },
        { researchId: 'R002', signalType: 'symptom', signalName: 'fever', signalValueText: 'yes', signalTime: '2024-01-15T11:00:00Z' },
      ];

      const results = batchTransformToFHIRObservations(inputs);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle partial failures in batch', () => {
      const inputs: AnalysisResult[] = [
        { researchId: 'R001', signalType: 'PROM', signalName: 'pain', signalValueNum: 5, signalTime: '2024-01-15T10:00:00Z' },
        { researchId: '', signalType: 'PROM', signalName: 'pain', signalValueNum: 5, signalTime: '2024-01-15T10:00:00Z' },
      ];

      const results = batchTransformToFHIRObservations(inputs);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('transformResultsToBundle', () => {
    it('should transform analysis results directly to bundle', () => {
      const inputs: AnalysisResult[] = [
        { researchId: 'R001', signalType: 'PROM', signalName: 'pain', signalValueNum: 5, signalTime: '2024-01-15T10:00:00Z' },
        { researchId: 'R002', signalType: 'symptom', signalName: 'fever', signalValueText: 'yes', signalTime: '2024-01-15T11:00:00Z' },
      ];

      const result = transformResultsToBundle(inputs);

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Bundle');
      expect(result.data?.total).toBe(2);
    });

    it('should fail if any transformation fails', () => {
      const inputs: AnalysisResult[] = [
        { researchId: 'R001', signalType: 'PROM', signalName: 'pain', signalValueNum: 5, signalTime: '2024-01-15T10:00:00Z' },
        { researchId: '', signalType: 'PROM', signalName: 'pain', signalValueNum: 5, signalTime: '2024-01-15T10:00:00Z' },
      ];

      const result = transformResultsToBundle(inputs);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('1 of 2 transformations failed');
    });
  });

  describe('No network calls verification', () => {
    it('should not make any network calls during transformation', () => {
      const input: AnalysisResult = {
        researchId: 'R001',
        signalType: 'PROM',
        signalName: 'test',
        signalValueNum: 5,
        signalTime: '2024-01-15T10:00:00Z',
      };

      transformToFHIRObservation(input);
      transformToFHIRBundle([]);
      validateFHIRResource({ resourceType: 'Observation', status: 'final', code: {}, subject: {} });

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
