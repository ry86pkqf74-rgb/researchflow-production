/**
 * FHIR R4 Type Definitions
 * INF-15: FHIR Transformation Library
 * 
 * Pure TypeScript interfaces for FHIR R4 resources.
 * Based on FHIR_OBSERVATION_MAPPING.md specification.
 * 
 * @see https://hl7.org/fhir/R4/observation.html
 */

export interface FHIRCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRIdentifier {
  system?: string;
  value: string;
}

export interface FHIRReference {
  reference?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRQuantity {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRAnnotation {
  text: string;
  time?: string;
}

/**
 * FHIR R4 Observation resource interface
 * 
 * Represents a single observation (PROM, vital, symptom, etc.)
 * Follows conservative mapping for research contexts.
 */
export interface FHIRObservation {
  resourceType: 'Observation';
  id?: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  effectiveDateTime?: string;
  valueQuantity?: FHIRQuantity;
  valueString?: string;
  note?: FHIRAnnotation[];
  method?: FHIRCodeableConcept;
  device?: FHIRReference;
  encounter?: FHIRReference;
}

/**
 * Minimal FHIR R4 Patient resource interface
 * 
 * Only includes fields necessary for research data exchange.
 * Uses de-identified research IDs only.
 */
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier?: FHIRIdentifier[];
  name?: Array<{
    use?: 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
    text?: string;
    family?: string;
    given?: string[];
  }>;
}

export interface FHIRBundleEntry {
  fullUrl?: string;
  resource: FHIRObservation | FHIRPatient;
}

/**
 * FHIR R4 Bundle resource interface
 * 
 * Contains collection of FHIR resources for batch operations.
 */
export interface FHIRBundle {
  resourceType: 'Bundle';
  id?: string;
  type: 'collection' | 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset';
  timestamp?: string;
  total?: number;
  entry?: FHIRBundleEntry[];
}

/**
 * Operation Outcome for FHIR operations
 */
export interface FHIROperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics?: string;
  }>;
}

/**
 * Result of a transformation operation
 */
export interface TransformResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Result of FHIR resource validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Signal types for patient-generated data
 * Based on FHIR_OBSERVATION_MAPPING.md
 */
export type SignalType = 'PROM' | 'symptom' | 'wearable' | 'adherence' | 'other';

/**
 * Collection modes for signal data
 */
export type CollectionMode = 'self_report' | 'passive_sensing' | 'clinician_entered';

/**
 * Analysis result input for transformation
 * Represents data from the canonical signals table
 */
export interface AnalysisResult {
  researchId: string;
  signalTime: string;
  signalType: SignalType;
  signalName: string;
  signalValueNum?: number;
  signalValueText?: string;
  unit?: string;
  sourceSystem?: string;
  collectionMode?: CollectionMode;
  qualityFlag?: string;
  notes?: string;
  encounterId?: string;
  episodeId?: string;
}

/**
 * FHIR category code mapping for signal types
 */
export const SIGNAL_TYPE_TO_CATEGORY: Record<SignalType, { code: string; display: string }> = {
  PROM: { code: 'survey', display: 'Survey' },
  symptom: { code: 'vital-signs', display: 'Vital Signs' },
  wearable: { code: 'vital-signs', display: 'Vital Signs' },
  adherence: { code: 'therapy', display: 'Therapy' },
  other: { code: 'exam', display: 'Exam' },
};

/**
 * Collection mode to FHIR method mapping
 */
export const COLLECTION_MODE_TO_METHOD: Record<CollectionMode, { code: string; display: string }> = {
  self_report: { code: 'self-reported', display: 'Self-Reported' },
  passive_sensing: { code: 'device-automated', display: 'Device Automated' },
  clinician_entered: { code: 'clinician-entered', display: 'Clinician Entered' },
};

/**
 * FHIR code systems used in transformations
 */
export const FHIR_SYSTEMS = {
  OBSERVATION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/observation-category',
  UCUM: 'http://unitsofmeasure.org',
  ROS_SIGNALS: 'https://research-os.example.org/signals',
  ROS_PATIENTS: 'https://research-os.example.org/patients',
  ROS_EPISODES: 'https://research-os.example.org/episodes',
  ROS_DEVICES: 'https://research-os.example.org/devices',
  ROS_COLLECTION_METHODS: 'https://research-os.example.org/collection-methods',
} as const;
