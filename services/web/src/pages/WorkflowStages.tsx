/**
 * Workflow Stages Page
 *
 * Displays all 20 research workflow stages with:
 * - Stage status indicators
 * - Category groupings
 * - Navigation to stage details
 *
 * Updated to match the official 20-stage definition in stages.ts
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ArrowRight,
  Lock,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { STAGES, STAGE_CATEGORIES, type StageCategory, type StageDefinition } from '@/workflow/stages';

type StageStatus = 'available' | 'requires-approval' | 'locked' | 'coming-soon';

interface WorkflowStageUI {
  stage: StageDefinition;
  status: StageStatus;
  actionRoute?: string;
  actionLabel?: string;
}

/**
 * Map stage definitions to UI representation with status and routes
 */
function getStageUIConfig(): WorkflowStageUI[] {
  return [
    // Stage 1: Hypothesis Generation
    {
      stage: STAGES[1],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Generate Hypotheses',
    },
    // Stage 2: Literature Review
    {
      stage: STAGES[2],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Search Literature',
    },
    // Stage 3: Experimental Design
    {
      stage: STAGES[3],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Design Experiment',
    },
    // Stage 4: Data Collection
    {
      stage: STAGES[4],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Upload Data',
    },
    // Stage 5: Data Preprocessing
    {
      stage: STAGES[5],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Preprocess Data',
    },
    // Stage 6: Analysis
    {
      stage: STAGES[6],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Run Analysis',
    },
    // Stage 7: Statistical Modeling
    {
      stage: STAGES[7],
      status: 'available',
      actionRoute: '/sap/demo-topic/demo-research',
      actionLabel: 'Open SAP Builder',
    },
    // Stage 8: Visualization
    {
      stage: STAGES[8],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Create Visualizations',
    },
    // Stage 9: Interpretation
    {
      stage: STAGES[9],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Interpret Results',
    },
    // Stage 10: Validation
    {
      stage: STAGES[10],
      status: 'available',
      actionRoute: '/quality-dashboard',
      actionLabel: 'Run Validation',
    },
    // Stage 11: Iteration
    {
      stage: STAGES[11],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Iterate Analysis',
    },
    // Stage 12: Documentation
    {
      stage: STAGES[12],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Generate Reports',
    },
    // Stage 13: Internal Review
    {
      stage: STAGES[13],
      status: 'available',
      actionRoute: '/review-sessions',
      actionLabel: 'Start Review',
    },
    // Stage 14: Ethical Review
    {
      stage: STAGES[14],
      status: 'requires-approval',
      actionRoute: '/governance',
      actionLabel: 'View Compliance',
    },
    // Stage 15: Artifact Bundling
    {
      stage: STAGES[15],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Bundle Artifacts',
    },
    // Stage 16: Collaboration Handoff
    {
      stage: STAGES[16],
      status: 'available',
      actionRoute: '/workflow',
      actionLabel: 'Share Research',
    },
    // Stage 17: Archiving
    {
      stage: STAGES[17],
      status: 'available',
      actionRoute: '/governance-console',
      actionLabel: 'View Audit Logs',
    },
    // Stage 18: Impact Assessment
    {
      stage: STAGES[18],
      status: 'coming-soon',
    },
    // Stage 19: Dissemination
    {
      stage: STAGES[19],
      status: 'requires-approval',
    },
    // Stage 20: Conference Preparation
    {
      stage: STAGES[20],
      status: 'coming-soon',
    },
  ];
}

const statusConfig: Record<StageStatus, {
  badge: string;
  badgeColor: string;
  borderColor: string;
  bgColor: string;
}> = {
  'available': {
    badge: 'AVAILABLE',
    badgeColor: 'bg-green-100 text-green-700 border-green-300',
    borderColor: 'border-green-300',
    bgColor: 'bg-white hover:bg-green-50',
  },
  'requires-approval': {
    badge: 'REQUIRES APPROVAL',
    badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    borderColor: 'border-yellow-300',
    bgColor: 'bg-white hover:bg-yellow-50',
  },
  'locked': {
    badge: 'LOCKED',
    badgeColor: 'bg-red-100 text-red-700 border-red-300',
    borderColor: 'border-red-300',
    bgColor: 'bg-gray-50',
  },
  'coming-soon': {
    badge: 'COMING SOON',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50',
  },
};

const categoryColors: Record<StageCategory, string> = {
  discovery: 'bg-purple-100 text-purple-700',
  collection: 'bg-blue-100 text-blue-700',
  analysis: 'bg-orange-100 text-orange-700',
  validation: 'bg-green-100 text-green-700',
  dissemination: 'bg-pink-100 text-pink-700',
};

