/**
 * SMART-on-FHIR Connector Types
 * INF-16: SMART-on-FHIR Mock Connector
 * 
 * Defines interfaces for SMART-on-FHIR connector implementations.
 * Follows fail-closed governance model for STANDBY mode.
 */

import { FHIRObservation, FHIRPatient, FHIRBundle } from '../types';

/**
 * ROS operational mode
 * - STANDBY: All connector operations blocked (fail-closed)
 * - SANDBOX: Mock connector only (offline-safe)
 * - ONLINE: Real connector allowed (requires explicit opt-in)
 */
export type ROSMode = 'STANDBY' | 'SANDBOX' | 'ONLINE';

/**
 * SMART-on-FHIR connection configuration
 */
export interface ConnectionConfig {
  mode: ROSMode;
  baseUrl?: string;
  clientId?: string;
  scope?: string[];
  timeout?: number;
}

/**
 * Operation outcome for connector operations
 */
export interface ConnectorOperationOutcome {
  success: boolean;
  message: string;
  resourceId?: string;
  timestamp: string;
}

/**
 * SMART-on-FHIR connector interface
 * 
 * All implementations must:
 * - Check ROS_MODE for gating (STANDBY blocks, SANDBOX allows mock only)
 * - Return deterministic results in mock mode
 * - Require ONLINE mode for real EHR connectivity
 */
export interface SMARTConnector {
  readonly name: string;
  readonly mode: ROSMode;

  /**
   * Fetch patient by research ID
   * @throws Error if called in STANDBY mode
   */
  getPatient(patientId: string): Promise<FHIRPatient>;

  /**
   * Fetch observations for a patient
   * @throws Error if called in STANDBY mode
   */
  getObservations(
    patientId: string,
    options?: { code?: string; category?: string }
  ): Promise<FHIRObservation[]>;

  /**
   * Post new observation
   * @throws Error if called in STANDBY mode
   */
  postObservation(observation: FHIRObservation): Promise<ConnectorOperationOutcome>;

  /**
   * Validate connectivity
   * @throws Error if called in STANDBY mode
   */
  validateConnectivity(): Promise<boolean>;
}

/**
 * Recorded fixture for testing
 */
export interface RecordedFixture<T> {
  id: string;
  data: T;
  timestamp: string;
}

/**
 * Mock response fixtures for offline testing
 */
export interface MockResponseFixtures {
  patients: Map<string, RecordedFixture<FHIRPatient>>;
  observations: Map<string, RecordedFixture<FHIRObservation[]>>;
}

/**
 * Creates default mock patient fixture
 */
export function createMockPatientFixture(patientId: string): RecordedFixture<FHIRPatient> {
  return {
    id: patientId,
    timestamp: new Date().toISOString(),
    data: {
      resourceType: 'Patient',
      id: patientId,
      identifier: [{
        system: 'https://research-os.example.org/patients',
        value: patientId,
      }],
      name: [{
        use: 'anonymous',
        text: `Research Subject ${patientId}`,
      }],
    },
  };
}

/**
 * Creates default mock observation fixtures
 */
export function createMockObservationFixtures(patientId: string): RecordedFixture<FHIRObservation[]> {
  const observations: FHIRObservation[] = [
    {
      resourceType: 'Observation',
      id: `${patientId}-obs-001`,
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'survey',
          display: 'Survey',
        }],
      }],
      code: {
        coding: [{
          system: 'https://research-os.example.org/signals',
          code: 'promis_fatigue',
          display: 'PROMIS Fatigue Score',
        }],
        text: 'promis_fatigue (PROM)',
      },
      subject: {
        identifier: {
          system: 'https://research-os.example.org/patients',
          value: patientId,
        },
        display: `Research Subject ${patientId}`,
      },
      effectiveDateTime: '2024-01-15T14:30:00Z',
      valueQuantity: {
        value: 17.0,
        unit: '/20',
        system: 'http://unitsofmeasure.org',
        code: '{score}',
      },
    },
    {
      resourceType: 'Observation',
      id: `${patientId}-obs-002`,
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        }],
      }],
      code: {
        coding: [{
          system: 'https://research-os.example.org/signals',
          code: 'steps_daily',
          display: 'Daily Steps',
        }],
        text: 'steps_daily (wearable)',
      },
      subject: {
        identifier: {
          system: 'https://research-os.example.org/patients',
          value: patientId,
        },
        display: `Research Subject ${patientId}`,
      },
      effectiveDateTime: '2024-01-15T23:59:00Z',
      valueQuantity: {
        value: 8432.0,
        unit: 'steps',
        system: 'http://unitsofmeasure.org',
        code: '{steps}',
      },
    },
  ];

  return {
    id: patientId,
    timestamp: new Date().toISOString(),
    data: observations,
  };
}

/**
 * Pre-recorded fixture set for deterministic testing
 */
export const RECORDED_FIXTURES: MockResponseFixtures = {
  patients: new Map([
    ['R001', createMockPatientFixture('R001')],
    ['R002', createMockPatientFixture('R002')],
    ['R003', createMockPatientFixture('R003')],
  ]),
  observations: new Map([
    ['R001', createMockObservationFixtures('R001')],
    ['R002', createMockObservationFixtures('R002')],
    ['R003', createMockObservationFixtures('R003')],
  ]),
};
