/**
 * Workflow Stages Definition (Task 5)
 *
 * Central definition of all 20 workflow stages.
 * Used for:
 * - Stage metadata (name, description, icon)
 * - Input/output schema references
 * - Stage-specific permissions
 * - Tooltips throughout the UI
 */

import {
  Lightbulb,
  BookOpen,
  FlaskConical,
  Database,
  Shield,
  LineChart,
  Calculator,
  BarChart3,
  MessageSquare,
  CheckCircle,
  RefreshCw,
  FileText,
  Users,
  Scale,
  Package,
  Share2,
  Archive,
  TrendingUp,
  Globe,
  Presentation,
  type LucideIcon,
} from 'lucide-react';

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export type StageCategory = 'discovery' | 'collection' | 'analysis' | 'validation' | 'dissemination';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface StageDefinition {
  id: StageId;
  name: string;
  description: string;
  longDescription?: string;
  icon: LucideIcon;
  category: StageCategory;
  /** Reference to input JSON schema */
  inputSchemaRef?: string;
  /** Types of artifacts this stage produces */
  outputTypes: string[];
  /** Required permissions to edit this stage */
  requiredPermissions: string[];
  /** Whether this stage requires PHI scanning */
  requiresPhiScan: boolean;
  /** Whether this stage can be skipped */
  optional: boolean;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** AI model tier recommendations */
  recommendedModelTier?: 'NANO' | 'MINI' | 'FRONTIER';
  /** Help documentation path */
  helpDocPath?: string;
}

