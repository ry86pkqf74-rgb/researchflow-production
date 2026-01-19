/**
 * PHI Guard - Node.js shim for PHI protection
 *
 * Provides assertion functions that block operations containing PHI.
 * Returns location-only reports (never the actual PHI text).
 */

import { scan, hasPhi, type PhiFinding } from '@repo/phi-engine';

export interface PhiLocation {
  startOffset: number;
  endOffset: number;
  phiType: string;
  section?: string;
}

export interface PhiBlockedResult {
  hasPhi: boolean;
  locations: PhiLocation[];
}

export class PhiBlockedError extends Error {
  public readonly code = 'PHI_BLOCKED';
  public readonly locations: PhiLocation[];
  public readonly payloadLabel: string;

  constructor(payloadLabel: string, locations: PhiLocation[]) {
    super(`PHI blocked in ${payloadLabel}`);
    this.name = 'PhiBlockedError';
    this.locations = locations;
    this.payloadLabel = payloadLabel;
  }
}

/**
 * Scan text for PHI and return location-only results
 *
 * @param text - Text to scan
 * @returns PHI scan result with locations only (no PHI text)
 */
export function scanTextForPhi(text: string): PhiBlockedResult {
  const findings = scan(text);

  if (findings.length === 0) {
    return { hasPhi: false, locations: [] };
  }

  const locations: PhiLocation[] = findings.map((f: PhiFinding) => ({
    startOffset: f.startIndex,
    endOffset: f.endIndex,
    phiType: f.type,
  }));

  return { hasPhi: true, locations };
}

/**
 * Assert that text contains no PHI, throw if it does
 *
 * @param payloadLabel - Label for error reporting (e.g., "context:INTRODUCTION")
 * @param text - Text to scan
 * @throws {PhiBlockedError} If PHI is detected
 */
export function assertNoPhiOrThrow(payloadLabel: string, text: string): void {
  const result = scanTextForPhi(text);

  if (result.hasPhi) {
    throw new PhiBlockedError(payloadLabel, result.locations);
  }
}

/**
 * Assert multiple text fields contain no PHI
 *
 * @param fields - Object with field names as keys and text as values
 * @throws {PhiBlockedError} If PHI is detected in any field
 */
export function assertNoPhiInFieldsOrThrow(fields: Record<string, string>): void {
  for (const [label, text] of Object.entries(fields)) {
    if (text && typeof text === 'string') {
      assertNoPhiOrThrow(label, text);
    }
  }
}

/**
 * Check if text contains PHI (non-throwing version)
 *
 * @param text - Text to check
 * @returns True if PHI detected
 */
export function containsPhi(text: string): boolean {
  return hasPhi(text);
}

/**
 * Scan object recursively for PHI in string values
 *
 * @param obj - Object to scan
 * @param label - Base label for error reporting
 * @returns Array of locations if PHI found
 */
export function scanObjectForPhi(
  obj: unknown,
  label: string
): { hasPhi: boolean; locations: Array<PhiLocation & { path: string }> } {
  const locations: Array<PhiLocation & { path: string }> = [];

  function walk(value: unknown, path: string): void {
    if (typeof value === 'string') {
      const result = scanTextForPhi(value);
      if (result.hasPhi) {
        locations.push(
          ...result.locations.map((loc) => ({ ...loc, path }))
        );
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) =>
        walk(val, path ? `${path}.${key}` : key)
      );
    }
  }

  walk(obj, label);

  return { hasPhi: locations.length > 0, locations };
}

/**
 * Assert object contains no PHI in any string values
 *
 * @param label - Label for error reporting
 * @param obj - Object to scan
 * @throws {PhiBlockedError} If PHI is detected
 */
export function assertNoPhiInObjectOrThrow(label: string, obj: unknown): void {
  const result = scanObjectForPhi(obj, label);

  if (result.hasPhi) {
    throw new PhiBlockedError(
      label,
      result.locations.map(({ path, ...loc }) => ({ ...loc, section: path }))
    );
  }
}

export default {
  scanTextForPhi,
  assertNoPhiOrThrow,
  assertNoPhiInFieldsOrThrow,
  containsPhi,
  scanObjectForPhi,
  assertNoPhiInObjectOrThrow,
  PhiBlockedError,
};
