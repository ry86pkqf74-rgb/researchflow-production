/**
 * Mock SMART-on-FHIR Connector
 * INF-16: SMART-on-FHIR Mock Connector
 * 
 * Mock connector implementation for offline testing.
 * Features:
 * - Deterministic responses (seeded by patient_id)
 * - Works offline (no network calls)
 * - Uses recorded fixtures
 * - Safe in SANDBOX mode
 * - Blocked in STANDBY mode (fail-closed)
 */

import { FHIRObservation, FHIRPatient } from '../types';
import {
  SMARTConnector,
  ROSMode,
  ConnectionConfig,
  ConnectorOperationOutcome,
  RECORDED_FIXTURES,
  createMockPatientFixture,
  createMockObservationFixtures,
} from './types';

/**
 * Error thrown when connector is used in STANDBY mode
 */
export class StandbyModeError extends Error {
  constructor(operation: string) {
    super(
      `FHIR connector blocked in STANDBY mode (fail-closed). ` +
      `Operation '${operation}' not permitted. ` +
      `Set ROS_MODE=SANDBOX to enable mock connector.`
    );
    this.name = 'StandbyModeError';
  }
}

/**
 * Gets the current ROS mode from environment
 */
export function getROSMode(): ROSMode {
  const mode = process.env.ROS_MODE?.toUpperCase();
  if (mode === 'ONLINE') return 'ONLINE';
  if (mode === 'SANDBOX') return 'SANDBOX';
  return 'STANDBY';
}

/**
 * Mock SMART-on-FHIR connector for testing
 * 
 * **Governance:**
 * - STANDBY mode: All operations blocked with StandbyModeError
 * - SANDBOX mode: All operations allowed (uses fixtures)
 * - ONLINE mode: Not applicable for mock connector
 * 
 * **Safety:**
 * - No network calls
 * - Deterministic responses
 * - Synthetic data only (R### identifiers)
 * - No PHI processing
 */
export class MockSMARTConnector implements SMARTConnector {
  readonly name = 'mock';
  readonly mode: ROSMode;

  constructor(config?: Partial<ConnectionConfig>) {
    this.mode = config?.mode ?? getROSMode();
  }

  /**
   * Checks if operation is blocked in STANDBY mode
   */
  private checkStandbyBlock(operation: string): void {
    if (this.mode === 'STANDBY') {
      throw new StandbyModeError(operation);
    }
  }

  /**
   * Fetch synthetic patient resource
   * 
   * @param patientId - Patient identifier (e.g., "R001")
   * @returns FHIRPatient with synthetic data
   * @throws StandbyModeError if called in STANDBY mode
   */
  async getPatient(patientId: string): Promise<FHIRPatient> {
    this.checkStandbyBlock('getPatient');

    const fixture = RECORDED_FIXTURES.patients.get(patientId);
    if (fixture) {
      return fixture.data;
    }

    return createMockPatientFixture(patientId).data;
  }

  /**
   * Fetch synthetic observation resources
   * 
   * @param patientId - Patient identifier
   * @param options - Optional filters for code and category
   * @returns Array of FHIRObservation resources
   * @throws StandbyModeError if called in STANDBY mode
   */
  async getObservations(
    patientId: string,
    options?: { code?: string; category?: string }
  ): Promise<FHIRObservation[]> {
    this.checkStandbyBlock('getObservations');

    const fixture = RECORDED_FIXTURES.observations.get(patientId);
    let observations = fixture?.data ?? createMockObservationFixtures(patientId).data;

    if (options?.code) {
      observations = observations.filter(obs => 
        obs.code.coding?.some(c => c.code === options.code)
      );
    }

    if (options?.category) {
      observations = observations.filter(obs =>
        obs.category?.some(cat => 
          cat.coding?.some(c => c.code === options.category)
        )
      );
    }

    return observations;
  }

  /**
   * Post synthetic observation (mock - no actual network POST)
   * 
   * @param observation - Observation resource to post
   * @returns ConnectorOperationOutcome indicating success
   * @throws StandbyModeError if called in STANDBY mode
   */
  async postObservation(observation: FHIRObservation): Promise<ConnectorOperationOutcome> {
    this.checkStandbyBlock('postObservation');

    const resourceId = observation.id ?? `mock-obs-${Date.now()}`;

    return {
      success: true,
      message: 'Observation posted successfully (mock)',
      resourceId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate mock connectivity (always succeeds in SANDBOX)
   * 
   * @returns True if in SANDBOX mode
   * @throws StandbyModeError if called in STANDBY mode
   */
  async validateConnectivity(): Promise<boolean> {
    this.checkStandbyBlock('validateConnectivity');

    return true;
  }
}

/**
 * Factory function to create a mock connector with default settings
 */
export function createMockConnector(config?: Partial<ConnectionConfig>): MockSMARTConnector {
  return new MockSMARTConnector(config);
}

/**
 * Factory function to create a mock connector in SANDBOX mode
 */
export function createSandboxConnector(): MockSMARTConnector {
  return new MockSMARTConnector({ mode: 'SANDBOX' });
}