export const STAGES: Record<StageId, StageDefinition> = {
  1: {
    id: 1,
    name: 'Hypothesis Generation',
    description: 'Generate and refine research hypotheses using AI assistance',
    longDescription: 'In this stage, you will formulate your research question and generate testable hypotheses. AI assistance can help suggest refinements, identify gaps, and propose alternative approaches based on existing literature.',
    icon: Lightbulb,
    category: 'discovery',
    inputSchemaRef: 'stages/stage-01-hypothesis.input.schema.json',
    outputTypes: ['hypotheses.json', 'summary.md'],
    requiredPermissions: ['view_research', 'create_research'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 30,
    recommendedModelTier: 'FRONTIER',
    helpDocPath: 'docs/stages/01-hypothesis.md',
  },
  2: {
    id: 2,
    name: 'Literature Review',
    description: 'Search and summarize relevant scientific literature',
    longDescription: 'Conduct a comprehensive review of existing literature. Search databases, filter results, and generate AI-powered summaries of key findings relevant to your hypotheses.',
    icon: BookOpen,
    category: 'discovery',
    inputSchemaRef: 'stages/stage-02-literature.input.schema.json',
    outputTypes: ['citations.json', 'literature_summary.md'],
    requiredPermissions: ['view_research'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 60,
    recommendedModelTier: 'MINI',
    helpDocPath: 'docs/stages/02-literature.md',
  },
  3: {
    id: 3,
    name: 'Experimental Design',
    description: 'Design experiments with schema-validated parameters',
    longDescription: 'Define your experimental methodology including variables, controls, sample sizes, and endpoints. The system validates your design against predefined schemas to ensure completeness.',
    icon: FlaskConical,
    category: 'discovery',
    inputSchemaRef: 'stages/stage-03-experiment-design.input.schema.json',
    outputTypes: ['experiment_design.json', 'protocol.md'],
    requiredPermissions: ['view_research', 'create_research'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 45,
    recommendedModelTier: 'FRONTIER',
    helpDocPath: 'docs/stages/03-experiment-design.md',
  },
  4: {
    id: 4,
    name: 'Data Collection',
    description: 'Collect and manage research data with manifests',
    longDescription: 'Upload, organize, and manage your research data. Each dataset is tracked with a manifest containing metadata, provenance, and quality indicators.',
    icon: Database,
    category: 'collection',
    inputSchemaRef: 'stages/stage-04-data-collection.input.schema.json',
    outputTypes: ['datasets/*', 'manifest.json'],
    requiredPermissions: ['view_research', 'upload'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 120,
    helpDocPath: 'docs/stages/04-data-collection.md',
  },
  5: {
    id: 5,
    name: 'Data Preprocessing',
    description: 'Clean, validate, and scan data for PHI',
    longDescription: 'Prepare your data for analysis. This includes cleaning, transformation, validation against schemas, and mandatory PHI scanning to ensure compliance.',
    icon: Shield,
    category: 'collection',
    inputSchemaRef: 'stages/stage-05-preprocessing.input.schema.json',
    outputTypes: ['processed_data/*', 'phi_scan_report.json'],
    requiredPermissions: ['view_research', 'phi_scan'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 60,
    helpDocPath: 'docs/stages/05-preprocessing.md',
  },
  6: {
    id: 6,
    name: 'Analysis',
    description: 'Run computational analysis with progress tracking',
    longDescription: 'Execute your analysis pipeline. Track progress in real-time, monitor resource usage, and receive notifications upon completion or errors.',
    icon: LineChart,
    category: 'analysis',
    inputSchemaRef: 'stages/stage-06-analysis.input.schema.json',
    outputTypes: ['analysis_results.json', 'logs/*'],
    requiredPermissions: ['view_research', 'run_analysis'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 180,
    recommendedModelTier: 'NANO',
    helpDocPath: 'docs/stages/06-analysis.md',
  },
  7: {
    id: 7,
    name: 'Statistical Modeling',
    description: 'Build and validate statistical models',
    longDescription: 'Construct statistical models to test your hypotheses. Choose from a variety of methods, validate assumptions, and generate comprehensive model summaries.',
    icon: Calculator,
    category: 'analysis',
    inputSchemaRef: 'stages/stage-07-stats-model.input.schema.json',
    outputTypes: ['model_summary.json', 'tables/*.csv'],
    requiredPermissions: ['view_research', 'run_analysis'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 90,
    helpDocPath: 'docs/stages/07-stats-model.md',
  },
  8: {
    id: 8,
    name: 'Visualization',
    description: 'Create figures and data visualizations',
    longDescription: 'Generate publication-quality figures and interactive visualizations. Choose from various chart types and customize styling to match your requirements.',
    icon: BarChart3,
    category: 'analysis',
    inputSchemaRef: 'stages/stage-08-visualization.input.schema.json',
    outputTypes: ['figures/*.png', 'figures/*.svg'],
    requiredPermissions: ['view_research'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 45,
    helpDocPath: 'docs/stages/08-visualization.md',
  },
  9: {
    id: 9,
    name: 'Interpretation',
    description: 'Collaborate on interpreting results',
    longDescription: 'Discuss and interpret your findings with collaborators. Add comments, annotations, and notes to artifacts. Resolve discussions and document conclusions.',
    icon: MessageSquare,
    category: 'validation',
    inputSchemaRef: 'stages/stage-09-interpretation.input.schema.json',
    outputTypes: ['interpretation.md', 'comments.json'],
    requiredPermissions: ['view_research', 'comment'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 60,
    helpDocPath: 'docs/stages/09-interpretation.md',
  },
  10: {
    id: 10,
    name: 'Validation',
    description: 'Review and validate research findings',
    longDescription: 'Conduct a systematic validation of your findings using a checklist-based approach. Assign reviewers, track completion, and document any issues.',
    icon: CheckCircle,
    category: 'validation',
    inputSchemaRef: 'stages/stage-10-validation.input.schema.json',
    outputTypes: ['validation_checklist.json', 'validation_report.md'],
    requiredPermissions: ['view_research', 'review'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 45,
    helpDocPath: 'docs/stages/10-validation.md',
  },
  11: {
    id: 11,
    name: 'Iteration',
    description: 'Refine analysis with AI routing options',
    longDescription: 'Based on validation feedback, iterate on your analysis. Choose the appropriate AI model tier for cost/quality tradeoffs and track version history.',
    icon: RefreshCw,
    category: 'analysis',
    inputSchemaRef: 'stages/stage-11-iteration.input.schema.json',
    outputTypes: ['iteration_log.json'],
    requiredPermissions: ['view_research', 'run_analysis'],
    requiresPhiScan: false,
    optional: true,
    estimatedDuration: 120,
    recommendedModelTier: 'MINI',
    helpDocPath: 'docs/stages/11-iteration.md',
  },
  12: {
    id: 12,
    name: 'Documentation',
    description: 'Generate reports and documentation',
    longDescription: 'Create comprehensive documentation of your research. Generate Markdown reports, protocol documents, and export to various formats including PDF.',
    icon: FileText,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-12-documentation.input.schema.json',
    outputTypes: ['report.md', 'report.pdf'],
    requiredPermissions: ['view_research', 'export'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 60,
    recommendedModelTier: 'MINI',
    helpDocPath: 'docs/stages/12-documentation.md',
  },
  13: {
    id: 13,
    name: 'Internal Review',
    description: 'Simulate peer review feedback',
    longDescription: 'Run AI-powered review simulations to get feedback before formal peer review. Configure reviewer personas and rubrics to identify potential issues.',
    icon: Users,
    category: 'validation',
    inputSchemaRef: 'stages/stage-13-review.input.schema.json',
    outputTypes: ['review_feedback.json', 'scorecard.json'],
    requiredPermissions: ['view_research'],
    requiresPhiScan: false,
    optional: true,
    estimatedDuration: 30,
    recommendedModelTier: 'FRONTIER',
    helpDocPath: 'docs/stages/13-internal-review.md',
  },
  14: {
    id: 14,
    name: 'Ethical Review',
    description: 'Verify compliance and ethical standards',
    longDescription: 'Ensure your research meets ethical guidelines and compliance requirements. Complete checklists, attach evidence, and document any remediation steps.',
    icon: Scale,
    category: 'validation',
    inputSchemaRef: 'stages/stage-14-ethical.input.schema.json',
    outputTypes: ['ethical_review.json', 'compliance_report.md'],
    requiredPermissions: ['view_research', 'compliance'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 45,
    helpDocPath: 'docs/stages/14-ethical-review.md',
  },
  15: {
    id: 15,
    name: 'Artifact Bundling',
    description: 'Package artifacts for sharing and archiving',
    longDescription: 'Create bundles of selected artifacts for sharing or archiving. Validate PHI status, generate manifests, and create downloadable packages.',
    icon: Package,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-15-bundling.input.schema.json',
    outputTypes: ['bundle.zip', 'bundle_manifest.json'],
    requiredPermissions: ['view_research', 'export'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 30,
    helpDocPath: 'docs/stages/15-bundling.md',
  },
  16: {
    id: 16,
    name: 'Collaboration Handoff',
    description: 'Share with collaborators and external reviewers',
    longDescription: 'Share your work with collaborators or external reviewers. Generate secure share links with customizable permissions and expiration dates.',
    icon: Share2,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-16-handoff.input.schema.json',
    outputTypes: ['share_link.json'],
    requiredPermissions: ['view_research', 'share'],
    requiresPhiScan: true,
    optional: true,
    estimatedDuration: 15,
    helpDocPath: 'docs/stages/16-handoff.md',
  },
  17: {
    id: 17,
    name: 'Archiving',
    description: 'Archive project with comprehensive audit trail',
    longDescription: 'Archive your project for long-term storage. All actions are logged in a comprehensive audit trail that can be exported for compliance purposes.',
    icon: Archive,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-17-archiving.input.schema.json',
    outputTypes: ['archive_record.json', 'audit_log.json'],
    requiredPermissions: ['view_research', 'archive'],
    requiresPhiScan: false,
    optional: false,
    estimatedDuration: 15,
    helpDocPath: 'docs/stages/17-archiving.md',
  },
  18: {
    id: 18,
    name: 'Impact Assessment',
    description: 'Track and visualize research impact metrics',
    longDescription: 'Monitor the impact of your research through various metrics including citations, downloads, and engagement. Visualize trends over time.',
    icon: TrendingUp,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-18-impact.input.schema.json',
    outputTypes: ['impact_metrics.json'],
    requiredPermissions: ['view_research'],
    requiresPhiScan: false,
    optional: true,
    estimatedDuration: 15,
    helpDocPath: 'docs/stages/18-impact.md',
  },
  19: {
    id: 19,
    name: 'Dissemination',
    description: 'Prepare research for publication and broader sharing',
    longDescription: 'Prepare your research for publication. Check formatting requirements, generate submission packages, and track submission status.',
    icon: Globe,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-19-dissemination.input.schema.json',
    outputTypes: ['submission_package.zip'],
    requiredPermissions: ['view_research', 'export'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 60,
    helpDocPath: 'docs/stages/19-dissemination.md',
  },
  20: {
    id: 20,
    name: 'Conference Preparation',
    description: 'Generate materials for conference presentations',
    longDescription: 'Discover relevant conferences, generate abstracts, create posters and slides, and prepare comprehensive submission bundles.',
    icon: Presentation,
    category: 'dissemination',
    inputSchemaRef: 'stages/stage-20-conference.input.schema.json',
    outputTypes: ['abstract.md', 'poster.pdf', 'slides.pptx', 'submission_bundle.zip'],
    requiredPermissions: ['view_research', 'export'],
    requiresPhiScan: true,
    optional: false,
    estimatedDuration: 90,
    recommendedModelTier: 'FRONTIER',
    helpDocPath: 'docs/stages/20-conference.md',
  },
};

/**
 * Get a stage by ID
 */
export function getStage(id: StageId): StageDefinition {
  return STAGES[id];
}

/**
 * Get all stages as an array, optionally filtered by category
 */
export function getStages(category?: StageCategory): StageDefinition[] {
  const stages = Object.values(STAGES);
  if (category) {
    return stages.filter(s => s.category === category);
  }
  return stages;
}

/**
 * Get stages that require PHI scanning
 */
export function getPhiRequiredStages(): StageDefinition[] {
  return getStages().filter(s => s.requiresPhiScan);
}

/**
 * Get optional stages
 */
export function getOptionalStages(): StageDefinition[] {
  return getStages().filter(s => s.optional);
}

/**
 * Category metadata
 */
export const STAGE_CATEGORIES: Record<StageCategory, { name: string; description: string }> = {
  discovery: {
    name: 'Discovery',
    description: 'Formulate hypotheses and design experiments',
  },
  collection: {
    name: 'Collection',
    description: 'Gather and prepare research data',
  },
  analysis: {
    name: 'Analysis',
    description: 'Process data and build models',
  },
  validation: {
    name: 'Validation',
    description: 'Review and validate findings',
  },
  dissemination: {
    name: 'Dissemination',
    description: 'Share and publish research',
  },
};
