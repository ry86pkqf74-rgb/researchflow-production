/**
 * FHIR Transformation Functions
 * INF-15: FHIR Transformation Library
 * 
 * Pure functions for transforming analysis results to FHIR R4 resources.
 * No network calls - all operations are local transformations.
 * 
 * Based on FHIR_OBSERVATION_MAPPING.md specification.
 */

import {
  FHIRObservation,
  FHIRBundle,
  FHIRCodeableConcept,
  FHIRReference,
  TransformResult,
  ValidationResult,
  AnalysisResult,
  SIGNAL_TYPE_TO_CATEGORY,
  COLLECTION_MODE_TO_METHOD,
  FHIR_SYSTEMS,
} from './types';

/**
 * Transforms an AnalysisResult to a FHIR R4 Observation resource.
 * 
 * Pure function - no network calls, no side effects.
 * 
 * @param data - Analysis result from the canonical signals table
 * @returns TransformResult containing the FHIR Observation or errors
 */
export function transformToFHIRObservation(data: AnalysisResult): TransformResult<FHIRObservation> {
  const errors: string[] = [];

  if (!data.researchId) {
    errors.push('researchId is required');
  }
  if (!data.signalName) {
    errors.push('signalName is required');
  }
  if (!data.signalType) {
    errors.push('signalType is required');
  }
  if (data.signalValueNum === undefined && !data.signalValueText) {
    errors.push('Either signalValueNum or signalValueText must be provided');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const status = determineStatus(data.qualityFlag);
  const category = buildCategory(data.signalType);
  const code = buildCode(data.signalName, data.signalType);
  const subject = buildSubject(data.researchId);

  const observation: FHIRObservation = {
    resourceType: 'Observation',
    status,
    category: [category],
    code,
    subject,
  };

  if (data.signalTime) {
    observation.effectiveDateTime = data.signalTime;
  }

  if (data.signalValueNum !== undefined) {
    observation.valueQuantity = {
      value: data.signalValueNum,
    };
    if (data.unit) {
      observation.valueQuantity.unit = data.unit;
      observation.valueQuantity.system = FHIR_SYSTEMS.UCUM;
      observation.valueQuantity.code = normalizeUnitCode(data.unit);
    }
  } else if (data.signalValueText) {
    observation.valueString = data.signalValueText;
  }

  if (data.collectionMode) {
    observation.method = buildMethod(data.collectionMode);
  }

  if (data.signalType === 'wearable' && data.sourceSystem) {
    observation.device = buildDevice(data.sourceSystem);
  }

  if (data.episodeId) {
    observation.encounter = buildEncounter(data.episodeId);
  }

  if (data.notes) {
    observation.note = [{
      text: data.notes,
      time: new Date().toISOString(),
    }];
  }

  return { success: true, data: observation };
}

/**
 * Transforms multiple observations into a FHIR Bundle.
 * 
 * Pure function - no network calls.
 * 
 * @param observations - Array of FHIR Observations
 * @returns TransformResult containing the FHIR Bundle
 */
export function transformToFHIRBundle(observations: FHIRObservation[]): TransformResult<FHIRBundle> {
  if (!Array.isArray(observations)) {
    return {
      success: false,
      errors: ['observations must be an array'],
    };
  }

  const bundle: FHIRBundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    total: observations.length,
    entry: observations.map((obs, index) => ({
      fullUrl: `urn:uuid:observation-${index}`,
      resource: obs,
    })),
  };

  return { success: true, data: bundle };
}

/**
 * Validates a FHIR resource structure.
 * 
 * Pure function - validates JSON structure only, no schema fetching.
 * 
 * @param resource - Unknown resource to validate
 * @returns ValidationResult with validity status and any issues
 */
