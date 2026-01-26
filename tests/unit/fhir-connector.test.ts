/**
 * FHIR Connector Tests
 * INF-16: SMART-on-FHIR Mock Connector
 * 
 * Tests for:
 * - STANDBY blocks connector usage
 * - SANDBOX mock works offline
 * - Recorded fixtures return expected data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockSMARTConnector,
  StandbyModeError,
  createMockConnector,
  createSandboxConnector,
} from '@apps/api-node/fhir/connectors/mock-connector';
import {
  ROSMode,
  RECORDED_FIXTURES,
  createMockPatientFixture,
  createMockObservationFixtures,
} from '@apps/api-node/fhir/connectors/types';

describe('SMART-on-FHIR Mock Connector', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => {
      throw new Error('Network call detected - mock connector must not make network calls');
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  describe('STANDBY mode blocking', () => {
    it('should throw StandbyModeError for getPatient in STANDBY mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'STANDBY' });

      await expect(connector.getPatient('R001')).rejects.toThrow(StandbyModeError);
      await expect(connector.getPatient('R001')).rejects.toThrow(/STANDBY mode/);
    });

    it('should throw StandbyModeError for getObservations in STANDBY mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'STANDBY' });

      await expect(connector.getObservations('R001')).rejects.toThrow(StandbyModeError);
    });

    it('should throw StandbyModeError for postObservation in STANDBY mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'STANDBY' });
      const mockObservation = {
        resourceType: 'Observation' as const,
        status: 'final' as const,
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
      };

      await expect(connector.postObservation(mockObservation)).rejects.toThrow(StandbyModeError);
    });

    it('should throw StandbyModeError for validateConnectivity in STANDBY mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'STANDBY' });

      await expect(connector.validateConnectivity()).rejects.toThrow(StandbyModeError);
    });

    it('should include helpful message in StandbyModeError', async () => {
      const connector = new MockSMARTConnector({ mode: 'STANDBY' });

      try {
        await connector.getPatient('R001');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StandbyModeError);
        expect((error as Error).message).toContain('fail-closed');
        expect((error as Error).message).toContain('ROS_MODE=SANDBOX');
      }
    });

    it('should default to STANDBY when ROS_MODE is not set', async () => {
      delete process.env.ROS_MODE;
      const connector = createMockConnector();

      await expect(connector.getPatient('R001')).rejects.toThrow(StandbyModeError);
    });
  });

  describe('SANDBOX mode operation', () => {
    it('should work in SANDBOX mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'SANDBOX' });

      const patient = await connector.getPatient('R001');

      expect(patient.resourceType).toBe('Patient');
      expect(patient.id).toBe('R001');
    });

    it('should return observations in SANDBOX mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'SANDBOX' });

      const observations = await connector.getObservations('R001');

      expect(Array.isArray(observations)).toBe(true);
      expect(observations.length).toBeGreaterThan(0);
      expect(observations[0].resourceType).toBe('Observation');
    });

    it('should allow posting observations in SANDBOX mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'SANDBOX' });
      const observation = {
        resourceType: 'Observation' as const,
        status: 'final' as const,
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
      };

      const result = await connector.postObservation(observation);

      expect(result.success).toBe(true);
      expect(result.message).toContain('mock');
      expect(result.resourceId).toBeDefined();
    });

    it('should validate connectivity in SANDBOX mode', async () => {
      const connector = new MockSMARTConnector({ mode: 'SANDBOX' });

      const isConnected = await connector.validateConnectivity();

      expect(isConnected).toBe(true);
    });

    it('should work with createSandboxConnector factory', async () => {
      const connector = createSandboxConnector();

      const patient = await connector.getPatient('R001');

      expect(patient.resourceType).toBe('Patient');
    });
  });

  describe('Recorded fixtures', () => {
    it('should return recorded patient fixture for known patient ID', async () => {
      const connector = createSandboxConnector();

      const patient = await connector.getPatient('R001');

      expect(patient.id).toBe('R001');
      expect(patient.identifier?.[0].system).toBe('https://research-os.example.org/patients');
      expect(patient.identifier?.[0].value).toBe('R001');
    });

    it('should return recorded observation fixtures for known patient ID', async () => {
      const connector = createSandboxConnector();

      const observations = await connector.getObservations('R001');

      expect(observations.length).toBe(2);
      expect(observations[0].code.coding?.[0].code).toBe('promis_fatigue');
      expect(observations[1].code.coding?.[0].code).toBe('steps_daily');
    });

    it('should generate fixture for unknown patient ID', async () => {
      const connector = createSandboxConnector();

      const patient = await connector.getPatient('UNKNOWN-PATIENT');

      expect(patient.resourceType).toBe('Patient');
      expect(patient.id).toBe('UNKNOWN-PATIENT');
    });

    it('should filter observations by code', async () => {
      const connector = createSandboxConnector();

      const observations = await connector.getObservations('R001', { code: 'promis_fatigue' });

      expect(observations.length).toBe(1);
      expect(observations[0].code.coding?.[0].code).toBe('promis_fatigue');
    });

    it('should filter observations by category', async () => {
      const connector = createSandboxConnector();

      const observations = await connector.getObservations('R001', { category: 'survey' });

      expect(observations.length).toBe(1);
      expect(observations[0].category?.[0].coding?.[0].code).toBe('survey');
    });

    it('should return empty array when no observations match filter', async () => {
      const connector = createSandboxConnector();

      const observations = await connector.getObservations('R001', { code: 'nonexistent' });

      expect(observations.length).toBe(0);
    });

    it('should have pre-recorded fixtures for R001, R002, R003', () => {
      expect(RECORDED_FIXTURES.patients.has('R001')).toBe(true);
      expect(RECORDED_FIXTURES.patients.has('R002')).toBe(true);
      expect(RECORDED_FIXTURES.patients.has('R003')).toBe(true);

      expect(RECORDED_FIXTURES.observations.has('R001')).toBe(true);
      expect(RECORDED_FIXTURES.observations.has('R002')).toBe(true);
      expect(RECORDED_FIXTURES.observations.has('R003')).toBe(true);
    });
  });

  describe('Fixture creation functions', () => {
    it('should create mock patient fixture with correct structure', () => {
      const fixture = createMockPatientFixture('TEST-001');

      expect(fixture.id).toBe('TEST-001');
      expect(fixture.timestamp).toBeDefined();
      expect(fixture.data.resourceType).toBe('Patient');
      expect(fixture.data.id).toBe('TEST-001');
      expect(fixture.data.name?.[0].use).toBe('anonymous');
    });

    it('should create mock observation fixtures with correct structure', () => {
      const fixture = createMockObservationFixtures('TEST-001');

      expect(fixture.id).toBe('TEST-001');
      expect(fixture.timestamp).toBeDefined();
      expect(Array.isArray(fixture.data)).toBe(true);
      expect(fixture.data.length).toBe(2);
      expect(fixture.data[0].subject.identifier?.value).toBe('TEST-001');
    });
  });

  describe('Connector properties', () => {
    it('should have name property set to mock', () => {
      const connector = createSandboxConnector();

      expect(connector.name).toBe('mock');
    });

    it('should have mode property matching configuration', () => {
      const sandboxConnector = new MockSMARTConnector({ mode: 'SANDBOX' });
      const standbyConnector = new MockSMARTConnector({ mode: 'STANDBY' });

      expect(sandboxConnector.mode).toBe('SANDBOX');
      expect(standbyConnector.mode).toBe('STANDBY');
    });
  });

  describe('No network calls verification', () => {
    it('should not make any network calls during operations', async () => {
      const connector = createSandboxConnector();

      await connector.getPatient('R001');
      await connector.getObservations('R001');
      await connector.postObservation({
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [{ code: 'test' }] },
        subject: { identifier: { value: 'R001' } },
      });
      await connector.validateConnectivity();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Environment variable handling', () => {
    it('should read SANDBOX from ROS_MODE environment variable', () => {
      process.env.ROS_MODE = 'SANDBOX';
      const connector = createMockConnector();

      expect(connector.mode).toBe('SANDBOX');
    });

    it('should read ONLINE from ROS_MODE environment variable', () => {
      process.env.ROS_MODE = 'ONLINE';
      const connector = createMockConnector();

      expect(connector.mode).toBe('ONLINE');
    });

    it('should handle case-insensitive ROS_MODE', () => {
      process.env.ROS_MODE = 'sandbox';
      const connector = createMockConnector();

      expect(connector.mode).toBe('SANDBOX');
    });

    it('should default to STANDBY for unknown ROS_MODE values', () => {
      process.env.ROS_MODE = 'UNKNOWN';
      const connector = createMockConnector();

      expect(connector.mode).toBe('STANDBY');
    });
  });
});
