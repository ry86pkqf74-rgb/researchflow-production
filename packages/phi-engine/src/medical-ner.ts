/**
 * Medical Named Entity Recognition
 * Phase A - Task 47: Medical NER in PHI Engine
 *
 * Enhances PHI detection with medical context using BioBERT.
 */

import axios, { AxiosError } from 'axios';

// Configuration
const MODEL_SERVER_URL = process.env.MODEL_SERVER_URL || 'http://model-server:8000';
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Medical entity extracted by BioBERT
 */
export interface MedicalEntity {
  text: string;
  label: string; // DISEASE, DRUG, SYMPTOM, GENE, PROTEIN, etc.
  start: number;
  end: number;
  confidence: number;
}

/**
 * Medical PHI pattern detected with context
 */
export interface MedicalPHIPattern {
  type: string;
  text: string;
  start: number;
  end: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context?: string;
}

/**
 * Result of medical entity extraction
 */
export interface MedicalNERResult {
  entities: MedicalEntity[];
  phiPatterns: MedicalPHIPattern[];
  success: boolean;
  error?: string;
}

/**
 * Extract medical entities using BioBERT model server
 *
 * @param text - Text to extract entities from
 * @returns Medical entities or empty array on failure
 */
export async function extractMedicalEntities(text: string): Promise<MedicalEntity[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    const response = await axios.post<{ entities: any[]; model: string }>(
      `${MODEL_SERVER_URL}/extract`,
      { text, aggregation_strategy: 'simple' },
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Map response to MedicalEntity format
    const entities: MedicalEntity[] = response.data.entities.map((ent) => ({
      text: ent.word,
      label: ent.entity_group,
      start: ent.start,
      end: ent.end,
      confidence: ent.score
    }));

    return entities;
  } catch (error) {
    // Log error but don't fail - medical NER is enhancement, not critical
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(
        `Medical NER extraction failed: ${axiosError.message}`,
        axiosError.code === 'ECONNREFUSED'
          ? `(Model server unavailable at ${MODEL_SERVER_URL})`
          : ''
      );
    } else {
      console.error('Medical NER extraction failed:', error);
    }

    return [];
  }
}

/**
 * Detect medical PHI with contextual awareness
 *
 * Identifies PHI patterns that appear near medical entities,
 * which increases confidence of PHI detection.
 *
 * @param text - Text to scan
 * @param medicalEntities - Previously extracted medical entities
 * @returns Array of medical PHI patterns
 */
export function detectMedicalPHI(
  text: string,
  medicalEntities: MedicalEntity[]
): MedicalPHIPattern[] {
  const phiPatterns: MedicalPHIPattern[] = [];

  // Medical Record Number (MRN) detection
  const mrnPattern = /\b(MRN|Medical\s+Record|Patient\s+ID|Chart\s+Number)\s*[:#]?\s*(\d{6,10})\b/gi;
  let match: RegExpExecArray | null;

  while ((match = mrnPattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    // Check if near a disease entity (within 100 characters)
    const nearDisease = medicalEntities.some(
      (ent) =>
        ent.label === 'DISEASE' &&
        Math.abs(ent.start - matchStart) < 100
    );

    phiPatterns.push({
      type: 'MEDICAL_RECORD_NUMBER',
      text: match[0],
      start: matchStart,
      end: matchEnd,
      severity: nearDisease ? 'CRITICAL' : 'HIGH',
      context: nearDisease ? 'Near disease mention' : undefined
    });
  }

  // Patient name near medical context
  const personEntities = medicalEntities.filter((ent) => ent.label === 'PERSON');

  for (const person of personEntities) {
    // Check if person name is near medical entities (likely patient)
    const nearMedical = medicalEntities.some(
      (ent) =>
        (ent.label === 'DISEASE' || ent.label === 'DRUG' || ent.label === 'SYMPTOM') &&
        Math.abs(ent.start - person.start) < 200
    );

    if (nearMedical) {
      phiPatterns.push({
        type: 'PATIENT_NAME',
        text: person.text,
        start: person.start,
        end: person.end,
        severity: 'CRITICAL',
        context: 'Person name in medical context'
      });
    }
  }

  // Prescription number near drug mention
  const rxPattern = /\b(Rx|Prescription|Script)\s*[:#]?\s*(\d{6,12})\b/gi;

  while ((match = rxPattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    const nearDrug = medicalEntities.some(
      (ent) =>
        ent.label === 'DRUG' &&
        Math.abs(ent.start - matchStart) < 100
    );

    if (nearDrug) {
      phiPatterns.push({
        type: 'PRESCRIPTION_NUMBER',
        text: match[0],
        start: matchStart,
        end: matchEnd,
        severity: 'HIGH',
        context: 'Near drug mention'
      });
    }
  }

  // Lab result identifiers near disease/symptom
  const labPattern = /\b(Lab\s+Result|Test\s+ID|Specimen|Sample)\s*[:#]?\s*([A-Z0-9-]{6,15})\b/gi;

  while ((match = labPattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    const nearMedical = medicalEntities.some(
      (ent) =>
        (ent.label === 'DISEASE' || ent.label === 'SYMPTOM') &&
        Math.abs(ent.start - matchStart) < 150
    );

    if (nearMedical) {
      phiPatterns.push({
        type: 'LAB_RESULT_ID',
        text: match[0],
        start: matchStart,
        end: matchEnd,
        severity: 'MEDIUM',
        context: 'Near medical finding'
      });
    }
  }

  return phiPatterns;
}

/**
 * Full medical NER pipeline with PHI detection
 *
 * @param text - Text to process
 * @returns Medical NER result with entities and PHI patterns
 */
export async function analyzeMedicalText(text: string): Promise<MedicalNERResult> {
  try {
    // Step 1: Extract medical entities
    const entities = await extractMedicalEntities(text);

    // Step 2: Detect medical PHI with context
    const phiPatterns = detectMedicalPHI(text, entities);

    return {
      entities,
      phiPatterns,
      success: true
    };
  } catch (error) {
    return {
      entities: [],
      phiPatterns: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Scrub medical PHI from text
 *
 * Replaces detected medical PHI patterns with redaction markers.
 *
 * @param text - Text to scrub
 * @param phiPatterns - PHI patterns to redact
 * @returns Scrubbed text
 */
export function scrubMedicalPHI(text: string, phiPatterns: MedicalPHIPattern[]): string {
  // Sort patterns by start position (descending) to avoid offset issues
  const sortedPatterns = [...phiPatterns].sort((a, b) => b.start - a.start);

  let scrubbedText = text;

  for (const pattern of sortedPatterns) {
    const replacement = `[${pattern.type}_REDACTED]`;
    scrubbedText =
      scrubbedText.substring(0, pattern.start) +
      replacement +
      scrubbedText.substring(pattern.end);
  }

  return scrubbedText;
}
