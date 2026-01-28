import type { WorkflowStage, ManuscriptProposal, ResearchCapability, ComplianceFeature, BaselineCharacteristic } from "@packages/core/types";

export const workflowStages: WorkflowStage[] = [
  {
    id: 1,
    name: "Data Topic Declaration",
    shortName: "Topic",
    description: "Define your research question and data requirements",
    status: "completed",
    icon: "FileText",
    outputs: ["Research hypothesis", "Variable definitions", "Study scope"],
    duration: "5 min"
  },
  {
    id: 2,
    name: "Background Literature Search",
    shortName: "Literature",
    description: "AI-powered comprehensive literature review",
    status: "completed",
    icon: "BookOpen",
    outputs: ["50+ relevant papers", "Citation network", "Key findings summary"],
    duration: "10 min"
  },
  {
    id: 3,
    name: "Variable Definition",
    shortName: "Variables",
    description: "Define variables, codebook, and data dictionary",
    status: "completed",
    icon: "Database",
    outputs: ["Variable codebook", "Data dictionary", "Extraction protocol"],
    duration: "8 min"
  },
  {
    id: 4,
    name: "PHI Scanning",
    shortName: "PHI Scan",
    description: "Automated detection of protected health information",
    status: "completed",
    icon: "Shield",
    outputs: ["PHI report", "De-identification log", "Compliance certificate"],
    duration: "3 min"
  },
  {
    id: 5,
    name: "Data Validation",
    shortName: "Validation",
    description: "Quality checks and data integrity verification",
    status: "active",
    icon: "CheckCircle",
    outputs: ["Validation report", "Data quality score", "Anomaly flags"],
    duration: "5 min"
  },
  {
    id: 6,
    name: "Summary Characteristics",
    shortName: "Summary",
    description: "Generate baseline statistics and demographics",
    status: "pending",
    icon: "BarChart3",
    outputs: ["Table 1 demographics", "Descriptive statistics", "Distribution plots"],
    duration: "7 min"
  },
  {
    id: 7,
    name: "Literature Gap Analysis",
    shortName: "Gap Analysis",
    description: "Identify research gaps and opportunities",
    status: "pending",
    icon: "Search",
    outputs: ["Gap report", "Opportunity matrix", "Citation gaps"],
    duration: "12 min"
  },
  {
    id: 8,
    name: "Manuscript Ideation",
    shortName: "Ideation",
    description: "AI-generated manuscript proposals (5-10)",
    status: "pending",
    icon: "Lightbulb",
    outputs: ["5-10 manuscript proposals", "Novelty scores", "Target journals"],
    duration: "15 min"
  },
  {
    id: 9,
    name: "Statistical Analysis",
    shortName: "Statistics",
    description: "Automated statistical tests and modeling",
    status: "pending",
    icon: "Calculator",
    outputs: ["Statistical report", "Regression models", "P-value tables"],
    duration: "20 min"
  },
  {
    id: 10,
    name: "Manuscript Drafting",
    shortName: "Drafting",
    description: "AI-assisted manuscript generation",
    status: "pending",
    icon: "FileEdit",
    outputs: ["Draft manuscript", "Methods section", "Results tables"],
    duration: "25 min"
  },
  {
    id: 11,
    name: "Second Literature Review",
    shortName: "Review 2",
    description: "Updated literature context for discussion",
    status: "pending",
    icon: "RefreshCw",
    outputs: ["Updated citations", "Discussion points", "Comparison studies"],
    duration: "8 min"
  },
  {
    id: 12,
    name: "Final Editing",
    shortName: "Editing",
    description: "Polish, format, and prepare for submission",
    status: "pending",
    icon: "Sparkles",
    outputs: ["Final manuscript", "Formatted references", "Submission package"],
    duration: "15 min"
  }
];

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

export const researchCapabilities: ResearchCapability[] = [
  {
    id: "baseline",
    title: "Baseline Characteristics Generation",
    description: "Automatically generate publication-ready Table 1 demographics and summary statistics from your dataset with proper formatting and statistical testing.",
    features: [
      "Automatic variable type detection",
      "Stratified group comparisons",
      "P-value calculations",
      "Publication-ready formatting",
      "Missing data handling"
    ],
    icon: "BarChart3"
  },
  {
    id: "literature",
    title: "Literature Gap Analysis",
    description: "AI-powered analysis of existing literature to identify unexplored research questions, methodological gaps, and opportunities for novel contributions.",
    features: [
      "Semantic paper clustering",
      "Citation network analysis",
      "Methodology gap detection",
      "Trend identification",
      "Collaboration opportunities"
    ],
    icon: "Search"
  },
  {
    id: "manuscript",
    title: "AI-Assisted Manuscript Ideation",
    description: "Generate 5-10 novel manuscript proposals based on your data, with relevance scoring, target journal suggestions, and feasibility assessments.",
    features: [
      "Multiple proposal generation",
      "Novelty scoring algorithm",
      "Journal matching",
      "Abstract drafting",
      "Keyword optimization"
    ],
    icon: "Lightbulb"
  }
];

export const complianceFeatures: ComplianceFeature[] = [
  {
    id: "hipaa",
    title: "HIPAA Compliance",
    description: "Full compliance with Health Insurance Portability and Accountability Act requirements for protected health information",
    icon: "ShieldCheck",
    status: "certified"
  },
  {
    id: "phi-scan",
    title: "Automated PHI Detection",
    description: "AI-powered scanning for 18 HIPAA identifiers including names, dates, locations, and medical record numbers",
    icon: "ScanEye",
    status: "active"
  },
  {
    id: "audit",
    title: "Complete Audit Trail",
    description: "Full traceability of all data access, transformations, and analysis steps with timestamped logging",
    icon: "History",
    status: "active"
  },
  {
    id: "validation",
    title: "Data Validation Checkpoints",
    description: "Multi-stage validation ensuring data integrity, quality scores, and anomaly detection at each pipeline stage",
    icon: "CheckCheck",
    status: "validated"
  }
];

export const sampleBaselineData: BaselineCharacteristic[] = [
  { variable: "Age, years (mean ± SD)", overall: "54.3 ± 12.8", group1: "52.1 ± 11.9", group2: "56.5 ± 13.4", pValue: "0.012" },
  { variable: "Female, n (%)", overall: "1,847 (64.9%)", group1: "923 (65.2%)", group2: "924 (64.6%)", pValue: "0.742" },
  { variable: "BMI, kg/m² (mean ± SD)", overall: "28.4 ± 5.6", group1: "27.9 ± 5.2", group2: "28.9 ± 5.9", pValue: "0.089" },
  { variable: "TSH, mIU/L (median, IQR)", overall: "4.8 (2.1-8.2)", group1: "3.2 (1.8-5.4)", group2: "6.4 (3.8-10.1)", pValue: "<0.001" },
  { variable: "Free T4, ng/dL (mean ± SD)", overall: "1.12 ± 0.24", group1: "1.18 ± 0.22", group2: "1.06 ± 0.25", pValue: "<0.001" },
  { variable: "Hypertension, n (%)", overall: "1,124 (39.5%)", group1: "498 (35.2%)", group2: "626 (43.8%)", pValue: "<0.001" },
  { variable: "Diabetes, n (%)", overall: "567 (19.9%)", group1: "245 (17.3%)", group2: "322 (22.5%)", pValue: "0.001" },
  { variable: "Smoking, n (%)", overall: "412 (14.5%)", group1: "198 (14.0%)", group2: "214 (15.0%)", pValue: "0.456" }
];
