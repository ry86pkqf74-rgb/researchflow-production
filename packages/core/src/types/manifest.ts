/**
 * Manifest Types - Tasks 172, 179, 186, 191
 *
 * Defines manifest structure including:
 * - Task 172: Snapshot in manifests
 * - Task 179: Quarantine flags
 * - Task 186: Provenance hash-chain fields
 * - Task 191: Uncertainty fields
 */

/**
 * Snapshot captures the state at manifest creation time (Task 172)
 */
export interface ManifestSnapshot {
  /** Git SHA at time of processing */
  gitSha?: string;
  /** Hash of the schema version used */
  schemaHash?: string;
  /** Hash of the job specification */
  jobSpecHash?: string;
  /** Timestamp of snapshot creation */
  createdAt: string;
  /** Input artifacts with integrity hashes */
  inputArtifacts: Array<{
    artifactId: string;
    sha256: string;
    sizeBytes: number;
    mimeType?: string;
    filename?: string;
  }>;
  /** Output artifacts produced */
  outputArtifacts?: Array<{
    artifactId: string;
    sha256: string;
    sizeBytes: number;
    mimeType?: string;
    filename?: string;
  }>;
  /** Environment information */
  environment?: {
    nodeVersion?: string;
    pythonVersion?: string;
    workerVersion?: string;
    orchestratorVersion?: string;
  };
}

/**
 * Quarantine status for security/compliance (Task 179)
 */
export interface ManifestQuarantine {
  /** Current quarantine status */
  status: 'none' | 'quarantined' | 'released';
  /** Reason codes for quarantine */
  reasonCodes?: string[];
  /** When quarantine was applied */
  createdAt?: string;
  /** Review state for quarantined items */
  reviewState?: 'pending' | 'approved' | 'rejected';
  /** Reviewer user ID */
  reviewedBy?: string;
  /** Review timestamp */
  reviewedAt?: string;
  /** Review notes */
  reviewNotes?: string;
  /** Auto-quarantine rule that triggered */
  triggeredRule?: string;
}

/**
 * Provenance hash-chain for tamper detection (Task 186)
 */
export interface ManifestProvenance {
  /** SHA256 hash of canonical JSON manifest */
  manifestHash: string;
  /** Previous manifest hash in chain */
  prevManifestHash?: string;
  /** Signature if cryptographically signed */
  signature?: string;
  /** Signing key ID */
  signingKeyId?: string;
  /** Chain position */
  chainIndex?: number;
  /** Timestamp of hash creation */
  hashedAt: string;
}

/**
 * Uncertainty measurement for a field (Task 191)
 */