export function validateFHIRResource(resource: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resource || typeof resource !== 'object') {
    return {
      valid: false,
      errors: ['Resource must be a non-null object'],
      warnings: [],
    };
  }

  const obj = resource as Record<string, unknown>;

  if (!obj.resourceType || typeof obj.resourceType !== 'string') {
    errors.push('resourceType is required and must be a string');
  }

  const resourceType = obj.resourceType;

  if (resourceType === 'Observation') {
    validateObservation(obj, errors, warnings);
  } else if (resourceType === 'Bundle') {
    validateBundle(obj, errors, warnings);
  } else if (resourceType === 'Patient') {
    validatePatient(obj, errors, warnings);
  } else {
    warnings.push(`Unknown resource type: ${resourceType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateObservation(obj: Record<string, unknown>, errors: string[], warnings: string[]): void {
  if (!obj.status || typeof obj.status !== 'string') {
    errors.push('Observation.status is required');
  } else {
    const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
    if (!validStatuses.includes(obj.status as string)) {
      errors.push(`Invalid Observation.status: ${obj.status}`);
    }
  }

  if (!obj.code || typeof obj.code !== 'object') {
    errors.push('Observation.code is required');
  }

  if (!obj.subject || typeof obj.subject !== 'object') {
    errors.push('Observation.subject is required');
  }

  if (obj.valueQuantity === undefined && obj.valueString === undefined) {
    warnings.push('Observation should have either valueQuantity or valueString');
  }

  if (obj.valueQuantity !== undefined && obj.valueString !== undefined) {
    errors.push('Observation cannot have both valueQuantity and valueString');
  }
}

function validateBundle(obj: Record<string, unknown>, errors: string[], warnings: string[]): void {
  if (!obj.type || typeof obj.type !== 'string') {
    errors.push('Bundle.type is required');
  } else {
    const validTypes = ['collection', 'document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset'];
    if (!validTypes.includes(obj.type as string)) {
      errors.push(`Invalid Bundle.type: ${obj.type}`);
    }
  }

  if (obj.entry !== undefined && !Array.isArray(obj.entry)) {
    errors.push('Bundle.entry must be an array');
  }

  if (Array.isArray(obj.entry)) {
    (obj.entry as Array<unknown>).forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        errors.push(`Bundle.entry[${index}] must be an object`);
      } else {
        const e = entry as Record<string, unknown>;
        if (!e.resource || typeof e.resource !== 'object') {
          warnings.push(`Bundle.entry[${index}].resource is missing`);
        }
      }
    });
  }
}

function validatePatient(obj: Record<string, unknown>, errors: string[], warnings: string[]): void {
  if (!obj.id || typeof obj.id !== 'string') {
    warnings.push('Patient.id is recommended');
  }
}

function determineStatus(qualityFlag?: string): FHIRObservation['status'] {
  if (qualityFlag === 'invalid' || qualityFlag === 'rejected') {
    return 'entered-in-error';
  }
  return 'final';
}

function buildCategory(signalType: string): FHIRCodeableConcept {
  const mapping = SIGNAL_TYPE_TO_CATEGORY[signalType as keyof typeof SIGNAL_TYPE_TO_CATEGORY] 
    || SIGNAL_TYPE_TO_CATEGORY.other;

  return {
    coding: [{
      system: FHIR_SYSTEMS.OBSERVATION_CATEGORY,
      code: mapping.code,
      display: mapping.display,
    }],
  };
}

function buildCode(signalName: string, signalType: string): FHIRCodeableConcept {
  const displayName = signalName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    coding: [{
      system: FHIR_SYSTEMS.ROS_SIGNALS,
      code: signalName,
      display: displayName,
    }],
    text: `${signalName} (${signalType})`,
  };
}

function buildSubject(researchId: string): FHIRReference {
  return {
    identifier: {
      system: FHIR_SYSTEMS.ROS_PATIENTS,
      value: researchId,
    },
    display: `Research Subject ${researchId}`,
  };
}

function buildMethod(collectionMode: string): FHIRCodeableConcept {
  const mapping = COLLECTION_MODE_TO_METHOD[collectionMode as keyof typeof COLLECTION_MODE_TO_METHOD];
  if (!mapping) {
    return {
      coding: [{
        system: FHIR_SYSTEMS.ROS_COLLECTION_METHODS,
        code: collectionMode,
        display: collectionMode,
      }],
    };
  }

  return {
    coding: [{
      system: FHIR_SYSTEMS.ROS_COLLECTION_METHODS,
      code: mapping.code,
      display: mapping.display,
    }],
  };
}

function buildDevice(sourceSystem: string): FHIRReference {
  return {
    display: sourceSystem.charAt(0).toUpperCase() + sourceSystem.slice(1),
    identifier: {
      system: FHIR_SYSTEMS.ROS_DEVICES,
      value: sourceSystem.toLowerCase(),
    },
  };
}

function buildEncounter(episodeId: string): FHIRReference {
  return {
    identifier: {
      system: FHIR_SYSTEMS.ROS_EPISODES,
      value: episodeId,
    },
    display: `Episode ${episodeId}`,
  };
}

function normalizeUnitCode(unit: string): string {
  if (unit === 'steps') return '{steps}';
  if (unit.startsWith('/')) return '{score}';
  return unit;
}

/**
 * Batch transform multiple analysis results to FHIR observations
 * 
 * @param results - Array of analysis results
 * @returns Array of transform results
 */
export function batchTransformToFHIRObservations(
  results: AnalysisResult[]
): TransformResult<FHIRObservation>[] {
  return results.map(transformToFHIRObservation);
}

/**
 * Transform analysis results directly to a bundle
 * 
 * @param results - Array of analysis results  
 * @returns TransformResult with FHIR Bundle or errors
 */
export function transformResultsToBundle(
  results: AnalysisResult[]
): TransformResult<FHIRBundle> {
  const transformResults = batchTransformToFHIRObservations(results);
  
  const failed = transformResults.filter(r => !r.success);
  if (failed.length > 0) {
    const allErrors = failed.flatMap(r => r.errors || []);
    return {
      success: false,
      errors: [`${failed.length} of ${results.length} transformations failed`, ...allErrors],
    };
  }

  const observations = transformResults
    .map(r => r.data)
    .filter((obs): obs is FHIRObservation => obs !== undefined);

  return transformToFHIRBundle(observations);
}