function StageCard({ stageUI }: { stageUI: WorkflowStageUI }) {
  const { stage, status, actionRoute, actionLabel } = stageUI;
  const Icon = stage.icon;
  const [, navigate] = useLocation();
  const config = statusConfig[status];

  return (
    <div
      className={`border-2 rounded-lg p-6 ${config.borderColor} ${config.bgColor} transition-colors`}
      data-testid={`card-stage-${stage.id}`}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">STAGE {stage.id}</div>
            <h3 className="text-lg font-bold text-gray-900">{stage.name}</h3>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border-2 whitespace-nowrap ${config.badgeColor}`}
        >
          {config.badge}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{stage.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className={categoryColors[stage.category]}>
          {STAGE_CATEGORIES[stage.category].name}
        </Badge>
        {stage.requiresPhiScan && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <Shield className="h-3 w-3 mr-1" />
            PHI Scan
          </Badge>
        )}
        {stage.optional && (
          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
            Optional
          </Badge>
        )}
        {stage.recommendedModelTier && (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            {stage.recommendedModelTier}
          </Badge>
        )}
      </div>

      {stage.estimatedDuration && (
        <div className="text-xs text-gray-500 flex items-center gap-1 mb-4">
          <Clock className="h-3 w-3" />
          Est. {stage.estimatedDuration} min
        </div>
      )}

      {actionRoute && status === 'available' && (
        <div className="mt-4">
          <Button
            onClick={() => navigate(actionRoute)}
            className="w-full"
            data-testid={`button-stage-${stage.id}-action`}
          >
            {actionLabel || 'Open'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {status === 'requires-approval' && actionRoute && (
        <div className="mt-4">
          <Button
            onClick={() => navigate(actionRoute)}
            variant="outline"
            className="w-full"
            data-testid={`button-stage-${stage.id}-action`}
          >
            {actionLabel || 'Request Access'}
            <Lock className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  stages,
}: {
  category: StageCategory;
  stages: WorkflowStageUI[];
}) {
  const categoryInfo = STAGE_CATEGORIES[category];
  const stageIds = stages.map((s) => s.stage.id);
  const minId = Math.min(...stageIds);
  const maxId = Math.max(...stageIds);

  return (
    <div className="mb-12">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <Badge className={`${categoryColors[category]} text-sm px-3 py-1`}>
            {categoryInfo.name}
          </Badge>
          <span className="text-sm text-gray-500">
            Stages {minId}–{maxId}
          </span>
        </div>
        <p className="text-gray-600">{categoryInfo.description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stages.map((stageUI) => (
          <StageCard key={stageUI.stage.id} stageUI={stageUI} />
        ))}
      </div>
    </div>
  );
}

function WorkflowStages() {
  const stageUIConfig = getStageUIConfig();

  // Group stages by category
  const stagesByCategory: Record<StageCategory, WorkflowStageUI[]> = {
    discovery: [],
    collection: [],
    analysis: [],
    validation: [],
    dissemination: [],
  };

  stageUIConfig.forEach((stageUI) => {
    stagesByCategory[stageUI.stage.category].push(stageUI);
  });

  // Calculate summary stats
  const availableCount = stageUIConfig.filter((s) => s.status === 'available').length;
  const requiresApprovalCount = stageUIConfig.filter(
    (s) => s.status === 'requires-approval'
  ).length;
  const comingSoonCount = stageUIConfig.filter((s) => s.status === 'coming-soon').length;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900">20-Stage Research Workflow</h1>
        <p className="mt-2 text-gray-600">
          Governance-first research pipeline from hypothesis to dissemination
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">
              Available ({availableCount})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-600">
              Requires Approval ({requiresApprovalCount})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-sm text-gray-600">
              Coming Soon ({comingSoonCount})
            </span>
          </div>
        </div>
      </div>

      {/* Discovery Stages */}
      <CategorySection category="discovery" stages={stagesByCategory.discovery} />

      {/* Collection Stages */}
      <CategorySection category="collection" stages={stagesByCategory.collection} />

      {/* Analysis Stages */}
      <CategorySection category="analysis" stages={stagesByCategory.analysis} />

      {/* Validation Stages */}
      <CategorySection category="validation" stages={stagesByCategory.validation} />

      {/* Dissemination Stages */}
      <CategorySection category="dissemination" stages={stagesByCategory.dissemination} />
    </div>
  );
}

export default WorkflowStages;
