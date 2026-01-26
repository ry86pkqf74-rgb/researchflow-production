/**
 * Research Dataset Definitions
 *
 * Static data extracted from monolithic routes.ts for modularity.
 * Contains sample research datasets for the demo environment.
 *
 * @module data/researchDatasets
 */

export interface ResearchDataset {
  id: string;
  name: string;
  domain: string;
  type: string;
  records: number;
  variables: number;
  description: string;
  dateRange: string;
  phiStatus: 'De-identified' | 'PHI Present' | 'Scrubbing Required';
  icon: string;
  color: string;
  sampleVariables: string[];
}

export interface BaselineCharacteristic {
  variable: string;
  overall: string;
  group1: string;
  group2: string;
  pValue: string;
}

export interface ManuscriptProposal {
  id: number;
  title: string;
  abstract: string;
  relevanceScore: number;
  noveltyScore: number;
  feasibilityScore: number;
  suggestedJournals: string[];
  keywords: string[];
}

// Demo dataset for immediate display
export const demoDataset: Omit<ResearchDataset, 'domain' | 'icon' | 'color' | 'sampleVariables'> = {
  id: "thyroid-clinical-2024",
  name: "Thyroid Clinical Dataset",
  type: "Clinical Registry",
  records: 2847,
  variables: 24,
  description: "Retrospective cohort of patients with thyroid disorders from University Medical Center",
  dateRange: "2018-2024",
  phiStatus: "De-identified"
};

// Full research datasets list
export const researchDatasets: ResearchDataset[] = [
  {
    id: "thyroid-clinical-2024",
    name: "Thyroid Clinical Dataset",
    domain: "Endocrinology",
    type: "Clinical Registry",
    records: 2847,
    variables: 24,
    description: "Retrospective cohort of patients with thyroid disorders from University Medical Center",
    dateRange: "2018-2024",
    phiStatus: "De-identified",
    icon: "Activity",
    color: "ros-primary",
    sampleVariables: ["TSH levels", "Free T4", "Anti-TPO antibodies", "Age", "BMI", "Comorbidities"]
  },
  {
    id: "cardiology-heart-failure",
    name: "Heart Failure Registry",
    domain: "Cardiology",
    type: "Prospective Cohort",
    records: 5234,
    variables: 42,
    description: "Multi-center heart failure patients with echocardiographic and biomarker data",
    dateRange: "2019-2024",
    phiStatus: "De-identified",
    icon: "Heart",
    color: "red-500",
    sampleVariables: ["Ejection Fraction", "BNP levels", "NYHA Class", "Medications", "Hospitalization events"]
  },
  {
    id: "oncology-breast-cancer",
    name: "Breast Cancer Outcomes",
    domain: "Oncology",
    type: "Tumor Registry",
    records: 3891,
    variables: 56,
    description: "Comprehensive breast cancer database with genomic, treatment, and survival data",
    dateRange: "2015-2024",
    phiStatus: "De-identified",
    icon: "Ribbon",
    color: "pink-500",
    sampleVariables: ["Tumor stage", "Receptor status", "Treatment regimen", "Survival months", "Recurrence"]
  },
  {
    id: "neurology-alzheimers",
    name: "Alzheimer's Disease Study",
    domain: "Neurology",
    type: "Longitudinal Cohort",
    records: 1892,
    variables: 78,
    description: "Multi-year cognitive and imaging study of Alzheimer's disease progression",
    dateRange: "2010-2024",
    phiStatus: "De-identified",
    icon: "Brain",
    color: "purple-500",
    sampleVariables: ["MMSE scores", "MRI volumes", "CSF biomarkers", "Genetic markers", "Functional status"]
  },
  {
    id: "pulmonology-copd",
    name: "COPD Outcomes Registry",
    domain: "Pulmonology",
    type: "Disease Registry",
    records: 4567,
    variables: 38,
    description: "National registry of COPD patients with spirometry and exacerbation data",
    dateRange: "2017-2024",
    phiStatus: "De-identified",
    icon: "Wind",
    color: "cyan-500",
    sampleVariables: ["FEV1/FVC ratio", "Exacerbation frequency", "Inhaler use", "Quality of life scores"]
  },
  {
    id: "rheumatology-arthritis",
    name: "Rheumatoid Arthritis Cohort",
    domain: "Rheumatology",
    type: "Prospective Cohort",
    records: 2156,
    variables: 45,
    description: "Patients with rheumatoid arthritis tracking disease activity and treatment response",
    dateRange: "2016-2024",
    phiStatus: "De-identified",
    icon: "Bone",
    color: "orange-500",
    sampleVariables: ["DAS28 score", "RF/Anti-CCP", "Biologic use", "Joint erosions", "Disability index"]
  },
  {
    id: "pediatrics-asthma",
    name: "Pediatric Asthma Study",
    domain: "Pediatrics",
    type: "Population Cohort",
    records: 6234,
    variables: 32,
    description: "Children and adolescents with asthma from urban and suburban settings",
    dateRange: "2018-2024",
    phiStatus: "De-identified",
    icon: "Baby",
    color: "green-500",
    sampleVariables: ["Peak flow", "Medication adherence", "School absences", "ED visits", "Environmental triggers"]
  },
  {
    id: "gastroenterology-ibd",
    name: "IBD Research Database",
    domain: "Gastroenterology",
    type: "Clinical Registry",
    records: 3421,
    variables: 52,
    description: "Inflammatory bowel disease patients with endoscopic and laboratory data",
    dateRange: "2014-2024",
    phiStatus: "De-identified",
    icon: "Microscope",
    color: "yellow-500",
    sampleVariables: ["Disease type", "Endoscopy scores", "Fecal calprotectin", "Biologic therapy", "Surgical history"]
  }
];

