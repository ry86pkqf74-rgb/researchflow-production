/**
 * Surgery-Specific Data Tags
 * Phase 1.1: Extends DataTaggerService for surgical data recognition
 * 
 * Recognizes: ASA Class, Wound Classification, Clavien-Dindo, EBL, OR Time, etc.
 */

export enum SurgicalDataTag {
  PROCEDURE = 'PROCEDURE',
  ASA_CLASS = 'ASA_CLASS',
  WOUND_CLASS = 'WOUND_CLASS',
  CLAVIEN_DINDO = 'CLAVIEN_DINDO',
  EBL = 'EBL',
  OR_TIME = 'OR_TIME',
  LOS = 'LOS',
  READMISSION = 'READMISSION',
  REOPERATION = 'REOPERATION',
  COMPLICATION = 'COMPLICATION',
  MORTALITY = 'MORTALITY'
}

export interface TagRule {
  pattern: RegExp;
  tag: SurgicalDataTag;
  confidence: number;
  category: string;
}

/**
 * Surgical data tagging rules with confidence scores
 */
export const SURGICAL_TAG_RULES: TagRule[] = [
  // Procedure identification
  { pattern: /procedure|surgery|operation|intervention/i, tag: SurgicalDataTag.PROCEDURE, confidence: 0.9, category: 'procedure' },
  { pattern: /cpt[_\s]?code|icd[_\s]?10?[_\s]?pcs/i, tag: SurgicalDataTag.PROCEDURE, confidence: 0.95, category: 'procedure' },
  
  // ASA Classification
  { pattern: /asa[_\s]?(class|score|grade|physical[_\s]?status)/i, tag: SurgicalDataTag.ASA_CLASS, confidence: 0.95, category: 'risk' },
  { pattern: /physical[_\s]?status[_\s]?class/i, tag: SurgicalDataTag.ASA_CLASS, confidence: 0.9, category: 'risk' },
  
  // Wound Classification
  { pattern: /wound[_\s]?(class|classification|type)/i, tag: SurgicalDataTag.WOUND_CLASS, confidence: 0.95, category: 'risk' },
  { pattern: /(clean|contaminated|dirty|infected)[_\s]?wound/i, tag: SurgicalDataTag.WOUND_CLASS, confidence: 0.85, category: 'risk' },
  
  // Clavien-Dindo Complications
  { pattern: /clavien[_\s\-]?(dindo)?|dindo[_\s\-]?clavien/i, tag: SurgicalDataTag.CLAVIEN_DINDO, confidence: 0.95, category: 'outcome' },
  { pattern: /complication[_\s]?(grade|class|score)/i, tag: SurgicalDataTag.CLAVIEN_DINDO, confidence: 0.85, category: 'outcome' },
  
  // Estimated Blood Loss
  { pattern: /ebl|blood[_\s]?loss|estimated[_\s]?blood/i, tag: SurgicalDataTag.EBL, confidence: 0.9, category: 'intraop' },
  { pattern: /transfusion|prbc|blood[_\s]?products/i, tag: SurgicalDataTag.EBL, confidence: 0.8, category: 'intraop' },
  
  // OR Time / Operative Duration
  { pattern: /or[_\s]?time|operative[_\s]?time|surgery[_\s]?duration/i, tag: SurgicalDataTag.OR_TIME, confidence: 0.95, category: 'intraop' },
  { pattern: /incision[_\s]?to[_\s]?close|skin[_\s]?to[_\s]?skin/i, tag: SurgicalDataTag.OR_TIME, confidence: 0.9, category: 'intraop' },
  { pattern: /anesthesia[_\s]?(time|duration)/i, tag: SurgicalDataTag.OR_TIME, confidence: 0.85, category: 'intraop' },
  
  // Length of Stay
  { pattern: /los|length[_\s]?of[_\s]?stay|hospital[_\s]?(days|stay)/i, tag: SurgicalDataTag.LOS, confidence: 0.95, category: 'outcome' },
  { pattern: /discharge[_\s]?day|post[_\s]?op[_\s]?day/i, tag: SurgicalDataTag.LOS, confidence: 0.85, category: 'outcome' },
  
  // Readmission
  { pattern: /readmission|readmit|return[_\s]?to[_\s]?hospital/i, tag: SurgicalDataTag.READMISSION, confidence: 0.95, category: 'outcome' },
  { pattern: /30[_\s]?day[_\s]?return|unplanned[_\s]?admission/i, tag: SurgicalDataTag.READMISSION, confidence: 0.9, category: 'outcome' },
  
  // Reoperation
  { pattern: /reoperation|reop|return[_\s]?to[_\s]?or/i, tag: SurgicalDataTag.REOPERATION, confidence: 0.95, category: 'outcome' },
  { pattern: /unplanned[_\s]?(return|surgery|operation)/i, tag: SurgicalDataTag.REOPERATION, confidence: 0.9, category: 'outcome' },
  { pattern: /second[_\s]?(look|surgery|operation)/i, tag: SurgicalDataTag.REOPERATION, confidence: 0.85, category: 'outcome' },
  
  // Complications
  { pattern: /complication|adverse[_\s]?event|morbidity/i, tag: SurgicalDataTag.COMPLICATION, confidence: 0.9, category: 'outcome' },
  { pattern: /ssi|surgical[_\s]?site[_\s]?infection/i, tag: SurgicalDataTag.COMPLICATION, confidence: 0.95, category: 'outcome' },
  { pattern: /vte|dvt|pe|pulmonary[_\s]?embolism/i, tag: SurgicalDataTag.COMPLICATION, confidence: 0.95, category: 'outcome' },
  { pattern: /leak|dehiscence|anastomotic/i, tag: SurgicalDataTag.COMPLICATION, confidence: 0.9, category: 'outcome' },
  
  // Mortality
  { pattern: /mortality|death|expired|deceased/i, tag: SurgicalDataTag.MORTALITY, confidence: 0.95, category: 'outcome' },
  { pattern: /30[_\s]?day[_\s]?mortality|in[_\s]?hospital[_\s]?death/i, tag: SurgicalDataTag.MORTALITY, confidence: 0.98, category: 'outcome' }
];

