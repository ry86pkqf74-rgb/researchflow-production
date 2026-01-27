/**
 * Guidelines Engine Seed Data
 *
 * Pre-configured system cards, rule specs, and evidence statements
 * for common clinical scoring systems.
 *
 * Systems included:
 * - CHA2DS2-VASc (stroke risk in atrial fibrillation)
 * - Child-Pugh (liver disease severity)
 * - MELD (end-stage liver disease)
 * - Wells Criteria (DVT probability)
 * - CURB-65 (pneumonia severity)
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Seed Data Definitions
// =============================================================================

interface SeedSystemCard {
  name: string;
  type: 'score' | 'staging' | 'grading' | 'classification' | 'criteria';
  specialty: string;
  conditionConcepts: Array<{ system: string; code: string; term: string }>;
  intendedUse: string;
  population: string;
  careSetting: string;
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    validValues?: string[] | { min?: number; max?: number };
  }>;
  outputs: Array<{
    name: string;
    type: string;
    range?: string;
    labels?: string[];
    description: string;
  }>;
  interpretation: Array<{
    range: string;
    meaning: string;
    clinicalAction?: string;
  }>;
  limitations: string[];
  evidenceSummary: {
    derivationStudy?: string;
    derivationPopulation?: string;
    derivationSize?: number;
    validationStudies?: number;
    knownLimitations?: string[];
  };
  version: string;
}

interface SeedRuleSpec {
  name: string;
  description: string;
  ruleType: 'threshold' | 'lookup_table' | 'formula';
  ruleDefinition: Record<string, unknown>;
  testCases: Array<{
    inputs: Record<string, unknown>;
    expectedOutput: Record<string, unknown>;
    description: string;
  }>;
}

interface SeedEvidence {
  statementText: string;
  strength: 'strong' | 'moderate' | 'weak' | 'expert_consensus';
  quality: 'high' | 'moderate' | 'low';
  evidenceType: 'rct' | 'cohort' | 'case_control' | 'case_series' | 'expert_opinion';
  citationRef: string;
}

// =============================================================================
// CHA2DS2-VASc Score
// =============================================================================

const CHA2DS2VASc: SeedSystemCard = {
  name: 'CHA2DS2-VASc Score',
  type: 'score',
  specialty: 'Cardiology',
  conditionConcepts: [
    { system: 'ICD10', code: 'I48', term: 'Atrial fibrillation and flutter' },
    { system: 'SNOMED', code: '49436004', term: 'Atrial fibrillation' },
    { system: 'MeSH', code: 'D001281', term: 'Atrial Fibrillation' },
  ],
  intendedUse: 'prognosis',
  population: 'Adults with non-valvular atrial fibrillation',
  careSetting: 'Outpatient, Inpatient, Emergency',
  inputs: [
    { name: 'age', type: 'numeric', required: true, description: 'Patient age in years', validValues: { min: 0, max: 120 } },
    { name: 'sex', type: 'categorical', required: true, description: 'Biological sex', validValues: ['male', 'female'] },
    { name: 'chf_history', type: 'boolean', required: true, description: 'History of congestive heart failure' },
    { name: 'hypertension', type: 'boolean', required: true, description: 'History of hypertension' },
    { name: 'stroke_tia_history', type: 'boolean', required: true, description: 'Prior stroke, TIA, or thromboembolism' },
    { name: 'vascular_disease', type: 'boolean', required: true, description: 'Vascular disease (prior MI, PAD, aortic plaque)' },
    { name: 'diabetes', type: 'boolean', required: true, description: 'Diabetes mellitus' },
  ],
  outputs: [
    { name: 'score', type: 'score', range: '0-9', description: 'CHA2DS2-VASc total score' },
    { name: 'annual_stroke_risk', type: 'risk', description: 'Estimated annual stroke risk percentage' },
    { name: 'risk_category', type: 'category', labels: ['Low', 'Moderate', 'High'], description: 'Risk stratification' },
  ],
  interpretation: [
    { range: '0', meaning: 'Low risk', clinicalAction: 'No anticoagulation or aspirin (males); Consider no therapy (females)' },
    { range: '1', meaning: 'Low-moderate risk', clinicalAction: 'Oral anticoagulation should be considered' },
    { range: '2-3', meaning: 'Moderate risk', clinicalAction: 'Oral anticoagulation recommended' },
    { range: '4-5', meaning: 'Moderate-high risk', clinicalAction: 'Oral anticoagulation recommended' },
    { range: '6-9', meaning: 'High risk', clinicalAction: 'Oral anticoagulation strongly recommended' },
  ],
  limitations: [
    'Not validated for valvular AF',
    'Does not account for renal function',
    'Does not include bleeding risk assessment',
    'Should be used with HAS-BLED for complete assessment',
  ],
  evidenceSummary: {
    derivationStudy: 'Lip GY, et al. Chest 2010',
    derivationPopulation: 'Euro Heart Survey cohort',
    derivationSize: 1084,
    validationStudies: 50,
    knownLimitations: ['Modest C-statistic (~0.6)', 'Better at identifying truly low-risk patients'],
  },
  version: '2010',
};

const CHA2DS2VAScRuleSpec: SeedRuleSpec = {
  name: 'CHA2DS2-VASc Calculator',
  description: 'Threshold-based scoring for stroke risk in atrial fibrillation',
  ruleType: 'threshold',
  ruleDefinition: {
    criteria: [
      { variable: 'chf_history', condition: 'boolean', points: 1, name: 'CHF/LV dysfunction' },
      { variable: 'hypertension', condition: 'boolean', points: 1, name: 'Hypertension' },
      { variable: 'age', condition: 'gte', threshold: 75, points: 2, name: 'Age ≥75' },
      { variable: 'age', condition: 'gte', threshold: 65, points: 1, name: 'Age 65-74', required: false },
      { variable: 'diabetes', condition: 'boolean', points: 1, name: 'Diabetes' },
      { variable: 'stroke_tia_history', condition: 'boolean', points: 2, name: 'Stroke/TIA/TE' },
      { variable: 'vascular_disease', condition: 'boolean', points: 1, name: 'Vascular disease' },
      { variable: 'sex', condition: 'equals', value: 'female', points: 1, name: 'Female sex' },
    ],
    categories: [
      { min: 0, max: 0, label: 'Low' },
      { min: 1, max: 1, label: 'Low-Moderate' },
      { min: 2, max: 3, label: 'Moderate' },
      { min: 4, max: 5, label: 'Moderate-High' },
      { min: 6, max: 9, label: 'High' },
    ],
    interpretations: {
      '0': 'Annual stroke risk ~0%',
      '1': 'Annual stroke risk ~1.3%',
      '2': 'Annual stroke risk ~2.2%',
      '3': 'Annual stroke risk ~3.2%',
      '4': 'Annual stroke risk ~4.0%',
      '5': 'Annual stroke risk ~6.7%',
      '6': 'Annual stroke risk ~9.8%',
      '7': 'Annual stroke risk ~9.6%',
      '8': 'Annual stroke risk ~12.5%',
      '9': 'Annual stroke risk ~15.2%',
    },
  },
  testCases: [
    {
      inputs: { age: 55, sex: 'male', chf_history: false, hypertension: false, stroke_tia_history: false, vascular_disease: false, diabetes: false },
      expectedOutput: { score: 0, risk_category: 'Low' },
      description: 'Healthy 55-year-old male - score 0',
    },
    {
      inputs: { age: 72, sex: 'female', chf_history: true, hypertension: true, stroke_tia_history: false, vascular_disease: false, diabetes: true },
      expectedOutput: { score: 5, risk_category: 'Moderate-High' },
      description: '72-year-old female with CHF, HTN, DM - score 5',
    },
    {
      inputs: { age: 80, sex: 'male', chf_history: false, hypertension: true, stroke_tia_history: true, vascular_disease: true, diabetes: false },
      expectedOutput: { score: 6, risk_category: 'High' },
      description: '80-year-old male with prior stroke, HTN, vascular disease - score 6',
    },
  ],
};

const CHA2DS2VAScEvidence: SeedEvidence[] = [
  {
    statementText: 'CHA2DS2-VASc score of 0 in males and 1 in females identifies truly low-risk patients who may not require anticoagulation.',
    strength: 'strong',
    quality: 'high',
    evidenceType: 'cohort',
    citationRef: 'Lip GY, et al. Refining clinical risk stratification for predicting stroke and thromboembolism in atrial fibrillation using a novel risk factor-based approach. Chest 2010;137:263-72.',
  },
  {
    statementText: 'Oral anticoagulation therapy is recommended in patients with CHA2DS2-VASc ≥2 (Class I, Level A).',
    strength: 'strong',
    quality: 'high',
    evidenceType: 'rct',
    citationRef: '2020 ESC Guidelines for the diagnosis and management of atrial fibrillation. Eur Heart J 2021;42:373-498.',
  },
];

// =============================================================================
// Child-Pugh Score
// =============================================================================

const ChildPugh: SeedSystemCard = {
  name: 'Child-Pugh Score',
  type: 'score',
  specialty: 'Hepatology',
  conditionConcepts: [
    { system: 'ICD10', code: 'K74', term: 'Fibrosis and cirrhosis of liver' },
    { system: 'SNOMED', code: '19943007', term: 'Cirrhosis of liver' },
    { system: 'MeSH', code: 'D008103', term: 'Liver Cirrhosis' },
  ],
  intendedUse: 'prognosis',
  population: 'Adults with chronic liver disease/cirrhosis',
  careSetting: 'Inpatient, Outpatient',
  inputs: [
    { name: 'bilirubin', type: 'numeric', required: true, description: 'Total bilirubin (mg/dL)', validValues: { min: 0 } },
    { name: 'albumin', type: 'numeric', required: true, description: 'Serum albumin (g/dL)', validValues: { min: 0 } },
    { name: 'inr', type: 'numeric', required: true, description: 'INR (International Normalized Ratio)', validValues: { min: 0 } },
    { name: 'ascites', type: 'categorical', required: true, description: 'Ascites status', validValues: ['none', 'mild', 'moderate_severe'] },
    { name: 'encephalopathy', type: 'categorical', required: true, description: 'Hepatic encephalopathy grade', validValues: ['none', 'grade_1_2', 'grade_3_4'] },
  ],
  outputs: [
    { name: 'score', type: 'score', range: '5-15', description: 'Child-Pugh total score' },
    { name: 'class', type: 'class', labels: ['A', 'B', 'C'], description: 'Child-Pugh classification' },
    { name: 'one_year_survival', type: 'risk', description: 'Estimated 1-year survival' },
    { name: 'two_year_survival', type: 'risk', description: 'Estimated 2-year survival' },
  ],
  interpretation: [
    { range: '5-6', meaning: 'Class A - Well-compensated disease', clinicalAction: '1-year survival ~100%, 2-year survival ~85%' },
    { range: '7-9', meaning: 'Class B - Significant functional compromise', clinicalAction: '1-year survival ~80%, 2-year survival ~60%' },
    { range: '10-15', meaning: 'Class C - Decompensated disease', clinicalAction: '1-year survival ~45%, 2-year survival ~35%' },
  ],
  limitations: [
    'Does not account for renal function (addressed by MELD)',
    'Subjective assessment of ascites and encephalopathy',
    'Originally developed for surgical risk, not transplant allocation',
    'Does not distinguish between causes of cirrhosis',
  ],
  evidenceSummary: {
    derivationStudy: 'Child CG, Turcotte JG. Surgery 1964; Modified by Pugh RN, et al. Br J Surg 1973',
    derivationPopulation: 'Patients undergoing portosystemic shunt surgery',
    validationStudies: 100,
    knownLimitations: ['Inter-observer variability in ascites/encephalopathy assessment'],
  },
  version: '1973 (Pugh modification)',
};

const ChildPughRuleSpec: SeedRuleSpec = {
  name: 'Child-Pugh Calculator',
  description: 'Threshold-based scoring for liver disease severity',
  ruleType: 'threshold',
  ruleDefinition: {
    criteria: [
      // Bilirubin points
      { variable: 'bilirubin', condition: 'lt', threshold: 2, points: 1, name: 'Bilirubin <2' },
      { variable: 'bilirubin', condition: 'gte', threshold: 2, points: 2, name: 'Bilirubin 2-3', required: false },
      { variable: 'bilirubin', condition: 'gt', threshold: 3, points: 3, name: 'Bilirubin >3', required: false },
      // Albumin points
      { variable: 'albumin', condition: 'gt', threshold: 3.5, points: 1, name: 'Albumin >3.5' },
      { variable: 'albumin', condition: 'gte', threshold: 2.8, points: 2, name: 'Albumin 2.8-3.5', required: false },
      { variable: 'albumin', condition: 'lt', threshold: 2.8, points: 3, name: 'Albumin <2.8', required: false },
      // INR points
      { variable: 'inr', condition: 'lt', threshold: 1.7, points: 1, name: 'INR <1.7' },
      { variable: 'inr', condition: 'gte', threshold: 1.7, points: 2, name: 'INR 1.7-2.3', required: false },
      { variable: 'inr', condition: 'gt', threshold: 2.3, points: 3, name: 'INR >2.3', required: false },
      // Ascites points
      { variable: 'ascites', condition: 'equals', value: 'none', points: 1, name: 'No ascites' },
      { variable: 'ascites', condition: 'equals', value: 'mild', points: 2, name: 'Mild ascites' },
      { variable: 'ascites', condition: 'equals', value: 'moderate_severe', points: 3, name: 'Moderate-severe ascites' },
      // Encephalopathy points
      { variable: 'encephalopathy', condition: 'equals', value: 'none', points: 1, name: 'No encephalopathy' },
      { variable: 'encephalopathy', condition: 'equals', value: 'grade_1_2', points: 2, name: 'Grade I-II encephalopathy' },
      { variable: 'encephalopathy', condition: 'equals', value: 'grade_3_4', points: 3, name: 'Grade III-IV encephalopathy' },
    ],
    categories: [
      { min: 5, max: 6, label: 'A' },
      { min: 7, max: 9, label: 'B' },
      { min: 10, max: 15, label: 'C' },
    ],
    interpretations: {
      'A': '1-year survival ~100%, 2-year survival ~85%',
      'B': '1-year survival ~80%, 2-year survival ~60%',
      'C': '1-year survival ~45%, 2-year survival ~35%',
    },
  },
  testCases: [
    {
      inputs: { bilirubin: 1.5, albumin: 4.0, inr: 1.2, ascites: 'none', encephalopathy: 'none' },
      expectedOutput: { score: 5, class: 'A' },
      description: 'Well-compensated cirrhosis - Class A',
    },
    {
      inputs: { bilirubin: 2.5, albumin: 3.0, inr: 1.8, ascites: 'mild', encephalopathy: 'grade_1_2' },
      expectedOutput: { score: 9, class: 'B' },
      description: 'Moderate cirrhosis - Class B',
    },
    {
      inputs: { bilirubin: 5.0, albumin: 2.2, inr: 2.8, ascites: 'moderate_severe', encephalopathy: 'grade_3_4' },
      expectedOutput: { score: 15, class: 'C' },
      description: 'Decompensated cirrhosis - Class C',
    },
  ],
};

// =============================================================================
// MELD Score
// =============================================================================

const MELD: SeedSystemCard = {
  name: 'MELD Score (Model for End-Stage Liver Disease)',
  type: 'score',
  specialty: 'Hepatology',
  conditionConcepts: [
    { system: 'ICD10', code: 'K72', term: 'Hepatic failure, not elsewhere classified' },
    { system: 'SNOMED', code: '235886007', term: 'End stage liver disease' },
  ],
  intendedUse: 'prognosis',
  population: 'Adults with end-stage liver disease awaiting transplant',
  careSetting: 'Inpatient, Transplant center',
  inputs: [
    { name: 'bilirubin', type: 'numeric', required: true, description: 'Total bilirubin (mg/dL)', validValues: { min: 0 } },
    { name: 'inr', type: 'numeric', required: true, description: 'INR', validValues: { min: 0 } },
    { name: 'creatinine', type: 'numeric', required: true, description: 'Serum creatinine (mg/dL)', validValues: { min: 0 } },
    { name: 'dialysis', type: 'boolean', required: true, description: 'Dialysis at least twice in past week' },
    { name: 'sodium', type: 'numeric', required: false, description: 'Serum sodium (mEq/L) for MELD-Na', validValues: { min: 120, max: 137 } },
  ],
  outputs: [
    { name: 'meld_score', type: 'score', range: '6-40', description: 'MELD score' },
    { name: 'meld_na_score', type: 'score', range: '6-40', description: 'MELD-Na score (if sodium provided)' },
    { name: 'three_month_mortality', type: 'risk', description: 'Estimated 3-month mortality without transplant' },
  ],
  interpretation: [
    { range: '6-9', meaning: 'Low severity', clinicalAction: '3-month mortality ~2%' },
    { range: '10-19', meaning: 'Moderate severity', clinicalAction: '3-month mortality ~6%' },
    { range: '20-29', meaning: 'High severity', clinicalAction: '3-month mortality ~20%' },
    { range: '30-39', meaning: 'Very high severity', clinicalAction: '3-month mortality ~50%' },
    { range: '≥40', meaning: 'Critical', clinicalAction: '3-month mortality ~70%' },
  ],
  limitations: [
    'Does not account for hepatocellular carcinoma (exception points needed)',
    'Lab variability between institutions',
    'Creatinine affected by muscle mass',
    'Does not capture all factors affecting waitlist mortality',
  ],
  evidenceSummary: {
    derivationStudy: 'Kamath PS, et al. Hepatology 2001',
    derivationPopulation: 'TIPS procedure patients, later validated for transplant',
    validationStudies: 200,
    knownLimitations: ['C-statistic ~0.83 for 3-month mortality prediction'],
  },
  version: '2016 (MELD-Na)',
};

const MELDRuleSpec: SeedRuleSpec = {
  name: 'MELD Calculator',
  description: 'Formula-based calculation for liver disease severity and transplant prioritization',
  ruleType: 'formula',
  ruleDefinition: {
    formula: 'Math.round(10 * (0.957 * Math.log(Math.max(creatinine, 1)) + 0.378 * Math.log(Math.max(bilirubin, 1)) + 1.120 * Math.log(Math.max(inr, 1)) + 0.643))',
    variables: [
      { name: 'bilirubin', required: true, default: 1 },
      { name: 'inr', required: true, default: 1 },
      { name: 'creatinine', required: true, default: 1 },
    ],
    categories: [
      { min: 6, max: 9, label: 'Low' },
      { min: 10, max: 19, label: 'Moderate' },
      { min: 20, max: 29, label: 'High' },
      { min: 30, max: 39, label: 'Very High' },
      { min: 40, max: 100, label: 'Critical' },
    ],
  },
  testCases: [
    {
      inputs: { bilirubin: 1.0, inr: 1.0, creatinine: 1.0, dialysis: false },
      expectedOutput: { meld_score: 6 },
      description: 'Normal labs - MELD 6',
    },
    {
      inputs: { bilirubin: 3.0, inr: 1.5, creatinine: 2.0, dialysis: false },
      expectedOutput: { meld_score: 18 },
      description: 'Moderate disease - MELD ~18',
    },
    {
      inputs: { bilirubin: 10.0, inr: 2.5, creatinine: 4.0, dialysis: true },
      expectedOutput: { meld_score: 35 },
      description: 'Severe disease with dialysis - MELD ~35',
    },
  ],
};

// =============================================================================
// Wells Criteria for DVT
// =============================================================================

const WellsDVT: SeedSystemCard = {
  name: 'Wells Criteria for DVT',
  type: 'criteria',
  specialty: 'Emergency Medicine',
  conditionConcepts: [
    { system: 'ICD10', code: 'I82', term: 'Other venous embolism and thrombosis' },
    { system: 'SNOMED', code: '128053003', term: 'Deep venous thrombosis' },
  ],
  intendedUse: 'diagnosis',
  population: 'Adults with suspected lower extremity DVT',
  careSetting: 'Emergency, Outpatient',
  inputs: [
    { name: 'active_cancer', type: 'boolean', required: true, description: 'Active cancer (treatment within 6 months or palliative)' },
    { name: 'paralysis_paresis', type: 'boolean', required: true, description: 'Paralysis, paresis, or recent cast immobilization of lower extremities' },
    { name: 'bedridden', type: 'boolean', required: true, description: 'Recently bedridden >3 days or major surgery within 12 weeks' },
    { name: 'localized_tenderness', type: 'boolean', required: true, description: 'Localized tenderness along deep venous system' },
    { name: 'entire_leg_swollen', type: 'boolean', required: true, description: 'Entire leg swollen' },
    { name: 'calf_swelling', type: 'boolean', required: true, description: 'Calf swelling >3 cm compared to asymptomatic leg' },
    { name: 'pitting_edema', type: 'boolean', required: true, description: 'Pitting edema confined to symptomatic leg' },
    { name: 'collateral_veins', type: 'boolean', required: true, description: 'Collateral superficial veins (non-varicose)' },
    { name: 'previous_dvt', type: 'boolean', required: true, description: 'Previously documented DVT' },
    { name: 'alternative_diagnosis', type: 'boolean', required: true, description: 'Alternative diagnosis at least as likely as DVT' },
  ],
  outputs: [
    { name: 'score', type: 'score', range: '-2 to 9', description: 'Wells score' },
    { name: 'probability', type: 'category', labels: ['Low', 'Moderate', 'High'], description: 'Pre-test probability' },
    { name: 'dvt_unlikely', type: 'category', labels: ['DVT Unlikely', 'DVT Likely'], description: 'Dichotomized probability' },
  ],
  interpretation: [
    { range: '≤0', meaning: 'Low probability (~5% DVT prevalence)', clinicalAction: 'D-dimer testing; if negative, DVT excluded' },
    { range: '1-2', meaning: 'Moderate probability (~17% DVT prevalence)', clinicalAction: 'D-dimer or ultrasound' },
    { range: '≥3', meaning: 'High probability (~53% DVT prevalence)', clinicalAction: 'Ultrasound recommended' },
  ],
  limitations: [
    'Not validated in pregnancy',
    'Not validated for upper extremity DVT',
    'Inter-observer variability in clinical assessment',
    'Should be used with D-dimer in diagnostic algorithm',
  ],
  evidenceSummary: {
    derivationStudy: 'Wells PS, et al. Lancet 1997',
    derivationPopulation: 'Outpatients with suspected DVT',
    derivationSize: 593,
    validationStudies: 50,
  },
  version: '2003 (Modified)',
};

const WellsDVTRuleSpec: SeedRuleSpec = {
  name: 'Wells DVT Calculator',
  description: 'Threshold-based scoring for DVT pre-test probability',
  ruleType: 'threshold',
  ruleDefinition: {
    criteria: [
      { variable: 'active_cancer', condition: 'boolean', points: 1, name: 'Active cancer' },
      { variable: 'paralysis_paresis', condition: 'boolean', points: 1, name: 'Paralysis/paresis/cast' },
      { variable: 'bedridden', condition: 'boolean', points: 1, name: 'Recently bedridden/major surgery' },
      { variable: 'localized_tenderness', condition: 'boolean', points: 1, name: 'Localized tenderness' },
      { variable: 'entire_leg_swollen', condition: 'boolean', points: 1, name: 'Entire leg swollen' },
      { variable: 'calf_swelling', condition: 'boolean', points: 1, name: 'Calf swelling >3 cm' },
      { variable: 'pitting_edema', condition: 'boolean', points: 1, name: 'Pitting edema' },
      { variable: 'collateral_veins', condition: 'boolean', points: 1, name: 'Collateral superficial veins' },
      { variable: 'previous_dvt', condition: 'boolean', points: 1, name: 'Previous DVT' },
      { variable: 'alternative_diagnosis', condition: 'boolean', points: -2, name: 'Alternative diagnosis likely' },
    ],
    categories: [
      { min: -2, max: 0, label: 'Low' },
      { min: 1, max: 2, label: 'Moderate' },
      { min: 3, max: 9, label: 'High' },
    ],
  },
  testCases: [
    {
      inputs: { active_cancer: false, paralysis_paresis: false, bedridden: false, localized_tenderness: true, entire_leg_swollen: false, calf_swelling: false, pitting_edema: false, collateral_veins: false, previous_dvt: false, alternative_diagnosis: true },
      expectedOutput: { score: -1, probability: 'Low' },
      description: 'Low probability - likely alternative diagnosis',
    },
    {
      inputs: { active_cancer: true, paralysis_paresis: false, bedridden: true, localized_tenderness: true, entire_leg_swollen: false, calf_swelling: true, pitting_edema: false, collateral_veins: false, previous_dvt: false, alternative_diagnosis: false },
      expectedOutput: { score: 4, probability: 'High' },
      description: 'High probability - cancer, bedridden, swelling',
    },
  ],
};

// =============================================================================
// CURB-65 Score
// =============================================================================

const CURB65: SeedSystemCard = {
  name: 'CURB-65 Score',
  type: 'score',
  specialty: 'Pulmonology',
  conditionConcepts: [
    { system: 'ICD10', code: 'J18', term: 'Pneumonia, unspecified organism' },
    { system: 'SNOMED', code: '233604007', term: 'Pneumonia' },
  ],
  intendedUse: 'severity',
  population: 'Adults with community-acquired pneumonia',
  careSetting: 'Emergency, Inpatient',
  inputs: [
    { name: 'confusion', type: 'boolean', required: true, description: 'New mental confusion (AMTS ≤8 or disorientation)' },
    { name: 'bun', type: 'numeric', required: true, description: 'Blood urea nitrogen (mg/dL)', validValues: { min: 0 } },
    { name: 'respiratory_rate', type: 'numeric', required: true, description: 'Respiratory rate (breaths/min)', validValues: { min: 0 } },
    { name: 'sbp', type: 'numeric', required: true, description: 'Systolic blood pressure (mmHg)', validValues: { min: 0 } },
    { name: 'dbp', type: 'numeric', required: true, description: 'Diastolic blood pressure (mmHg)', validValues: { min: 0 } },
    { name: 'age', type: 'numeric', required: true, description: 'Patient age in years', validValues: { min: 0, max: 120 } },
  ],
  outputs: [
    { name: 'score', type: 'score', range: '0-5', description: 'CURB-65 score' },
    { name: 'risk_group', type: 'category', labels: ['Low', 'Intermediate', 'High'], description: 'Severity group' },
    { name: 'thirty_day_mortality', type: 'risk', description: 'Estimated 30-day mortality' },
  ],
  interpretation: [
    { range: '0-1', meaning: 'Low severity (mortality <3%)', clinicalAction: 'Consider outpatient treatment' },
    { range: '2', meaning: 'Moderate severity (mortality ~9%)', clinicalAction: 'Consider short inpatient stay or hospital-supervised outpatient' },
    { range: '3-5', meaning: 'High severity (mortality 15-40%)', clinicalAction: 'Hospitalization required; consider ICU if score 4-5' },
  ],
  limitations: [
    'Does not account for comorbidities',
    'BUN may be elevated for non-pneumonia reasons',
    'Age criterion may over-triage elderly patients',
    'Does not capture oxygenation status',
  ],
  evidenceSummary: {
    derivationStudy: 'Lim WS, et al. Thorax 2003',
    derivationPopulation: 'Community-acquired pneumonia patients',
    derivationSize: 1068,
    validationStudies: 30,
  },
  version: '2003',
};

const CURB65RuleSpec: SeedRuleSpec = {
  name: 'CURB-65 Calculator',
  description: 'Threshold-based scoring for pneumonia severity',
  ruleType: 'threshold',
  ruleDefinition: {
    criteria: [
      { variable: 'confusion', condition: 'boolean', points: 1, name: 'Confusion' },
      { variable: 'bun', condition: 'gt', threshold: 19, points: 1, name: 'BUN >19 mg/dL (Urea >7 mmol/L)' },
      { variable: 'respiratory_rate', condition: 'gte', threshold: 30, points: 1, name: 'Respiratory rate ≥30' },
      { variable: 'sbp', condition: 'lt', threshold: 90, points: 1, name: 'SBP <90 mmHg' },
      { variable: 'dbp', condition: 'lte', threshold: 60, points: 1, name: 'DBP ≤60 mmHg', required: false },
      { variable: 'age', condition: 'gte', threshold: 65, points: 1, name: 'Age ≥65' },
    ],
    categories: [
      { min: 0, max: 1, label: 'Low' },
      { min: 2, max: 2, label: 'Intermediate' },
      { min: 3, max: 5, label: 'High' },
    ],
    interpretations: {
      '0': '30-day mortality ~0.7%',
      '1': '30-day mortality ~2.1%',
      '2': '30-day mortality ~9.2%',
      '3': '30-day mortality ~14.5%',
      '4': '30-day mortality ~40%',
      '5': '30-day mortality ~57%',
    },
  },
  testCases: [
    {
      inputs: { confusion: false, bun: 15, respiratory_rate: 20, sbp: 120, dbp: 80, age: 45 },
      expectedOutput: { score: 0, risk_group: 'Low' },
      description: 'Low risk - healthy adult with mild pneumonia',
    },
    {
      inputs: { confusion: true, bun: 25, respiratory_rate: 32, sbp: 85, dbp: 55, age: 72 },
      expectedOutput: { score: 5, risk_group: 'High' },
      description: 'High risk - elderly with all criteria positive',
    },
  ],
};

// =============================================================================
// Seed Function
// =============================================================================

interface SeedEntry {
  systemCard: SeedSystemCard;
  ruleSpec: SeedRuleSpec;
  evidence?: SeedEvidence[];
}

const seedData: SeedEntry[] = [
  { systemCard: CHA2DS2VASc, ruleSpec: CHA2DS2VAScRuleSpec, evidence: CHA2DS2VAScEvidence },
  { systemCard: ChildPugh, ruleSpec: ChildPughRuleSpec },
  { systemCard: MELD, ruleSpec: MELDRuleSpec },
  { systemCard: WellsDVT, ruleSpec: WellsDVTRuleSpec },
  { systemCard: CURB65, ruleSpec: CURB65RuleSpec },
];

export async function seedGuidelinesEngine(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const entry of seedData) {
      // Create system card
      const systemCardId = uuidv4();
      const sc = entry.systemCard;

      await client.query(
        `INSERT INTO system_cards (
          id, name, type, specialty, condition_concepts, intended_use,
          population, care_setting, inputs, outputs, interpretation,
          limitations, evidence_summary, version, status, verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          systemCardId,
          sc.name,
          sc.type,
          sc.specialty,
          JSON.stringify(sc.conditionConcepts),
          sc.intendedUse,
          sc.population,
          sc.careSetting,
          JSON.stringify(sc.inputs),
          JSON.stringify(sc.outputs),
          JSON.stringify(sc.interpretation),
          JSON.stringify(sc.limitations),
          JSON.stringify(sc.evidenceSummary),
          sc.version,
          'active',
          true,
        ]
      );

      // Create rule spec
      const ruleSpecId = uuidv4();
      const rs = entry.ruleSpec;

      await client.query(
        `INSERT INTO rule_specs (
          id, system_card_id, name, description, rule_type,
          rule_definition, test_cases, validated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ruleSpecId,
          systemCardId,
          rs.name,
          rs.description,
          rs.ruleType,
          JSON.stringify(rs.ruleDefinition),
          JSON.stringify(rs.testCases),
          true,
        ]
      );

      // Create evidence statements
      if (entry.evidence) {
        for (const ev of entry.evidence) {
          const evidenceId = uuidv4();
          await client.query(
            `INSERT INTO evidence_statements (
              id, system_card_id, statement_text, strength,
              quality, evidence_type, citation_ref
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              evidenceId,
              systemCardId,
              ev.statementText,
              ev.strength,
              ev.quality,
              ev.evidenceType,
              ev.citationRef,
            ]
          );
        }
      }

      console.log(`✓ Seeded: ${sc.name}`);
    }

    await client.query('COMMIT');
    console.log('\n✓ Guidelines Engine seed data created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding guidelines engine:', error);
    throw error;
  } finally {
    client.release();
  }
}

// CLI runner
if (require.main === module) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  seedGuidelinesEngine(pool)
    .then(() => {
      console.log('Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