export interface FieldUncertainty {
  /** Uncertainty score (0 = certain, 1 = completely uncertain) */
  score: number;
  /** Method used to calculate uncertainty */
  method: 'rules_confidence' | 'self_consistency' | 'ensemble' | 'model_logprob' | 'human_review' | 'unknown';
  /** Confidence interval if applicable */
  confidenceInterval?: {
    lower: number;
    upper: number;
    level: number; // e.g., 0.95 for 95% CI
  };
  /** Number of samples used (for ensemble/consistency methods) */
  sampleCount?: number;
  /** Model(s) used for uncertainty estimation */
  models?: string[];
  /** Additional method-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Redaction summary
 */
export interface RedactionSummary {
  /** Whether redaction was applied */
  applied: boolean;
  /** Summary of redactions by type */
  summary?: Record<string, number>;
  /** Redaction method used */
  method?: string;
  /** Fields that were redacted */
  redactedFields?: string[];
}

/**
 * Carbon/environmental metrics (Task 189)
 */
export interface CarbonMetrics {
  /** Total runtime in seconds */
  runtimeSeconds: number;
  /** Estimated CO2 equivalent in grams */
  co2eGrams?: number;
  /** Calculation method */
  method: 'measured' | 'estimated' | 'unknown';
  /** Energy consumption in watt-hours */
  energyWh?: number;
  /** Cloud region for carbon intensity */
  region?: string;
  /** Carbon intensity factor used (gCO2/kWh) */
  carbonIntensity?: number;
}

/**
 * Security section of manifest
 */
export interface ManifestSecurity {
  /** Quarantine status */
  quarantine: ManifestQuarantine;
  /** Redaction information */
  redaction?: RedactionSummary;
  /** PII detection results */
  piiDetection?: {
    detected: boolean;
    types?: string[];
    count?: number;
    riskScore?: number;
  };
  /** Access control */
  accessControl?: {
    classification?: 'public' | 'internal' | 'confidential' | 'restricted';
    allowedRoles?: string[];
    deniedUsers?: string[];
  };
}

/**
 * Quality metrics
 */
export interface ManifestQuality {
  /** Overall quality score (0..1) */
  overallScore?: number;
  /** Extraction completeness (0..1) */
  completeness?: number;
  /** Duplication rate (0..1) */
  duplicationRate?: number;
  /** Validation pass rate (0..1) */
  validationPassRate?: number;
  /** Number of warnings */
  warningCount?: number;
  /** Number of errors */
  errorCount?: number;
}

/**
 * Full Manifest type
 */
export interface Manifest {
  /** Unique manifest identifier */
  id: string;
  /** Associated job ID */
  jobId: string;
  /** Workflow ID if part of workflow */
  workflowId?: string;
  /** Manifest version for schema evolution */
  version: string;
  /** Snapshot at creation time (Task 172) */
  snapshot: ManifestSnapshot;
  /** Security information including quarantine (Task 179) */
  security: ManifestSecurity;
  /** Provenance hash-chain (Task 186) */
  provenance?: ManifestProvenance;
  /** Field-level uncertainty scores (Task 191) */
  uncertainty?: Record<string, FieldUncertainty>;
  /** Carbon/environmental metrics (Task 189) */
  carbon?: CarbonMetrics;
  /** Quality metrics */
  quality?: ManifestQuality;
  /** Processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'quarantined';
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    stack?: string;
    retryable?: boolean;
  };
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Finalized timestamp */
  finalizedAt?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Calculate SHA256 hash of canonical manifest JSON
 */
export function calculateManifestHash(manifest: Omit<Manifest, 'provenance'>): string {
  // Note: Actual implementation would use crypto.subtle or node:crypto
  // This is a placeholder that should be implemented with proper hashing
  const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
  // Return placeholder - real implementation uses SHA256
  return `sha256:${Buffer.from(canonical).toString('base64').slice(0, 64)}`;
}

/**
 * Check if manifest should be quarantined based on thresholds
 */
export function shouldQuarantine(
  manifest: Manifest,
  thresholds: {
    maxPiiRiskScore?: number;
    minFieldConfidence?: number;
    maxDuplicationRate?: number;
  }
): { quarantine: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check PII risk
  if (
    thresholds.maxPiiRiskScore !== undefined &&
    manifest.security.piiDetection?.riskScore !== undefined &&
    manifest.security.piiDetection.riskScore > thresholds.maxPiiRiskScore
  ) {
    reasons.push(`PII_RISK_EXCEEDED:${manifest.security.piiDetection.riskScore}`);
  }

  // Check field confidence (using uncertainty)
  if (thresholds.minFieldConfidence !== undefined && manifest.uncertainty) {
    for (const [field, uncertainty] of Object.entries(manifest.uncertainty)) {
      const confidence = 1 - uncertainty.score;
      if (confidence < thresholds.minFieldConfidence) {
        reasons.push(`LOW_CONFIDENCE:${field}:${confidence}`);
      }
    }
  }

  // Check duplication rate
  if (
    thresholds.maxDuplicationRate !== undefined &&
    manifest.quality?.duplicationRate !== undefined &&
    manifest.quality.duplicationRate > thresholds.maxDuplicationRate
  ) {
    reasons.push(`DUPLICATION_EXCEEDED:${manifest.quality.duplicationRate}`);
  }

  return {
    quarantine: reasons.length > 0,
    reasons,
  };
}

export default Manifest;
