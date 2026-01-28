/**
 * Workflow Stage Definitions
 *
 * Static data extracted from monolithic routes.ts for modularity.
 * Contains the 20-stage research workflow structure.
 *
 * @module data/workflowStages
 */

export interface ScopeSubsection {
  id: string;
  label: string;
  placeholder: string;
}

export interface AISuggestion {
  type: 'narrow' | 'expand' | 'improve';
  text: string;
  targetSection: string;
}

export interface ScopeRefinement {
  enabled: boolean;
  subsections: ScopeSubsection[];
}

export interface WorkflowStage {
  id: number;
  name: string;
  shortName: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
  icon: string;
  outputs: string[];
  duration: string;
  dependencies?: string[];
  scopeRefinement?: ScopeRefinement;
  aiSuggestions?: AISuggestion[];
}

export interface WorkflowStageGroup {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  isOptional: boolean;
  stages: WorkflowStage[];
}

export const workflowStageGroups: WorkflowStageGroup[] = [
  {
    id: "data-preparation",
    name: "Data Preparation",
    shortName: "Preparation",
    description: "Define research scope and gather background literature",
    icon: "FileStack",
    isOptional: false,
    stages: [
      {
        id: 1,
        name: "Topic Declaration",
        shortName: "Topic",
        description: "Define your research question and data requirements",
        status: "completed",
        icon: "FileText",
        outputs: ["Research hypothesis", "Variable definitions", "Study scope"],
        duration: "5 min",
        scopeRefinement: {
          enabled: true,
          subsections: [
            { id: "population", label: "Target Population", placeholder: "e.g., Adults 40-65 with Type 2 Diabetes" },
            { id: "intervention", label: "Intervention/Exposure", placeholder: "e.g., GLP-1 receptor agonists vs. SGLT2 inhibitors" },
            { id: "comparator", label: "Comparator Group", placeholder: "e.g., Standard care, placebo, alternative treatment" },
            { id: "outcomes", label: "Primary Outcomes", placeholder: "e.g., HbA1c reduction, cardiovascular events" },
            { id: "timeframe", label: "Study Timeframe", placeholder: "e.g., 12-month follow-up period" }
          ]
        },
        aiSuggestions: [
          { type: "narrow", text: "Consider limiting to patients with documented medication adherence >80%", targetSection: "population" },
          { type: "narrow", text: "Focus on newly diagnosed patients (within 2 years) for cleaner baseline", targetSection: "population" },
          { type: "expand", text: "Include combination therapy patients for broader applicability", targetSection: "intervention" },
          { type: "improve", text: "Consider dose-response analysis across treatment intensities", targetSection: "intervention" },
          { type: "expand", text: "Add active comparator arm (e.g., alternative drug class)", targetSection: "comparator" },
          { type: "improve", text: "Match comparators by baseline disease severity", targetSection: "comparator" },
          { type: "expand", text: "Include secondary endpoints like quality of life measures", targetSection: "outcomes" },
          { type: "improve", text: "Add composite endpoint combining multiple clinical events", targetSection: "outcomes" },
          { type: "narrow", text: "Consider 6-month minimum follow-up for acute outcomes", targetSection: "timeframe" },
          { type: "expand", text: "Extend to 24-month follow-up for long-term safety signals", targetSection: "timeframe" }
        ]
      },
      {
        id: 2,
        name: "Literature Search",
        shortName: "Literature",
        description: "AI-powered comprehensive literature review",
        status: "completed",
        icon: "BookOpen",
        outputs: ["50+ relevant papers", "Citation network", "Key findings summary"],
        duration: "10 min"
      },
      {
        id: 3,
        name: "IRB Proposal",
        shortName: "IRB",
        description: "Auto-generate IRB proposal from topic and literature review",
        status: "completed",
        icon: "ClipboardCheck",
        outputs: ["Draft IRB application", "Risk assessment", "Consent form template", "Protocol summary"],
        duration: "8 min",
        dependencies: ["Topic Declaration", "Literature Search"]
      },
      {
        id: 4,
        name: "Variable Definition",
        shortName: "Variables",
        description: "Define variables, codebook, and data dictionary",
        status: "completed",
        icon: "Database",
        outputs: ["Variable codebook", "Data dictionary", "Extraction protocol"],
        duration: "8 min"
      }
    ]
  },
  {
    id: "data-processing",
    name: "Data Processing & Validation",
    shortName: "Processing",
    description: "Ensure data quality, compliance, and integrity",
    icon: "ShieldCheck",
    isOptional: false,
    stages: [
      {
        id: 5,
        name: "PHI Scanning",
        shortName: "PHI Scan",
        description: "Automated detection of protected health information",
        status: "completed",
        icon: "Shield",
        outputs: ["PHI report", "De-identification log", "Compliance certificate"],
        duration: "3 min"
      },
      {
        id: 6,
        name: "Schema Extraction",
        shortName: "Schema",
        description: "Extract and map data schema from source files",
        status: "active",
        icon: "TableProperties",
        outputs: ["Schema map", "Field types", "Relationship diagram"],
        duration: "4 min"
      },
      {
        id: 7,
        name: "Final Scrubbing",
        shortName: "Scrubbing",
        description: "Deep cleaning and standardization of data",
        status: "pending",
        icon: "Eraser",
        outputs: ["Cleaned dataset", "Transformation log", "Quality metrics"],
        duration: "6 min"
      },
      {
        id: 8,
        name: "Data Validation",
        shortName: "Validation",
        description: "Quality checks and data integrity verification",
        status: "pending",
        icon: "CheckCircle",
        outputs: ["Validation report", "Data quality score", "Anomaly flags"],
        duration: "5 min"
      }
    ]
  },
  {
    id: "analysis-ideation",
    name: "Analysis & Ideation",
    shortName: "Analysis",
    description: "Generate insights and identify research opportunities",
    icon: "Lightbulb",
    isOptional: false,
    stages: [
      {
        id: 9,
        name: "Summary Characteristics",
        shortName: "Summary",
        description: "Generate baseline statistics and demographics",
        status: "pending",
        icon: "BarChart3",
        outputs: ["Table 1 demographics", "Descriptive statistics", "Distribution plots"],
        duration: "7 min"
      },
      {
        id: 10,
        name: "Literature Gap Analysis",
        shortName: "Gap Analysis",
        description: "Identify research gaps and opportunities",
        status: "pending",
        icon: "Search",
        outputs: ["Gap report", "Opportunity matrix", "Citation gaps"],
        duration: "12 min"
      },
      {
        id: 11,
        name: "Manuscript Ideation",
        shortName: "Ideation",
        description: "AI-generated manuscript proposals (5-10 options)",
        status: "pending",
        icon: "Sparkles",
        outputs: ["5-10 manuscript proposals", "Novelty scores", "Target journals"],
        duration: "15 min"
      }
    ]
  },
  {
    id: "manuscript-development",
    name: "Manuscript Development",
    shortName: "Development",
    description: "Select, analyze, and draft your manuscript",
    icon: "FileEdit",
    isOptional: false,
    stages: [
      {
        id: 12,
        name: "Manuscript Selection",
        shortName: "Selection",
        description: "Choose the best manuscript direction to pursue",
        status: "pending",
        icon: "MousePointerClick",
        outputs: ["Selected manuscript", "Rationale document", "Scope definition"],
        duration: "5 min"
      },
      {
        id: 13,
        name: "Statistical Analysis",
        shortName: "Statistics",
        description: "Automated statistical tests and modeling",
        status: "pending",
        icon: "Calculator",
        outputs: ["Statistical report", "Regression models", "P-value tables"],
        duration: "20 min"
      },
      {
        id: 14,
        name: "Manuscript Drafting",
        shortName: "Drafting",
        description: "AI-assisted manuscript generation",
        status: "pending",
        icon: "PenTool",
        outputs: ["Draft manuscript", "Methods section", "Results tables"],
        duration: "25 min"
      }
    ]
  },
  {
    id: "finalization",
    name: "Finalization",
    shortName: "Finalization",
    description: "Polish and prepare manuscript for submission",
    icon: "Send",
    isOptional: false,
    stages: [
      {
        id: 15,
        name: "Polish Manuscript",
        shortName: "Polish",
        description: "Refine language, formatting, and flow",
        status: "pending",
        icon: "Wand2",
        outputs: ["Polished manuscript", "Style corrections", "Reference formatting"],
        duration: "15 min"
      },
      {
        id: 16,
        name: "Submission Readiness",
        shortName: "Submission",
        description: "Final checks and journal-specific formatting",
        status: "pending",
        icon: "FileCheck",
        outputs: ["Submission package", "Cover letter", "Checklist complete"],
        duration: "10 min"
      }
    ]
  },
  {
    id: "conference-readiness",
    name: "Conference Readiness",
    shortName: "Conference",
    description: "Prepare materials for academic presentations",
    icon: "Presentation",
    isOptional: true,
    stages: [
      {
        id: 20,
        name: "Conference Preparation",
        shortName: "Prep",
        description: "Discover conferences, extract guidelines, generate submission-ready materials",
        status: "pending",
        icon: "Search",
        outputs: ["Shortlisted conferences", "Guideline templates", "Submission bundle ZIP"],
        duration: "10–30 min"
      },
      {
        id: 17,
        name: "Poster Preparation",
        shortName: "Poster",
        description: "Generate research poster from manuscript",
        status: "pending",
        icon: "Image",
        outputs: ["Research poster", "Visual abstracts", "QR code links"],
        duration: "12 min"
      },
      {
        id: 18,
        name: "Symposium Materials",
        shortName: "Symposium",
        description: "Create symposium presentation materials",
        status: "pending",
        icon: "Users",
        outputs: ["Symposium slides", "Speaking notes", "Handouts"],
        duration: "15 min"
      },
      {
        id: 19,
        name: "Presentation Preparation",
        shortName: "Presentation",
        description: "Build conference presentation deck",
        status: "pending",
        icon: "Monitor",
        outputs: ["Slide deck", "Speaker notes", "Q&A preparation"],
        duration: "20 min"
      }
    ]
  }
];

/**
 * Get all stages flattened from groups
 */
export function getAllStages(): WorkflowStage[] {
  return workflowStageGroups.flatMap(group => group.stages);
}

/**
 * Get a stage by ID
 */
export function getStageById(stageId: number): WorkflowStage | undefined {
  return getAllStages().find(stage => stage.id === stageId);
}

/**
 * Get a stage group by stage ID
 */
export function getStageGroupByStageId(stageId: number): WorkflowStageGroup | undefined {
  return workflowStageGroups.find(group =>
    group.stages.some(stage => stage.id === stageId)
  );
}

/**
 * Get stage name by ID
 */
export function getStageName(stageId: number): string {
  const stage = getStageById(stageId);
  return stage?.name || `Stage ${stageId}`;
}

export default workflowStageGroups;