// Baseline characteristics for Table 1 displays
export const baselineCharacteristics: BaselineCharacteristic[] = [
  { variable: "Age, years (mean ± SD)", overall: "54.3 ± 12.8", group1: "52.1 ± 11.9", group2: "56.5 ± 13.4", pValue: "0.012" },
  { variable: "Female, n (%)", overall: "1,847 (64.9%)", group1: "923 (65.2%)", group2: "924 (64.6%)", pValue: "0.742" },
  { variable: "BMI, kg/m² (mean ± SD)", overall: "28.4 ± 5.6", group1: "27.9 ± 5.2", group2: "28.9 ± 5.9", pValue: "0.089" },
  { variable: "TSH, mIU/L (median, IQR)", overall: "4.8 (2.1-8.2)", group1: "3.2 (1.8-5.4)", group2: "6.4 (3.8-10.1)", pValue: "<0.001" },
  { variable: "Free T4, ng/dL (mean ± SD)", overall: "1.12 ± 0.24", group1: "1.18 ± 0.22", group2: "1.06 ± 0.25", pValue: "<0.001" },
  { variable: "Hypertension, n (%)", overall: "1,124 (39.5%)", group1: "498 (35.2%)", group2: "626 (43.8%)", pValue: "<0.001" },
  { variable: "Diabetes, n (%)", overall: "567 (19.9%)", group1: "245 (17.3%)", group2: "322 (22.5%)", pValue: "0.001" },
  { variable: "Smoking, n (%)", overall: "412 (14.5%)", group1: "198 (14.0%)", group2: "214 (15.0%)", pValue: "0.456" }
];

// Manuscript proposals for ideation stage
export const manuscriptProposals: ManuscriptProposal[] = [
  {
    id: 1,
    title: "Association Between TSH Levels and Cardiovascular Outcomes in Subclinical Hypothyroidism",
    abstract: "This retrospective cohort study examines the relationship between thyroid-stimulating hormone (TSH) levels and cardiovascular events in patients with subclinical hypothyroidism. Using a dataset of 2,847 patients followed over 5 years...",
    relevanceScore: 94,
    noveltyScore: 87,
    feasibilityScore: 92,
    suggestedJournals: ["Thyroid", "JCEM", "European Journal of Endocrinology"],
    keywords: ["subclinical hypothyroidism", "TSH", "cardiovascular outcomes", "risk stratification"]
  },
  {
    id: 2,
    title: "Machine Learning Prediction Model for Thyroid Nodule Malignancy",
    abstract: "Development and validation of a machine learning algorithm combining ultrasound features, clinical parameters, and molecular markers to predict thyroid nodule malignancy with higher accuracy than existing risk stratification systems...",
    relevanceScore: 91,
    noveltyScore: 95,
    feasibilityScore: 78,
    suggestedJournals: ["Thyroid", "Radiology", "JAMA Network Open"],
    keywords: ["thyroid nodule", "machine learning", "malignancy prediction", "ultrasound"]
  },
  {
    id: 3,
    title: "Gender Disparities in Thyroid Cancer Diagnosis and Treatment Outcomes",
    abstract: "A comprehensive analysis of sex-based differences in thyroid cancer presentation, diagnostic delays, treatment patterns, and survival outcomes across 4,200 patients from a multi-center registry...",
    relevanceScore: 88,
    noveltyScore: 82,
    feasibilityScore: 95,
    suggestedJournals: ["Cancer", "Thyroid", "Annals of Surgical Oncology"],
    keywords: ["thyroid cancer", "gender disparities", "treatment outcomes", "health equity"]
  },
  {
    id: 4,
    title: "Impact of Levothyroxine Timing on Quality of Life in Hypothyroid Patients",
    abstract: "Randomized crossover study comparing morning vs. bedtime levothyroxine administration on patient-reported quality of life measures, TSH stability, and medication adherence in 312 hypothyroid patients...",
    relevanceScore: 85,
    noveltyScore: 76,
    feasibilityScore: 98,
    suggestedJournals: ["Thyroid", "Clinical Endocrinology", "Patient Preference and Adherence"],
    keywords: ["levothyroxine", "medication timing", "quality of life", "hypothyroidism"]
  },
  {
    id: 5,
    title: "Thyroid Autoimmunity and Pregnancy Outcomes: A Propensity-Matched Analysis",
    abstract: "Investigation of the impact of thyroid peroxidase antibodies on pregnancy complications and neonatal outcomes using propensity score matching to control for confounding variables in a cohort of 1,850 pregnant women...",
    relevanceScore: 92,
    noveltyScore: 84,
    feasibilityScore: 88,
    suggestedJournals: ["Thyroid", "Fertility and Sterility", "BJOG"],
    keywords: ["thyroid autoimmunity", "pregnancy", "TPO antibodies", "neonatal outcomes"]
  }
];

/**
 * Get dataset by ID
 */
export function getDatasetById(id: string): ResearchDataset | undefined {
  return researchDatasets.find(dataset => dataset.id === id);
}

/**
 * Get datasets by domain
 */
export function getDatasetsByDomain(domain: string): ResearchDataset[] {
  return researchDatasets.filter(dataset =>
    dataset.domain.toLowerCase() === domain.toLowerCase()
  );
}

/**
 * Get manuscript proposal by ID
 */
export function getManuscriptProposalById(id: number): ManuscriptProposal | undefined {
  return manuscriptProposals.find(proposal => proposal.id === id);
}

export default researchDatasets;