/**
 * PHI Risk Column Patterns (HIPAA 18 Identifiers)
 */
export const PHI_RISK_PATTERNS: RegExp[] = [
  /^(patient[_\s]?)?name$/i,
  /first[_\s]?name|last[_\s]?name|full[_\s]?name/i,
  /mrn|medical[_\s]?record[_\s]?(number|num|#)?/i,
  /phone|telephone|mobile|cell/i,
  /email|e-mail/i,
  /dob|date[_\s]?of[_\s]?birth|birth[_\s]?date|birthdate/i,
  /ssn|social[_\s]?security/i,
  /address|street|city|state|zip|postal/i,
  /account[_\s]?(number|num|#)/i,
  /insurance|policy[_\s]?(number|num|#)/i,
  /ip[_\s]?address/i,
  /device[_\s]?(id|serial)/i,
  /biometric|fingerprint|face[_\s]?id/i,
  /photo|image|picture/i,
  /url|web[_\s]?address/i
];

/**
 * Tag a column name for surgical relevance
 */
export function tagSurgicalColumn(columnName: string): {
  tags: SurgicalDataTag[];
  confidence: number;
  phiRisk: boolean;
} {
  const matchedTags: { tag: SurgicalDataTag; confidence: number }[] = [];
  
  for (const rule of SURGICAL_TAG_RULES) {
    if (rule.pattern.test(columnName)) {
      matchedTags.push({ tag: rule.tag, confidence: rule.confidence });
    }
  }
  
  // Deduplicate and sort by confidence
  const uniqueTags = Array.from(new Set(matchedTags.map(t => t.tag)));
  const maxConfidence = matchedTags.length > 0 
    ? Math.max(...matchedTags.map(t => t.confidence))
    : 0;
  
  // Check PHI risk
  const phiRisk = PHI_RISK_PATTERNS.some(pattern => pattern.test(columnName));
  
  return {
    tags: uniqueTags,
    confidence: maxConfidence,
    phiRisk
  };
}

/**
 * Tag all columns in a dataset
 */
export function tagDatasetColumns(columns: string[]): {
  column: string;
  tags: SurgicalDataTag[];
  confidence: number;
  phiRisk: boolean;
}[] {
  return columns.map(column => ({
    column,
    ...tagSurgicalColumn(column)
  }));
}

/**
 * Get PHI-risk columns from a dataset
 */
export function getPhiRiskColumns(columns: string[]): string[] {
  return columns.filter(col => 
    PHI_RISK_PATTERNS.some(pattern => pattern.test(col))
  );
}
